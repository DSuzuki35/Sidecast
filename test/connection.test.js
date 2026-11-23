import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocketServer } from 'ws';
import { once } from 'node:events';
import { connectStreamerbot,createConnectionManager } from '../src/connection.js';
const until=async(fn)=>{const deadline=Date.now()+6000;while(!fn()){if(Date.now()>deadline)throw Error('Timed out');await new Promise(r=>setTimeout(r,20));}};
test('official client subscribes to supported events and receives normalized chat',async()=>{
 const wss=new WebSocketServer({port:0,host:'127.0.0.1'}); await once(wss,'listening'); const statuses=[],events=[],requests=[];
 wss.on('connection',ws=>{
   ws.send(JSON.stringify({request:'Hello',info:{version:'1.0.1',name:'Fixture'}}));
   ws.on('message',raw=>{const r=JSON.parse(raw);requests.push(r);const response={id:r.id,status:'ok'};
     if(r.request==='GetInfo')response.info={version:'1.0.1',name:'Fixture'};
     if(r.request==='GetEvents')response.events={Twitch:['ChatMessage','Follow']};
     ws.send(JSON.stringify(response));
     if(r.request==='Subscribe')ws.send(JSON.stringify({event:{source:'Twitch',type:'ChatMessage'},data:{messageId:'real',text:'hello',user:{name:'Alex'}}}));
   });
 });
 const stop=connectStreamerbot({host:'127.0.0.1',port:wss.address().port},e=>events.push(e),s=>statuses.push(s));
 try {await until(()=>events.length>0);assert.equal(events[0].name,'Alex');assert.ok(statuses.some(s=>s.state==='connected'));assert.deepEqual(requests.find(r=>r.request==='Subscribe').events,{Twitch:['ChatMessage','Follow']});}
 finally{await stop();for(const ws of wss.clients)ws.terminate();await new Promise(r=>wss.close(r));}
});
test('authentication failure is explicit and never reported as connected',async()=>{
 const wss=new WebSocketServer({port:0,host:'127.0.0.1'});await once(wss,'listening');const statuses=[];
 wss.on('connection',ws=>{ws.send(JSON.stringify({request:'Hello',info:{version:'1.0.1'},authentication:{salt:'salt',challenge:'challenge'}}));ws.on('message',raw=>{const r=JSON.parse(raw);ws.send(JSON.stringify({id:r.id,status:'error',error:'Authentication failed'}));});});
 const stop=connectStreamerbot({host:'127.0.0.1',port:wss.address().port,password:'wrong'},()=>{},s=>statuses.push(s));
 try {await until(()=>statuses.some(s=>s.state==='auth-error'));assert.ok(!statuses.some(s=>s.state==='connected'));}
 finally{await stop();for(const ws of wss.clients)ws.terminate();await new Promise(r=>wss.close(r));}
});
test('simultaneous connection actions leave only one client and disconnect closes it',async()=>{
 const wss=new WebSocketServer({port:0,host:'127.0.0.1'});await once(wss,'listening');const states=[];
 wss.on('connection',ws=>{ws.send(JSON.stringify({request:'Hello',info:{version:'1.0.1'}}));ws.on('message',raw=>{const r=JSON.parse(raw);ws.send(JSON.stringify({id:r.id,status:'ok',info:{version:'1.0.1'},events:{Twitch:['ChatMessage']}}));});});
 const manager=createConnectionManager(()=>{},s=>states.push(s));
 try{const config={host:'127.0.0.1',port:wss.address().port};await Promise.all([manager.connect(config),manager.connect(config),manager.connect(config)]);await until(()=>states.some(s=>s.state==='connected'));assert.equal(wss.clients.size,1);await manager.disconnect();await until(()=>wss.clients.size===0);}
 finally{await manager.disconnect();for(const ws of wss.clients)ws.terminate();await new Promise(r=>wss.close(r));}
});
test('a dropped WebSocket reconnects and resubscribes without duplicating clients',async()=>{
 const wss=new WebSocketServer({port:0,host:'127.0.0.1'});await once(wss,'listening');let subscriptions=0;const states=[];
 wss.on('connection',ws=>{ws.send(JSON.stringify({request:'Hello',info:{version:'1.0.1'}}));ws.on('message',raw=>{const r=JSON.parse(raw);if(r.request==='Subscribe')subscriptions++;ws.send(JSON.stringify({id:r.id,status:'ok',info:{version:'1.0.1'},events:{Twitch:['ChatMessage']}}));});});
 const stop=connectStreamerbot({host:'127.0.0.1',port:wss.address().port},()=>{},s=>states.push(s));
 try{await until(()=>subscriptions===1);for(const ws of wss.clients)ws.terminate();await until(()=>subscriptions===2);assert.equal(wss.clients.size,1);assert.ok(states.some(s=>s.state==='connecting'));}
 finally{await stop();for(const ws of wss.clients)ws.terminate();await new Promise(r=>wss.close(r));}
});

test('subscription failure remains visible while a retry is pending',async()=>{
 const wss=new WebSocketServer({port:0,host:'127.0.0.1'});await once(wss,'listening');const states=[];
 wss.on('connection',ws=>{ws.send(JSON.stringify({request:'Hello',info:{version:'1.0.1'}}));ws.on('message',raw=>{const r=JSON.parse(raw);ws.send(JSON.stringify({id:r.id,status:r.request==='Subscribe'?'error':'ok',error:r.request==='Subscribe'?'denied':undefined,info:{version:'1.0.1'},events:{Twitch:['ChatMessage']}}));});});
 const stop=connectStreamerbot({host:'127.0.0.1',port:wss.address().port},()=>{},s=>states.push(s));
 try{await until(()=>states.some(s=>s.state==='error'));await new Promise(r=>setTimeout(r,100));assert.equal(states.at(-1).state,'error');assert.match(states.at(-1).label,/subscribe/);assert.ok(!states.some(s=>s.state==='connected'));}
 finally{await stop();for(const ws of wss.clients)ws.terminate();await new Promise(r=>wss.close(r));}
});
