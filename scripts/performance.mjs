import { _electron as electron } from 'playwright';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocketServer } from 'ws';
import { once } from 'node:events';
import assert from 'node:assert/strict';

const fixture=new WebSocketServer({port:0,host:'127.0.0.1'});await once(fixture,'listening');
let upstream;
fixture.on('connection',ws=>{upstream=ws;ws.send(JSON.stringify({request:'Hello',info:{version:'1.0.1'}}));ws.on('message',raw=>{const r=JSON.parse(raw);ws.send(JSON.stringify({id:r.id,status:'ok',info:{version:'1.0.1'},events:{Twitch:['ChatMessage','Follow']}}));});});
const data=await mkdtemp(join(tmpdir(),'sidecast-perf-'));
const app=await electron.launch({args:['.'],env:{...process.env,SIDECAST_DATA_DIR:data,SIDECAST_SOURCE_PORT:'0'}});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try {
 await app.firstWindow();let page;
 for(let i=0;i<100;i++){page=app.windows().find(w=>w.url().includes('/index.html'));if(page)break;await sleep(100);}
 await page.waitForFunction(()=>!!window.sidecast);
 await page.evaluate(async port=>{const state=await window.sidecast.getState();state.settings.connection.port=port;state.settings.profiles[0].fadeSeconds=0;await window.sidecast.saveSettings(state.settings);await window.sidecast.connection('connect');},fixture.address().port);
 await page.waitForFunction(async()=>(await window.sidecast.getState()).snapshot.status.state==='connected');
 const cdp=await page.context().newCDPSession(page);await cdp.send('Performance.enable');
 const metrics=async()=>Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
 await sleep(1000);
 await page.evaluate(()=>{window.__perf={updates:0,mutations:0};window.sidecast.onState(()=>window.__perf.updates++);new MutationObserver(m=>window.__perf.mutations+=m.length).observe(document.querySelector('.preview-stage'),{subtree:true,attributes:true,childList:true,characterData:true});});
 const idleStart=await metrics();await sleep(3000);const idleEnd=await metrics();const idle=await page.evaluate(()=>({...window.__perf}));
 await page.evaluate(()=>{window.__perf.updates=0;window.__perf.mutations=0;});
 const busyStart=await metrics();const started=Date.now();
 for(let batch=0;batch<20;batch++){
  for(let n=0;n<50;n++){const id=batch*50+n;upstream.send(JSON.stringify({event:{source:'Twitch',type:'ChatMessage'},data:{messageId:`load-${id}`,user:{name:'balkn',id:'load-user'},text:`Load message ${id}`}}));}
  await sleep(25);
 }
 await page.waitForFunction(()=>document.querySelector('.chat-stack')?.textContent.includes('Load message 999'),{timeout:20000});
 const catchupMs=Date.now()-started;await sleep(500);const busyEnd=await metrics();
 const busy=await page.evaluate(()=>({...window.__perf}));
 const state=await page.evaluate(()=>window.sidecast.getState());assert.equal(state.snapshot.messages.length,200);assert.equal(state.snapshot.received,1000);
 const result={label:process.argv[2]||'run',events:1000,catchupMs,idle:{...idle,seconds:3,rendererTaskMs:Math.round((idleEnd.TaskDuration-idleStart.TaskDuration)*1000)},busy:{...busy,rendererTaskMs:Math.round((busyEnd.TaskDuration-busyStart.TaskDuration)*1000)},processes:await app.evaluate(({app})=>app.getAppMetrics().map(p=>({type:p.type,workingSetKB:p.memory.workingSetSize})))};
 await mkdir('test-results',{recursive:true});await writeFile(`test-results/performance-${result.label}.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
} finally {await app.close();for(const ws of fixture.clients)ws.terminate();await new Promise(r=>fixture.close(r));}
