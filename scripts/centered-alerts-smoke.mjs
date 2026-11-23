import {_electron as electron} from 'playwright';
import {mkdtemp} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
const data=await mkdtemp(join(tmpdir(),'sidecast-centered-'));
const app=await electron.launch({...(process.env.SIDECAST_EXECUTABLE?{executablePath:resolve(process.env.SIDECAST_EXECUTABLE)}:{}),args:process.env.SIDECAST_EXECUTABLE?[]:['.'],env:{...process.env,SIDECAST_DATA_DIR:data,SIDECAST_SOURCE_PORT:'0'}});
try{
 await app.firstWindow();let page;for(let i=0;i<100;i++){page=app.windows().find(p=>p.url().includes('/index.html'));if(page)break;await new Promise(r=>setTimeout(r,100));}
 await page.waitForFunction(()=>!!window.sidecast);await page.getByRole('button',{name:'Alerts & Events',exact:true}).click();
 await page.getByRole('combobox',{name:'Alert placement',exact:true}).selectOption('center');
 const state=await page.evaluate(()=>window.sidecast.getState());assert.equal(state.settings.profiles[0].alertPlacement,'center');
 const created=app.waitForEvent('window');await app.evaluate(({BrowserWindow},url)=>{new BrowserWindow({show:false,webPreferences:{sandbox:true,backgroundThrottling:false}}).loadURL(url);},state.urls.alerts);const source=await created;await source.setViewportSize({width:1920,height:1080});
 await page.evaluate(async()=>{const s=await window.sidecast.getState();s.settings.profiles[0].alertDurations.raid=30;await window.sidecast.saveSettings(s.settings);await window.sidecast.testEvent('raid');});await source.locator('.alert-card').waitFor();
 await source.addStyleTag({content:'*,*::before,*::after{animation:none!important}'});
 const backgrounds=[];
 for(const theme of ['grid','endurance','vice','minimal']){
  await page.evaluate(async theme=>{const s=await window.sidecast.getState();s.settings.profiles[0].theme=theme;await window.sidecast.saveSettings(s.settings);},theme);
  await source.waitForFunction(t=>document.querySelector('.overlay-content').dataset.theme===t,theme);
  const box=await source.locator('.alert-card').boundingBox();assert.ok(Math.abs(box.x+box.width/2-960)<2);assert.ok(Math.abs(box.y+box.height/2-540)<2);
  assert.deepEqual(await source.locator('.alert-card').evaluate(n=>{const s=getComputedStyle(n);return [s.backgroundColor,s.borderTopWidth,s.boxShadow];}),['rgba(0, 0, 0, 0)','0px','none']);
  assert.equal(await source.locator('.centered-alert-slot .alert-name').evaluate(n=>getComputedStyle(n).fontSize),'76px',theme+' fullscreen name must scale');
  backgrounds.push(await source.locator('.centered-alert-slot').evaluate(n=>getComputedStyle(n).background));
 }
 assert.equal(new Set(backgrounds).size,4);
 // Hidden packaged Chromium can defer captures until the alert expires; source screenshots are inspected separately.
 if(!process.env.SIDECAST_EXECUTABLE)await source.screenshot({path:'test-results/centered-minimal.png',animations:'disabled',omitBackground:true});
 await source.setViewportSize({width:280,height:650});const narrow=await source.locator('.alert-card').boundingBox();assert.ok(narrow.x>=0&&narrow.x+narrow.width<=280);
 await page.evaluate(()=>window.sidecast.testEvent('clear'));await source.locator('.centered-alert-slot').waitFor({state:'hidden'});
 console.log('PASS: centered alerts at 1920x1080, four themed backgrounds, narrow 280px fit and fully hidden idle backdrop');
}finally{await app.close();}
