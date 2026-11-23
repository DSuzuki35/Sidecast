import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { coalesce } from './core/coalesce.js';
const assets = { '/overlay':'overlay.html','/audio':'audio.html','/audio-player.js':'audio-player.js','/audio-gain.js':'audio-gain.js','/overlay.js':'overlay.js','/shared.js':'shared.js','/appearance.js':'appearance.js','/text.js':'text.js','/styles.css':'styles.css','/brand.svg':'brand.svg' };
const mime = { html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',svg:'image/svg+xml' };
export async function createSourceServer({hub,publicDir,port=3131,token,audio=null}) {
  const root=publicDir instanceof URL ? fileURLToPath(publicDir) : publicDir;
  let origin;
  const parse=req=>{try{if(!req.url?.startsWith('/')||req.url.startsWith('//'))return null;const url=new URL(req.url,origin);return url.origin===origin?url:null;}catch{return null;}};
  const server=http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff'); res.setHeader('Referrer-Policy','no-referrer'); res.setHeader('Cache-Control','no-store');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; media-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    if(req.headers.host!==new URL(origin).host) {res.writeHead(403);res.end('Forbidden');return;}
    const url=parse(req);if(!url){res.writeHead(400);res.end('Bad request');return;}
    const pathname=url.pathname;
    if(req.method!=='GET') {res.writeHead(405);res.end();return;}
    if((pathname==='/overlay'||pathname==='/audio'||pathname.startsWith('/media/'))&&url.searchParams.get('token')!==token) {res.writeHead(403);res.end('Copy the browser source URL from Sidecast.');return;}
    if(pathname.startsWith('/media/')){try{const asset=await audio?.asset(pathname.slice(7));if(!asset){res.writeHead(404);res.end('Not found');return;}res.setHeader('Content-Type',asset.type);res.setHeader('Content-Length',asset.data.length);res.end(asset.data);}catch{res.writeHead(404);res.end('Not found');}return;}
    const file=assets[pathname]; if(!file) {res.writeHead(404);res.end('Not found');return;}
    try { const data=await readFile(join(root,file));res.setHeader('Content-Type',mime[file.split('.').pop()]);res.end(data); }
    catch {res.writeHead(404);res.end('Not found');}
  });
  const wss=new WebSocketServer({noServer:true,maxPayload:4096});
  const audioSnapshot=s=>({type:'snapshot',profile:{audio:{enabled:s.profile.audio.enabled,output:s.profile.audio.output}},alert:s.alert?{id:s.alert.id,startedAt:s.alert.startedAt,endsAt:s.alert.endsAt,audio:s.alert.audio}:null,serverTime:s.serverTime});
  server.on('upgrade',(req,socket,head)=>{
    const url=parse(req);
    if(!url || req.headers.host!==new URL(origin).host || url.pathname!=='/live' || url.searchParams.get('token')!==token || (req.headers.origin && req.headers.origin!==origin)) { socket.end('HTTP/1.1 403 Forbidden\r\n\r\n');return; }
    wss.handleUpgrade(req,socket,head,ws=>{ws.audioOnly=url.searchParams.get('audio')==='1';wss.emit('connection',ws);});
  });
  wss.on('connection',ws=>{ws.on('error',()=>{});const snapshot=hub.snapshot();ws.send(JSON.stringify(ws.audioOnly?audioSnapshot(snapshot):snapshot));});
  let lastAudioKey='';
  const broadcast=coalesce(()=>{if(!wss.clients.size)return;const snapshot=hub.snapshot();let data;const slim=audioSnapshot(snapshot),audioKey=JSON.stringify({...slim,serverTime:0}),audioChanged=audioKey!==lastAudioKey;lastAudioKey=audioKey;let audioData;
    for(const ws of wss.clients)if(ws.readyState===WebSocket.OPEN){if(ws.audioOnly&&!audioChanged)continue;if(ws.bufferedAmount>1024*1024)ws.terminate();else ws.send(ws.audioOnly?(audioData??=JSON.stringify(slim)):(data??=JSON.stringify(snapshot)));}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  origin=`http://127.0.0.1:${server.address().port}`;
  hub.on('change',broadcast);
  return {origin,async close(){hub.off('change',broadcast);broadcast.cancel();for(const ws of wss.clients)ws.terminate();wss.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}};
}
