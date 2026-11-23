import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeEvent,EVENT_SUBSCRIPTIONS} from '../src/core/events.js';
import {normalizeSettings} from '../src/core/settings.js';
import {Hub} from '../src/core/hub.js';
const event=(source,type,data)=>normalizeEvent({event:{source,type},data});

test('viewer counts use live concurrent viewers, preserve zero, and reject missing/invalid/test values',()=>{
 assert.ok(EVENT_SUBSCRIPTIONS.Twitch.includes('ViewerCountUpdate'));
 assert.ok(EVENT_SUBSCRIPTIONS.YouTube.includes('StatisticsUpdated'));
 assert.equal(event('Twitch','ViewerCountUpdate',{viewerCount:0}).count,0);
 assert.equal(event('YouTube','StatisticsUpdated',{broadcast:{id:'a'},viewCount:9000,concurrentViewers:12}).count,12);
 for(const viewerCount of [undefined,null,'',-1,2.5,Infinity,'5'])assert.equal(event('Twitch','ViewerCountUpdate',{viewerCount}),null);
 assert.equal(event('Twitch','ViewerCountUpdate',{viewerCount:40,isTest:true}),null);
 assert.equal(event('YouTube','StatisticsUpdated',{viewCount:9000}),null);
});

test('viewer state replaces updates, sums YouTube broadcasts and clears on disconnect/end',()=>{
 const h=new Hub();try{
  assert.deepEqual(h.snapshot().viewers,{twitch:null,youtube:null});
  h.ingest(event('Twitch','ViewerCountUpdate',{viewerCount:42}));
  h.ingest(event('YouTube','StatisticsUpdated',{broadcast:{id:'a'},concurrentViewers:12}));
  h.ingest(event('YouTube','StatisticsUpdated',{broadcast:{id:'b'},concurrentViewers:3}));
  h.ingest(event('YouTube','StatisticsUpdated',{broadcast:{id:'a'},concurrentViewers:10}));
  assert.deepEqual(h.snapshot().viewers,{twitch:42,youtube:13});assert.equal(h.received,0);assert.equal(h.queue.length,0);assert.equal(h.messages.length,0);
  h.ingest(event('YouTube','BroadcastEnded',{broadcast:{id:'a'}}));assert.equal(h.snapshot().viewers.youtube,3);
  h.ingest(event('Twitch','StreamOffline',{}));assert.equal(h.snapshot().viewers.twitch,null);
  h.setStatus({state:'connecting',label:'Reconnecting'});assert.deepEqual(h.snapshot().viewers,{twitch:null,youtube:null});
 }finally{h.close();}
});

test('viewer visibility is profile-specific and independent of chat platform filters',()=>{
 const p=normalizeSettings({profiles:[{platforms:{youtube:false},viewerCounts:{enabled:true,platforms:{twitch:false,youtube:true,kick:true}}}]}).profiles[0];
 assert.deepEqual(p.viewerCounts,{enabled:true,platforms:{twitch:false,youtube:true}});assert.equal(p.platforms.youtube,false);
});

test('YouTube events with missing broadcast IDs cannot double-count or keep ended counts',()=>{
 const h=new Hub();const stats=(count,id)=>h.ingest(event('YouTube','StatisticsUpdated',{concurrentViewers:count,broadcast:id?{id}:null}));
 try{
  stats(5);stats(12,'a');assert.equal(h.snapshot().viewers.youtube,12);
  stats(10);assert.equal(h.snapshot().viewers.youtube,10);
  stats(3,'b');stats(9);assert.equal(h.snapshot().viewers.youtube,13,'Ambiguous updates cannot overwrite multiple known broadcasts');
  h.ingest(event('YouTube','BroadcastEnded',{}));assert.equal(h.snapshot().viewers.youtube,null);
  stats(5);h.ingest(event('YouTube','BroadcastEnded',{broadcast:{id:'a'}}));assert.equal(h.snapshot().viewers.youtube,null);
 }finally{h.close();}
});
