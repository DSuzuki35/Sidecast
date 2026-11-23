import {_electron as electron} from 'playwright';
import {mkdtemp} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {once} from 'node:events';
import {WebSocketServer} from 'ws';
import assert from 'node:assert/strict';
const fixture=new WebSocketServer({port:0,host:'127.0.0.1'});await once(fixture,'listening');
fixture.on('connection',ws=>{ws.send(JSON.stringify({request:'Hello',info:{version:'1.0.4'}}));ws.on('message',raw=>{const r=JSON.parse(raw);ws.send(JSON.stringify({id:r.id,status:'ok',info:{version:'1.0.4'},events:{Twitch:['ReSub'],YouTube:['SuperChat']}}));});});
const data=await mkdtemp(join(tmpdir(),'sidecast-attached-message-'));
const app=await electron.launch({...(process.env.SIDECAST_EXECUTABLE?{executablePath:resolve(process.env.SIDECAST_EXECUTABLE)}:{}),args:process.env.SIDECAST_EXECUTABLE?[]:['.'],env:{...process.env,SIDECAST_DATA_DIR:data,SIDECAST_SOURCE_PORT:'0'}});
try{
 await app.firstWindow();let page;for(let i=0;i<100;i++){page=app.windows().find(p=>p.url().includes('/index.html'));if(page)break;await new Promise(r=>setTimeout(r,100));}
 await page.getByRole('heading',{name:'Your stream. Your style.'}).waitFor();
 // Capture exactly what reaches the AI worker; no GPU, personal reference or audible playback in this UI check.
 await app.evaluate(async({app},data)=>{
  const {join}=process.getBuiltinModule('path');const {mkdir,writeFile}=process.getBuiltinModule('fs/promises');
  const require=process.getBuiltinModule('module').createRequire(join(app.getAppPath(),'package.json'));const {AudioService}=require('./src/audio-service.js');
  const b=Buffer.alloc(44+4800);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(24000,24);b.writeUInt32LE(48000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(4800,40);
  await mkdir(join(data,'audio/voice'),{recursive:true});await writeFile(join(data,'audio/voice/reference.wav'),b);
  globalThis.__expressionRequests=[];AudioService.prototype.requestChatterbox=async function(request){globalThis.__expressionRequests.push({text:request.text,expressiveness:request.expressiveness});await writeFile(request.output,b);return {ok:true};};
  globalThis.__speechRequests=[];AudioService.prototype.requestQwen=async function(request){globalThis.__speechRequests.push(request.text);await writeFile(request.output,b);return {ok:true};};
 },data);
 await page.evaluate(async port=>{const s=await window.sidecast.getState(),p=s.settings.profiles[0];Object.assign(p,{theme:'vice',fontSize:18,topAligned:true,alertPlacement:'both',fadeSeconds:0});Object.assign(p.audio,{enabled:true,engine:'qwen',volume:0});Object.assign(p.audio.types.resub,{speak:true,sound:'none'});p.alertDurations.resub=30;s.settings.connection.port=port;await window.sidecast.saveSettings(s.settings);await window.sidecast.connection('connect');},fixture.address().port);
 await page.waitForFunction(async()=>(await window.sidecast.getState()).snapshot.status.state==='connected');
 const state=await page.evaluate(()=>window.sidecast.getState());const outputs={};
 for(const [mode,width,height] of [['chat',400,700],['alerts',1920,1080]]){const created=app.waitForEvent('window');await app.evaluate(({BrowserWindow},{url,width,height})=>{new BrowserWindow({width,height,show:false,webPreferences:{sandbox:true,backgroundThrottling:false}}).loadURL(url);},{url:state.urls[mode],width,height});outputs[mode]=await created;await outputs[mode].waitForFunction(()=>!!document.querySelector('.chat-stack'));}
 const message='One whole year together! Thanks for the late-night streams, the good laughs, and all the help with getting started in sim racing. That last race was incredible, especially the final lap. I am looking forward to many more races with this community. Keep doing what you do, balkn! A big hello to everyone watching on Twitch and YouTube tonight. Let us make the next twelve months just as much fun. This final sentence must still be visible and read aloud. 🏁 <script>literal text</script>';
 for(const ws of fixture.clients)ws.send(JSON.stringify({event:{source:'Twitch',type:'ReSub'},data:{messageId:'full-sub',user:{name:'balkn',id:'42'},cumulativeMonths:12,text:message}}));
 for(const output of [page,outputs.chat,outputs.alerts]){await output.locator('.alert-message').waitFor();assert.equal(await output.locator('.alert-message').textContent(),message);assert.equal(await output.locator('.alert-message script').count(),0);}
 assert.equal((await app.evaluate(()=>globalThis.__speechRequests))[0],`Welcome back balkn. 12 months. ${message}`);
 assert.equal(await outputs.chat.locator('.chat-alert-message .message-body').textContent(),`12 months\n${message}`);
 const layout=await outputs.chat.locator('.alert-message').evaluate(e=>{const r=e.getBoundingClientRect();return {right:r.right,bottom:r.bottom,width:innerWidth,height:innerHeight,scroll:e.scrollWidth,client:e.clientWidth};});assert.ok(layout.right<=layout.width&&layout.bottom<=layout.height&&layout.scroll<=layout.client+1,JSON.stringify(layout));
 assert.equal(await outputs.chat.locator('.centered-alert-slot').isVisible(),false);
 if(!process.env.SIDECAST_EXECUTABLE){await outputs.chat.screenshot({path:'test-results/full-sub-message-chat.png',omitBackground:true});await outputs.alerts.screenshot({path:'test-results/full-sub-message-alert.png',omitBackground:true});}
 // Test button uses the same message-to-speech path even if automatic speech is disabled.
 await page.evaluate(async()=>{await window.sidecast.testEvent('clear');const s=await window.sidecast.getState();s.settings.profiles[0].audio.types.sub.speak=false;s.settings.profiles[0].audio.types.sub.sound='none';await window.sidecast.saveSettings(s.settings);await window.sidecast.testEvent('sub');});
 await outputs.chat.locator('.alert-card[data-alert="sub"] .alert-message').waitFor();const testMessage=await outputs.chat.locator('.alert-message').textContent();const requests=await app.evaluate(()=>globalThis.__speechRequests);assert.ok(requests.at(-1).endsWith(testMessage));
 assert.ok((await page.evaluate(()=>window.sidecast.getState())).snapshot.alert.audio.duration>0);
 await page.evaluate(()=>window.sidecast.testEvent('clear'));await page.reload();await page.getByRole('button',{name:'Alerts & Events',exact:true}).click();
 await page.getByRole('combobox',{name:'Speech engine',exact:true}).selectOption('chatterbox');
 const expression=page.getByRole('slider',{name:'Expressiveness',exact:true});await expression.waitFor();await expression.fill('75');await expression.dispatchEvent('change');
 await page.waitForFunction(async()=>(await window.sidecast.getState()).settings.profiles[0].audio.expressiveness===75);
 await page.getByRole('textbox',{name:'Voice preview text'}).fill('Welcome balkn! Let us celebrate!');await page.getByRole('button',{name:'Play voice preview',exact:true}).click();await page.locator('.speech-preview audio').waitFor();
 assert.deepEqual(await app.evaluate(()=>globalThis.__expressionRequests.at(-1)),{text:'Welcome balkn! Let us celebrate!',expressiveness:75});
 await page.reload();await page.getByRole('button',{name:'Alerts & Events',exact:true}).click();assert.equal(await page.getByRole('slider',{name:'Expressiveness',exact:true}).inputValue(),'75');
 await page.getByRole('combobox',{name:'Speech engine',exact:true}).selectOption('qwen');assert.equal(await page.getByRole('slider',{name:'Expressiveness',exact:true}).isVisible(),false);
 console.log('PASS: full >400-character Streamer.bot message in chat/compact/fullscreen/preview, literal HTML and emoji, complete AI request, narrow layout, and Test button speech');
}finally{await app.close();for(const ws of fixture.clients)ws.terminate();await new Promise(r=>fixture.close(r));}
