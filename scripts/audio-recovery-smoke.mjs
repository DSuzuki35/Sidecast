import {_electron as electron} from 'playwright';
import {mkdtemp,readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
const data=await mkdtemp(join(tmpdir(),'sidecast-audio-recovery-'));
const app=await electron.launch({...(process.env.SIDECAST_EXECUTABLE?{executablePath:resolve(process.env.SIDECAST_EXECUTABLE)}:{}),args:process.env.SIDECAST_EXECUTABLE?[]:['.'],env:{...process.env,SIDECAST_DATA_DIR:data,SIDECAST_SOURCE_PORT:'0'}});
try{
 await app.firstWindow();let page;
 for(let i=0;i<100;i++){page=app.windows().find(p=>p.url().includes('/index.html'));if(page)break;await new Promise(r=>setTimeout(r,100));}
 await page.waitForFunction(()=>!!window.sidecast);
 await app.evaluate(({BrowserWindow})=>{
  globalThis.originalAudioLoad=BrowserWindow.prototype.loadURL;globalThis.audioFailures=1;globalThis.audioAttempts=0;
  BrowserWindow.prototype.loadURL=function(url,...args){if(url.includes('/audio?')){globalThis.audioAttempts++;if(globalThis.audioFailures-->0)return Promise.reject(Object.assign(Error('injected initial load failure'),{code:'ERR_FAILED',errno:-2}));}return globalThis.originalAudioLoad.call(this,url,...args);};
 });
 const save=enabled=>page.evaluate(async enabled=>{const s=await window.sidecast.getState();s.settings.profiles[0].audio.enabled=enabled;s.settings.profiles[0].audio.volume=0;return window.sidecast.saveSettings(s.settings);},enabled);
 const recovered=await save(true);assert.equal(recovered.audioStatus.error,'');
 assert.equal(await app.evaluate(()=>globalThis.audioAttempts),2);
 assert.equal(JSON.parse(await readFile(join(data,'settings.json'),'utf8')).settings.profiles[0].audio.enabled,true);
 assert.equal(app.windows().filter(p=>p.url().includes('/audio?')).length,1);
 await save(false);await app.evaluate(()=>{globalThis.audioFailures=Infinity;});
 const failed=await save(true);assert.match(failed.audioStatus.error,/audio playback/i);assert.equal(failed.serverError,'');
 assert.equal(JSON.parse(await readFile(join(data,'settings.json'),'utf8')).settings.profiles[0].audio.enabled,true);
 assert.equal(app.windows().filter(p=>p.url().includes('/audio?')).length,0);
 await app.evaluate(()=>{globalThis.audioFailures=0;});const retried=await save(true);assert.equal(retried.audioStatus.error,'');
 assert.equal(app.windows().filter(p=>p.url().includes('/audio?')).length,1);
 const changedPort=await page.evaluate(async()=>{const s=await window.sidecast.getState();s.settings.sourcePort++;return window.sidecast.saveSettings(s.settings);});
 assert.notEqual(changedPort.urls.audio,retried.urls.audio);assert.equal(changedPort.serverError,'');assert.equal(changedPort.audioStatus.error,'');
 assert.equal(app.windows().filter(p=>p.url()===changedPort.urls.audio+'&desktop=1').length,1);
 console.log('PASS: initial ERR_FAILED retries, persistent failure preserves settings and reports audio-only error, next save recovers');
}finally{await app.close();}
