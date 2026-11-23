import {_electron as electron} from 'playwright';
import {mkdtemp,mkdir,copyFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
const data=await mkdtemp(join(tmpdir(),'sidecast-real-expression-'));
await mkdir(join(data,'audio/voice'),{recursive:true});await copyFile(join(process.env.APPDATA,'Sidecast/audio/voice/reference.wav'),join(data,'audio/voice/reference.wav'));
const app=await electron.launch({...(process.env.SIDECAST_EXECUTABLE?{executablePath:resolve(process.env.SIDECAST_EXECUTABLE)}:{}),args:process.env.SIDECAST_EXECUTABLE?[]:['.'],env:{...process.env,SIDECAST_DATA_DIR:data,SIDECAST_SOURCE_PORT:'0'}});
try{
 await app.firstWindow();let page;for(let i=0;i<100;i++){page=app.windows().find(p=>p.url().includes('/index.html'));if(page)break;await new Promise(r=>setTimeout(r,100));}
 await page.getByRole('button',{name:'Alerts & Events',exact:true}).click();
 await page.getByRole('combobox',{name:'Speech engine',exact:true}).selectOption('chatterbox');
 const gain=page.getByRole('slider',{name:'Master audio volume',exact:true});await gain.fill('0');await gain.dispatchEvent('change');
 const expression=page.getByRole('slider',{name:'Expressiveness',exact:true});await expression.fill('75');await expression.dispatchEvent('change');
 await page.getByRole('textbox',{name:'Voice preview text'}).fill('Welcome balkn! Thank you for the raid!');
 await page.getByRole('button',{name:'Play voice preview',exact:true}).click();
 await page.locator('.speech-preview audio').waitFor({timeout:180000});await page.waitForFunction(()=>document.querySelector('.speech-preview audio')?.duration>0,null,{timeout:10000});
 const state=await page.evaluate(()=>window.sidecast.getState());assert.equal(state.settings.profiles[0].audio.engine,'chatterbox');assert.equal(state.settings.profiles[0].audio.expressiveness,75);assert.equal(state.audioStatus.error,'');assert.equal(state.snapshot.alert,null);assert.equal(state.audioStatus.chatterboxLoaded,true);
 assert.ok(await page.locator('.speech-preview audio').evaluate(a=>a.src.startsWith('data:audio/wav;base64,')&&a.duration>1));
 await page.getByRole('button',{name:'Stop preview',exact:true}).click();assert.equal(await page.locator('.speech-preview audio').count(),0);
 console.log('PASS: real Chatterbox voice preview through Electron IPC and packaged worker, 75% expression, muted local audio, shared private reference, no overlay event, Stop works');
}finally{await app.close();}
