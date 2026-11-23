import test from 'node:test';
import assert from 'node:assert/strict';
import {Hub} from '../src/core/hub.js';
import {normalizeSettings} from '../src/core/settings.js';
test('long synthesis and spoken playback do not silently expire queued alerts',async()=>{
 let now=1000;const jobs=[];const h=new Hub({now:()=>now,settings:normalizeSettings({profiles:[{audio:{enabled:true,types:{resub:{speak:true}}}}]}),prepareAlert:()=>new Promise(resolve=>jobs.push(resolve))});
 const event=id=>({kind:'alert',id,platform:'twitch',alertType:'resub',name:'balkn',message:'A long subscription message.'});
 try{
  h.ingest(event('a'));h.ingest(event('b'));await Promise.resolve();now+=150000;h.tick();assert.equal(h.queue.length,2);assert.ok(h.preparing);
  jobs[0]({duration:180,clips:[],output:'desktop'});await new Promise(r=>setImmediate(r));assert.equal(h.alert.id,'a');assert.equal(h.messages.length,1);
  h.ingest(event('c'));now+=150000;h.tick();assert.equal(h.queue.length,2);jobs[1]({duration:20,clips:[],output:'desktop'});await new Promise(r=>setImmediate(r));
  now=h.alert.endsAt;h.tick();assert.equal(h.alert.id,'b');assert.equal(h.messages.length,2);assert.equal(h.queue.length,1);
 }finally{h.close();}
});
