import {_electron as electron} from 'playwright';
import {mkdtemp} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
const data=await mkdtemp(join(tmpdir(),'sidecast-preview-'));
const app=await electron.launch({...(process.env.SIDECAST_EXECUTABLE?{executablePath:resolve(process.env.SIDECAST_EXECUTABLE)}:{}),args:process.env.SIDECAST_EXECUTABLE?[]:['.'],env:{...process.env,SIDECAST_DATA_DIR:data,SIDECAST_SOURCE_PORT:'0'}});
try{
 await app.firstWindow();let page;for(let i=0;i<100;i++){page=app.windows().find(p=>p.url().includes('/index.html'));if(page)break;await new Promise(r=>setTimeout(r,100));}
 await page.waitForFunction(()=>!!window.sidecast);await page.getByRole('button',{name:'Alerts & Events',exact:true}).click();
 await page.evaluate(()=>{window.__gains=[];const Native=window.AudioContext;window.AudioContext=class extends Native{createGain(){const gain=super.createGain();window.__gains.push(gain);return gain;}};const original=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){this.muted=true;return original.call(this);};});
 const master=page.getByRole('slider',{name:'Master audio volume',exact:true});assert.equal(await master.getAttribute('max'),'150');await master.fill('150');await master.dispatchEvent('change');
 await page.getByRole('textbox',{name:'Voice preview text'}).fill('Hello balkn. This is my local voice preview.');
 await page.getByRole('button',{name:'Play voice preview',exact:true}).click();await page.locator('#speech-preview-status').filter({hasText:'Playing voice preview locally.'}).waitFor();
 assert.equal(await page.evaluate(()=>window.__gains.at(-1).gain.value),1.5);assert.equal(await page.locator('.speech-preview audio').evaluate(a=>a.volume),1);
 const state=await page.evaluate(()=>window.sidecast.getState());assert.equal(state.settings.profiles[0].audio.enabled,false);assert.equal(state.snapshot.alert,null);assert.equal(state.snapshot.queued,0);
 await page.screenshot({path:'test-results/speech-preview.png',fullPage:true,animations:'disabled'});
 await page.getByRole('button',{name:'Stop preview',exact:true}).click();assert.equal(await page.locator('.speech-preview audio').count(),0);
 await page.evaluate(async()=>{const s=await window.sidecast.getState();s.settings.profiles[0].audio.enabled=true;s.settings.profiles[0].audio.volume=0;s.settings.profiles[0].audio.types.follow.speak=false;s.settings.profiles[0].audio.types.follow.sound='none';await window.sidecast.saveSettings(s.settings);});
 await page.evaluate(()=>window.sidecast.testEvent('follow'));
 for(let i=0;i<100;i++){const s=await page.evaluate(()=>window.sidecast.getState());if(s.snapshot.alert){assert.equal(s.snapshot.alert.audio.clips.length,1);assert.equal(s.settings.profiles[0].audio.types.follow.speak,false);break;}if(i===99)throw Error('Speech test did not start');await new Promise(r=>setTimeout(r,100));}
 const invalid=await page.evaluate(async()=>{try{await window.sidecast.audioAction('preview',' ');return false;}catch{return true;}});assert.equal(invalid,true);
 console.log('PASS: custom text speaks locally with audio off, 150% gain is applied, Stop works, alert Test includes speech without changing live toggles');
}finally{await app.close();}
