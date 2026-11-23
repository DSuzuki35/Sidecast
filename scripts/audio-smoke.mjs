import {_electron as electron} from 'playwright';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const data=await mkdtemp(join(tmpdir(),'sidecast-audio-ui-'));
const app=await electron.launch({...(process.env.SIDECAST_EXECUTABLE?{executablePath:process.env.SIDECAST_EXECUTABLE}:{}),args:process.env.SIDECAST_EXECUTABLE?[]:['.'],env:{...process.env,SIDECAST_DATA_DIR:data,SIDECAST_SOURCE_PORT:'0'},timeout:20000});
async function pageFor(match){for(let i=0;i<120;i++){const page=app.windows().find(p=>match(p.url()));if(page)return page;await new Promise(r=>setTimeout(r,100));}throw Error('Missing test window');}
async function observe(player){await player.evaluate(()=>{window.playCount=0;window.gainValues=[];const Native=window.AudioContext;window.AudioContext=class extends Native{createGain(){const gain=super.createGain();window.gainValues.push(gain);return gain;}};const original=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){window.playCount++;this.muted=true;return original.call(this);};});}
async function until(check){const deadline=Date.now()+15000;while(!await check()){if(Date.now()>deadline)throw Error('Audio state timed out');await new Promise(r=>setTimeout(r,50));}}
try{
 await app.firstWindow();const page=await pageFor(u=>u.includes('/index.html'));await page.waitForFunction(()=>!!window.sidecast);
 assert.equal(app.windows().filter(p=>p.url().includes('/audio?')).length,0,'Disabled audio must not allocate a player renderer');
 await page.evaluate(async()=>{const s=await window.sidecast.getState();const p=s.settings.profiles[0];p.audio.enabled=true;p.audio.volume=0;p.audio.types.follow.speak=true;p.audio.types.follow.template='Hello balkn.';p.alertDurations.follow=3;await window.sidecast.saveSettings(s.settings);});
 const desktop=await pageFor(u=>u.includes('/audio?')&&u.includes('desktop=1'));await observe(desktop);
 await page.evaluate(async()=>{await window.sidecast.testEvent('follow');await window.sidecast.testEvent('follow');});
 await desktop.waitForFunction(()=>document.body.dataset.state==='playing');
 await until(()=>page.evaluate(async()=>{const s=(await window.sidecast.getState()).snapshot;return !s.alert&&!s.queued;}));
 assert.equal(await desktop.evaluate(()=>window.playCount),4,'Two alerts play one sound and one speech clip each');
 const audioUrl=await page.evaluate(async()=>{const s=await window.sidecast.getState();s.settings.profiles[0].audio.output='obs';s.settings.profiles[0].audio.volume=150;return (await window.sidecast.saveSettings(s.settings)).urls.audio;});
 await app.evaluate(async({BrowserWindow},url)=>{const win=new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,autoplayPolicy:'no-user-gesture-required'}});await win.loadURL(url);},audioUrl);
 const obs=await pageFor(u=>u===audioUrl);await observe(obs);assert.equal(await obs.evaluate(()=>typeof window.sidecast),'undefined');
 assert.equal(app.windows().filter(p=>p.url().includes('/audio?')&&p.url().includes('desktop=1')).length,0);
 await page.evaluate(()=>window.sidecast.testEvent('follow'));await obs.waitForFunction(()=>document.body.dataset.state==='playing');
 await until(()=>page.evaluate(async()=>(await window.sidecast.getState()).snapshot.alert===null));assert.equal(await obs.evaluate(()=>window.playCount),2);assert.ok(Math.abs((await obs.evaluate(()=>window.gainValues.at(-1).gain.value))-1.2)<0.0001);
 await page.getByRole('button',{name:'Alerts & Events',exact:true}).click();await page.screenshot({path:'test-results/audio-settings.png',fullPage:true,animations:'disabled'});
 console.log('PASS: lazy audio renderer, sequential sound+Windows TTS, zero duplicate playback, OBS-only output, and protected audio source');
}finally{await app.close();}
