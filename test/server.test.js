import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { Hub } from '../src/core/hub.js';
import { createSourceServer } from '../src/server.js';
import net from 'node:net';
import {networkInterfaces} from 'node:os';
import http from 'node:http';

test('LAN opt-in shares live chat with authenticated devices and preserves localhost',async t=>{
 const address=Object.values(networkInterfaces()).flat().find(x=>!x.internal&&x.family==='IPv4'&&/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(x.address))?.address;
 if(!address)return t.skip('No private IPv4 interface');
 const hub=new Hub(),server=await createSourceServer({hub,port:0,token:'lan-test',lanEnabled:true,publicDir:new URL('../public/',import.meta.url)});
 try {
  const lan=`http://${address}:${new URL(server.origin).port}`;
  assert.ok(server.lanOrigins.some(x=>x.origin===lan));
  for(const origin of [server.origin,lan]){
   assert.equal((await fetch(origin+'/overlay?token=lan-test&tablet=1')).status,200);
   assert.equal((await fetch(origin+'/overlay')).status,403);
   assert.equal((await fetch(origin+'/overlay?token=wrong')).status,403);
   assert.equal((await fetch(origin+'/api/settings?token=lan-test')).status,404);
  }
  const rejectedHost=await new Promise((resolve,reject)=>http.get(server.origin+'/overlay?token=lan-test',{headers:{host:'evil.example'}},res=>{res.resume();resolve(res.statusCode);}).on('error',reject));
  assert.equal(rejectedHost,403);
  for(const [token,origin] of [['wrong',lan],['lan-test','https://evil.example'],['lan-test',server.origin]]){
   const denied=new WebSocket(lan.replace('http','ws')+'/live?token='+token,{origin});
   assert.match((await once(denied,'error'))[0].message,/403/);
  }
  const ws=new WebSocket(lan.replace('http','ws')+'/live?token=lan-test',{origin:lan});await once(ws,'message');
  const next=once(ws,'message');hub.ingest({kind:'message',id:'lan-msg',platform:'twitch',text:'Hello iPad'});
  assert.equal(JSON.parse((await next)[0]).messages[0].text,'Hello iPad');
  const closed=once(ws,'close');await server.close();await closed;
 }finally{await server.close();hub.close();}
 const local=await createSourceServer({hub:new Hub(),port:0,token:'x',publicDir:new URL('../public/',import.meta.url)});
 try{assert.deepEqual(local.lanOrigins,[]);await assert.rejects(fetch(`http://${address}:${new URL(local.origin).port}/overlay?token=x`,{signal:AbortSignal.timeout(1500)}));}finally{await local.close();}
});
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
