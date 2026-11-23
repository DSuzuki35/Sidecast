import {_electron as electron} from 'playwright';
import {mkdtemp} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {WebSocketServer} from 'ws';
import {once} from 'node:events';
import assert from 'node:assert/strict';
const fixture=new WebSocketServer({port:0,host:'127.0.0.1'});await once(fixture,'listening');let upstream;
fixture.on('connection',ws=>{upstream=ws;ws.send(JSON.stringify({request:'Hello',info:{version:'1.0.4'}}));ws.on('message',raw=>{const r=JSON.parse(raw);ws.send(JSON.stringify({id:r.id,status:'ok',events:{Twitch:['ChatMessage','ChatMessageDeleted']}}));});});
const data=await mkdtemp(join(tmpdir(),'sidecast-emotes-'));
const app=await electron.launch({...(process.env.SIDECAST_EXECUTABLE?{executablePath:resolve(process.env.SIDECAST_EXECUTABLE)}:{}),args:process.env.SIDECAST_EXECUTABLE?[]:['.'],env:{...process.env,SIDECAST_DATA_DIR:data,SIDECAST_SOURCE_PORT:'0'}});
try{
 await app.firstWindow();let page;for(let i=0;i<100;i++){page=app.windows().find(p=>p.url().includes('/index.html'));if(page)break;await new Promise(r=>setTimeout(r,100));}
 await page.getByRole('heading',{name:'Your stream. Your style.'}).waitFor();
 // Deterministic provider responses pass through the real normalizer, service and WebSocket render path.
 await app.evaluate(()=>{
  const native=globalThis.fetch;globalThis.__emoteRequests=0;
  const gate=new Promise(r=>globalThis.__releaseEmotes=r);
  globalThis.fetch=async(url,options)=>{
   if(!/^https:\/\/(api\.betterttv\.net|api\.frankerfacez\.com|7tv\.io)\//.test(String(url)))return native(url,options);
   globalThis.__emoteRequests++;await gate;let data=null;
   if(String(url).endsWith('emotes/global'))data=[{id:'bttv-fixture',code:'BTTVWave'}];
   if(String(url).endsWith('set/global'))data={default_sets:[1],sets:{1:{emoticons:[{name:'FFZDance',animated:{2:'https://cdn.frankerfacez.com/emote/1/animated/2'}}]}}};
   if(String(url).includes('7tv.io'))data=String(url).endsWith('emote-sets/global')?{emotes:[{name:'SevenHat',flags:1,data:{host:{url:'//cdn.7tv.app/emote/hat',files:[{name:'2x.webp'}]}}}]}:{emote_set:{emotes:[{name:'ChannelWave',data:{host:{url:'//cdn.7tv.app/emote/channel',files:[{name:'2x.webp'}]}}}]}};
   return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
  };
 });
 await app.evaluate(({protocol})=>protocol.handle('https',()=>new Response('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" rx="6" fill="#c0f492"/></svg>',{headers:{'Content-Type':'image/svg+xml'}})));
 const state=await page.evaluate(async port=>{const s=await window.sidecast.getState();s.settings.connection.port=port;await window.sidecast.saveSettings(s.settings);await window.sidecast.connection('connect');await window.sidecast.windowAction('show');await window.sidecast.windowAction('lock');return window.sidecast.getState();},fixture.address().port);
 for(let i=0;i<100;i++){if((await page.evaluate(()=>window.sidecast.getState())).snapshot.status.state==='connected')break;await new Promise(r=>setTimeout(r,50));}
 const created=app.waitForEvent('window');await app.evaluate(({BrowserWindow},url)=>{new BrowserWindow({show:false,webPreferences:{sandbox:true,backgroundThrottling:false}}).loadURL(url);},state.urls.combined);const source=await created;
 const desktop=app.windows().find(p=>p.url().includes('desktop=1'));
 const send=(id,text,emotes=[])=>upstream.send(JSON.stringify({event:{source:'Twitch',type:'ChatMessage'},data:{messageId:id,text,broadcaster:{id:'123'},user:{id:'7',name:'balkn'},emotes}}));
 send('plain','Plain 🙂 text');send('emotes','Kappa BTTVWave FFZDance ChannelWave SevenHat',[{id:'25',StartIndex:0,EndIndex:4}]);send('deleted','BTTVWave');
 await source.locator('[data-id="twitch:emotes"] .emote').waitFor();assert.equal(await source.locator('[data-id="twitch:emotes"] .emote').count(),1,'Native emote must render before catalogs finish');
 await source.evaluate(()=>window.__plain=document.querySelector('[data-id="twitch:plain"]'));
 upstream.send(JSON.stringify({event:{source:'Twitch',type:'ChatMessageDeleted'},data:{messageId:'deleted'}}));await source.locator('[data-id="twitch:deleted"]').waitFor({state:'detached'});
 await app.evaluate(()=>globalThis.__releaseEmotes());
 for(const output of [source,desktop,page]){
  try{await output.waitForFunction(()=>document.querySelectorAll('[data-id="twitch:emotes"] .emote').length===5,null,{timeout:10000});}catch(e){console.error('EMOTE DIAGNOSTIC',output===source?'source':output===desktop?'desktop':'preview',await output.locator('[data-id="twitch:emotes"] .message-body').innerHTML(),(await page.evaluate(()=>window.sidecast.getState())).snapshot.messages.find(m=>m.id==='twitch:emotes'),await app.evaluate(()=>globalThis.__emoteRequests));throw e;}
  assert.equal(await output.locator('[data-id="twitch:emotes"] .emote-layer').count(),1);
  assert.equal(await output.locator('[data-id="twitch:emotes"] .emote-stack').count(),4);
  assert.equal(await output.locator('[data-id="twitch:deleted"]').count(),0);
 }
 assert.equal(await source.evaluate(()=>window.__plain.isConnected),true,'Catalog refresh must preserve unaffected message DOM');
 assert.equal(await app.evaluate(()=>globalThis.__emoteRequests),6);
 const geometry=await source.locator('[data-id="twitch:emotes"] .emote-layer').evaluate(n=>{const layer=n.getBoundingClientRect(),base=n.parentElement.firstChild.getBoundingClientRect();return {center:layer.x+layer.width/2,baseCenter:base.x+base.width/2,position:getComputedStyle(n).position};});assert.ok(Math.abs(geometry.center-geometry.baseCenter)<1);assert.equal(geometry.position,'absolute');
 // Whole-token matching and broken CDN fallback remain readable.
 send('literal','BTTVWaveX <img>');await source.locator('[data-id="twitch:literal"]').waitFor();assert.equal(await source.locator('[data-id="twitch:literal"] img').count(),0);
 await source.locator('[data-id="twitch:emotes"] .emote').first().dispatchEvent('error');assert.match(await source.locator('[data-id="twitch:emotes"] .message-body').innerText(),/Kappa/);
 await page.locator('.preview-stage').screenshot({path:'test-results/emotes-preview.png',animations:'disabled'});
 console.log('PASS: native Twitch + BTTV/FFZ/7TV global/channel emotes, late enrichment, zero-width stacking, six cached requests, stable nodes, moderation, literal text and broken-image fallback in desktop/browser/preview');
}finally{await app.close();for(const ws of fixture.clients)ws.terminate();await new Promise(r=>fixture.close(r));}
