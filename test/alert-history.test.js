import test from 'node:test';
import assert from 'node:assert/strict';
import {Hub} from '../src/core/hub.js';
import {normalizeSettings} from '../src/core/settings.js';
const alert=(id,type='raid')=>({kind:'alert',id,alertType:type,platform:'twitch',userId:'raider',name:'balkn',detail:'128 viewers',time:1});
test('each playing alert creates one lasting chat entry with its own identity and display time',()=>{
 let now=1000;const h=new Hub({now:()=>now});
 try{
  h.ingest({kind:'message',id:'same',platform:'twitch',text:'hello',time:now});h.ingest(alert('same'));h.ingest(alert('queued','sub'));
  assert.equal(h.messages.length,2);const row=h.messages[1];assert.equal(row.kind,'alert-message');assert.notEqual(row.id,'same');assert.equal(row.name,'balkn');assert.equal(row.text,'128 viewers');assert.equal(row.time,1000);assert.equal('audio' in row,false);
  h.ingest(alert('same'));h.tick();assert.equal(h.messages.length,2);
  now=h.alert.endsAt;h.tick();assert.equal(h.messages.length,3);assert.equal(h.messages[2].time,now);assert.equal(h.messages[2].alertType,'sub');
  now=h.alert.endsAt;h.tick();assert.equal(h.alert,null);assert.equal(h.messages.length,3);
 }finally{h.close();}
});
test('disabled and expired queued alerts do not create chat entries; all history shares its limit',()=>{
 let now=1000;const h=new Hub({now:()=>now,settings:normalizeSettings({profiles:[{alerts:{follow:false}}]})});
 try{
  h.ingest(alert('disabled','follow'));assert.equal(h.messages.length,0);
  h.ingest(alert('first'));h.ingest(alert('expired'));now+=121000;h.tick();assert.equal(h.messages.length,1);
  for(let i=0;i<200;i++)h.ingest({kind:'message',id:'m'+i,platform:'twitch',text:'next',time:now});assert.equal(h.messages.length,200);assert.equal(h.messages.some(m=>m.kind==='alert-message'),false);
 }finally{h.close();}
});
test('cleared or moderated alert history never reappears when its animation ends',()=>{
 let now=1000;const h=new Hub({now:()=>now});
 try{
  h.ingest(alert('a'));h.ingest({kind:'purge',platform:'twitch',userId:'raider'});assert.equal(h.messages.length,0);now=h.alert.endsAt;h.tick();assert.equal(h.messages.length,0);
  h.ingest({...alert('test'),test:true});assert.equal(h.messages.length,1);h.clearTests();assert.equal(h.messages.length,0);
  h.ingest(alert('b'));h.clear();h.tick();assert.equal(h.messages.length,0);
 }finally{h.close();}
});
test('history waits for queued audio and keeps synthesis/playback data out of chat messages',async()=>{
 let release;const h=new Hub({settings:normalizeSettings({profiles:[{audio:{enabled:true}}]}),prepareAlert:()=>new Promise(r=>release=r)});
 try{
  h.ingest(alert('audio'));assert.equal(h.messages.length,0);await Promise.resolve();release({duration:2,clips:[{url:'audio-private'}]});await new Promise(r=>setImmediate(r));
  assert.equal(h.messages.length,1);assert.equal(JSON.stringify(h.messages).includes('audio-private'),false);h.tick();assert.equal(h.messages.length,1);
 }finally{h.close();}
});
