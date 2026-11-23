import test from 'node:test';
import assert from 'node:assert/strict';
import { Hub } from '../src/core/hub.js';
import { normalizeSettings } from '../src/core/settings.js';
const message=(id,platform='twitch',userId='u')=>({kind:'message',id,platform,userId,time:1000,text:'hi'});
test('hub deduplicates, limits history and handles scoped moderation',()=>{
 const h=new Hub(); for(let i=0;i<250;i++) h.ingest(message('m'+i)); h.ingest(message('m249'));
 assert.equal(h.snapshot().messages.length,200);
 h.ingest(message('yt','youtube')); h.ingest({kind:'clear',platform:'twitch'}); assert.deepEqual(h.snapshot().messages.map(m=>m.id),['yt']);
 h.ingest({kind:'delete',platform:'youtube',messageId:'yt'}); assert.equal(h.snapshot().messages.length,0); h.close();
});

test('mixed alerts play FIFO with individual durations and never overlap',()=>{
 let now=1000;const settings=normalizeSettings({profiles:[{alertDurations:{follow:3,sub:8,raid:15}}]});const h=new Hub({settings,now:()=>now});
 try {
  for(const type of ['follow','sub','raid'])h.ingest({kind:'alert',id:type,platform:'twitch',alertType:type});
  assert.equal(h.alert.id,'follow');assert.equal(h.alert.endsAt,4000);assert.equal(h.queue.length,2);
  // A duration edit must not shorten or restart the alert already playing.
  settings.profiles[0].alertDurations.follow=20;settings.profiles[0].alertDurations.sub=10;h.updateSettings(settings);assert.equal(h.alert.endsAt,4000);
  now=3999;h.tick();assert.equal(h.alert.id,'follow');
  now=4000;h.tick();assert.equal(h.alert.id,'sub');assert.equal(h.alert.endsAt,14000);assert.equal(h.queue.length,1);
  now=14000;h.tick();assert.equal(h.alert.id,'raid');assert.equal(h.alert.endsAt,29000);assert.equal(h.queue.length,0);
  now=29000;h.tick();assert.equal(h.alert,null);assert.equal(h.timer,null);
 }finally{h.close();}
});
test('alerts queue sequentially, disabled events drop, expired events do not replay',()=>{
 let now=1000; const h=new Hub({now:()=>now});
 h.ingest({kind:'alert',id:'a',platform:'twitch',alertType:'raid',time:now}); h.ingest({kind:'alert',id:'b',platform:'twitch',alertType:'sub',time:now});
 assert.equal(h.snapshot().alert.id,'a'); assert.equal(h.snapshot().queued,1);
 now=8100; h.tick(); assert.equal(h.snapshot().alert.id,'b');
 now=16000; h.tick(); assert.equal(h.snapshot().alert,null);
 const s=normalizeSettings(); s.profiles[0].alerts.follow=false; h.updateSettings(s);
 h.ingest({kind:'alert',id:'c',platform:'twitch',alertType:'follow',time:now}); assert.equal(h.snapshot().alert,null); h.close();
});
test('browser snapshots contain only public rendering state',()=>{
 const h=new Hub({settings:normalizeSettings({connection:{host:'secret-host'}})});
 assert.equal(h.snapshot().settings,undefined); assert.equal(JSON.stringify(h.snapshot()).includes('secret-host'),false); h.close();
});
test('chat and cheer can share an upstream message id without dropping either',()=>{
 const h=new Hub();h.ingest(message('same'));h.ingest({kind:'alert',id:'same',platform:'twitch',alertType:'cheer'});
 assert.equal(h.snapshot().messages.length,2);assert.equal(h.snapshot().alert.alertType,'cheer');assert.equal(h.snapshot().messages[0].kind,'message');assert.equal(h.snapshot().messages[1].kind,'alert-message');
 h.ingest(message('same'));assert.equal(h.snapshot().messages.length,2);h.close();
});

test('alert deadlines advance the queue without polling or duplicate publications',t=>{
 t.mock.timers.enable({apis:['setTimeout']});let now=1000;const h=new Hub({now:()=>now});let changes=0;h.on('change',()=>changes++);
 assert.equal(h.timer,null);
 h.ingest({kind:'alert',id:'first',platform:'twitch',alertType:'raid'});assert.equal(changes,1);
 h.ingest({kind:'alert',id:'second',platform:'twitch',alertType:'sub'});assert.equal(changes,2);
 const duration=h.snapshot().alert.endsAt-now;now+=duration;t.mock.timers.tick(duration);
 assert.equal(h.snapshot().alert.id,'second');assert.equal(changes,3);
 now+=duration;t.mock.timers.tick(duration);assert.equal(h.snapshot().alert,null);assert.equal(h.timer,null);assert.equal(changes,4);h.close();
});
