import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { Hub } from '../src/core/hub.js';
import { createSourceServer } from '../src/server.js';
import net from 'node:net';
test('browser source requires a token, validates origin and exposes read-only snapshots',async()=>{
 const hub=new Hub(); const server=await createSourceServer({hub,port:0,token:'test-token',publicDir:new URL('../public/',import.meta.url)});
 try {
   assert.equal((await fetch(server.origin+'/overlay')).status,403);
   assert.equal((await fetch(server.origin+'/api/settings?token=test-token')).status,404);
   const denied=new WebSocket(server.origin.replace('http','ws')+'/live?token=test-token',{origin:'https://evil.example'});
   const [error]=await once(denied,'error'); assert.match(error.message,/403/);
   const ws=new WebSocket(server.origin.replace('http','ws')+'/live?token=test-token',{origin:server.origin});
   const [initial]=await once(ws,'message'); assert.equal(JSON.parse(initial).type,'snapshot');
   ws.send(JSON.stringify({command:'clear'}));
   const next=once(ws,'message'); hub.ingest({kind:'message',id:'1',platform:'twitch',text:'hello'});
   assert.equal(JSON.parse((await next)[0]).messages[0].text,'hello'); ws.close(); await once(ws,'close');
 } finally { await server.close(); hub.close(); }
});
test('malformed request targets are rejected without taking down the server',async()=>{
 const hub=new Hub();const server=await createSourceServer({hub,port:0,token:'t',publicDir:new URL('../public/',import.meta.url)});
 try {const u=new URL(server.origin);const socket=net.connect(Number(u.port),'127.0.0.1');await once(socket,'connect');
 const reply=once(socket,'data');socket.write(`GET //% HTTP/1.1\r\nHost: ${u.host}\r\nConnection: close\r\n\r\n`);assert.match(String((await reply)[0]),/400 Bad Request/);socket.destroy();
 assert.equal((await fetch(server.origin+'/missing')).status,404);
 }finally{await server.close();hub.close();}
});
