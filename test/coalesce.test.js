import test from 'node:test';
import assert from 'node:assert/strict';
import { coalesce } from '../src/core/coalesce.js';
import { Hub } from '../src/core/hub.js';

test('a chat burst delivers the latest bounded history once, with all events ingested',t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const hub=new Hub();const deliveries=[];const publish=coalesce(()=>deliveries.push(hub.snapshot()));hub.on('change',publish);
 for(let i=0;i<1000;i++)hub.ingest({kind:'message',id:String(i),platform:'twitch',time:0});
 assert.equal(deliveries.length,0);t.mock.timers.tick(50);
 assert.equal(deliveries.length,1);assert.equal(deliveries[0].received,1000);assert.equal(deliveries[0].messages.at(-1).id,'999');assert.equal(deliveries[0].messages.length,200);
 hub.ingest({kind:'clear',platform:'twitch'});t.mock.timers.tick(50);assert.equal(deliveries[1].messages.length,0);
 publish();publish.cancel();t.mock.timers.tick(50);assert.equal(deliveries.length,2);hub.close();
});
