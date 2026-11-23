import {_electron as electron} from 'playwright';
import {mkdtemp,readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';

const data=await mkdtemp(join(tmpdir(),'sidecast-appearance-'));
const launch={...(process.env.SIDECAST_EXECUTABLE?{executablePath:resolve(process.env.SIDECAST_EXECUTABLE)}:{}),args:process.env.SIDECAST_EXECUTABLE?[]:['.'],env:{...process.env,SIDECAST_DATA_DIR:data,SIDECAST_SOURCE_PORT:'0'}};
let app=await electron.launch(launch);
const pause=()=>new Promise(r=>setTimeout(r,100));
async function control(){await app.firstWindow();for(let i=0;i<100;i++){const p=app.windows().find(p=>p.url().includes('/index.html'));if(p){await p.locator('#appearance-target').waitFor();return p;}await pause();}throw Error('Control page missing');}
async function saved(page){await page.locator('#save-status').filter({hasText:'Saved'}).waitFor();}
async function slider(page,id,value){await page.locator(id).evaluate((n,value)=>{n.value=value;n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new Event('change',{bubbles:true}));},String(value));await saved(page);}
try{
 const page=await control();page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.locator('#appearance-linked').uncheck();await saved(page);
 await page.getByRole('button',{name:'Select Vice',exact:true}).click();await saved(page);
 await page.locator('[data-profile="topAligned"]').check();await saved(page);
 await slider(page,'#fontSize',32);
 await page.locator('#appearance-target').selectOption('browser');
 await page.getByRole('button',{name:'Select Minimal',exact:true}).click();await saved(page);
 await slider(page,'#fontSize',14);
 await page.getByRole('button',{name:'Alerts & Events',exact:true}).click();
 assert.equal(await page.locator('#appearance-target').inputValue(),'browser');
 await page.getByRole('combobox',{name:'Alert placement',exact:true}).selectOption('both');await saved(page);
 await slider(page,'#duration-raid',30);
 const state=await page.evaluate(()=>window.sidecast.getState());
 const created=app.waitForEvent('window');await app.evaluate(({BrowserWindow},url)=>{new BrowserWindow({width:400,height:650,show:false,webPreferences:{sandbox:true,backgroundThrottling:false}}).loadURL(url);},state.urls.combined);const source=await created;
 await page.evaluate(async()=>{await window.sidecast.windowAction('show');await window.sidecast.windowAction('lock');});
 const desktop=app.windows().find(p=>p.url().includes('desktop=1'));
 await desktop.locator('.chat-heading').waitFor();await source.waitForFunction(()=>document.querySelector('.overlay-content')?.dataset.theme==='minimal');
 assert.equal(await desktop.locator('.overlay-content').getAttribute('data-theme'),'vice');
 assert.equal(await desktop.locator('.chat-heading').evaluate(n=>getComputedStyle(n).fontSize),'24px');
 assert.equal(await source.locator('.chat-box').isVisible(),false);
 const headerY=(await desktop.locator('.chat-heading').boundingBox()).y;
 const stableHeader=async()=>assert.ok(Math.abs((await desktop.locator('.chat-heading').boundingBox()).y-headerY)<1,'Top-aligned title must stay fixed');
 for(let i=1;i<=12;i++){
  await page.evaluate(()=>window.sidecast.testEvent('chat'));
  await source.waitForFunction(count=>document.querySelectorAll('.chat-message').length===count,Math.min(i*3,30));
  await desktop.waitForFunction(count=>document.querySelectorAll('.chat-message').length===count,Math.min(i*3,30));
  await stableHeader();
 }
 assert.deepEqual(await desktop.locator('.chat-message').allTextContents(),await source.locator('.chat-message').allTextContents());
 await page.evaluate(()=>window.sidecast.testEvent('raid'));await desktop.locator('.alert-card').waitFor();await source.locator('.alert-card').waitFor();await stableHeader();
 assert.equal(await desktop.locator('.overlay-content').getAttribute('data-alert-placement'),'inline');assert.equal(await source.locator('.overlay-content').getAttribute('data-alert-placement'),'inline');
 assert.equal(await desktop.locator('.alert-name').innerText(),await source.locator('.alert-name').innerText());
 await page.evaluate(()=>window.sidecast.testEvent('clear'));await source.locator('.chat-box').waitFor({state:'hidden'});await stableHeader();
 // Check every heading scales, and wraps within a narrow source with both viewer counters.
 const sizes=await source.evaluate(async profile=>{
  const {createOverlay}=await import('./shared.js');const box=document.createElement('div');box.className='overlay-content';box.style.cssText='width:280px;height:650px';document.body.append(box);const view=createOverlay(box);
  const results=[];
  for(const theme of ['grid','endurance','vice','minimal']){
   const pair=[];for(const fontSize of [16,32]){
    view.update({profile:{...profile,appearance:undefined,theme,fontSize,topAligned:true,viewerCounts:{enabled:true,platforms:{twitch:true,youtube:true}}},messages:[],alert:null,viewers:{twitch:12345,youtube:6789}});
    const heading=box.querySelector('.chat-heading');pair.push(parseFloat(getComputedStyle(heading).fontSize));
    if(heading.scrollWidth>heading.clientWidth+1)throw Error(theme+' heading overflow');
   }results.push(pair);
  }
  // Fading the last message must leave the title pinned.
  const now=Date.now();view.update({profile:{...profile,appearance:undefined,topAligned:true,fadeSeconds:1,viewerCounts:{enabled:false}},serverTime:now,messages:[{id:'fade',platform:'twitch',name:'balkn',text:'bye',time:now-800,badges:[],fragments:[]}],alert:null});
  window.__appearanceFixture={box,view};return results;
 },state.settings.profiles[0]);
 for(const [small,big] of sizes)assert.equal(big,small*2);
 await source.waitForFunction(()=>!window.__appearanceFixture.box.querySelector('.chat-message'));
 assert.equal(await source.evaluate(()=>!window.__appearanceFixture.box.querySelector('.chat-box').hidden),true);
 await source.evaluate(()=>{window.__appearanceFixture.view.destroy();window.__appearanceFixture.box.remove();});
 await page.locator('#appearance-target').selectOption('desktop');
 await page.getByRole('button',{name:'Studio',exact:false}).click();
 assert.equal(await page.locator('#fontSize').inputValue(),'32');assert.equal(await page.locator('[data-profile="topAligned"]').isChecked(),true);
 await page.evaluate(()=>window.sidecast.testEvent('chat'));await page.locator('.preview-stage .chat-message').first().waitFor();
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'test-results/appearance-vice.png',fullPage:true,animations:'disabled'});
 assert.deepEqual(errors,[]);
 // Persist independent styles across an actual app restart.
 await app.close();app=await electron.launch(launch);const restarted=await control();
 const restored=(await restarted.evaluate(()=>window.sidecast.getState())).settings.profiles[0];
 assert.equal(restored.appearance.linked,false);assert.equal(restored.appearance.desktop.theme,'vice');assert.equal(restored.appearance.browser.theme,'minimal');assert.equal(restored.appearance.desktop.topAligned,true);assert.equal(restored.appearance.browser.alertPlacement,'both');assert.equal(restored.alertDurations.raid,30);
 assert.deepEqual(JSON.parse(await readFile(join(data,'settings.json'),'utf8')).settings.profiles[0].appearance,restored.appearance);
 // Relinking intentionally applies the selected target, and unlinking clones it independently.
 await restarted.locator('#appearance-target').selectOption('browser');await restarted.locator('#appearance-linked').check();await saved(restarted);
 let p=(await restarted.evaluate(()=>window.sidecast.getState())).settings.profiles[0];assert.equal(p.theme,'minimal');assert.equal(p.fontSize,14);assert.equal(p.alertPlacement,'both');
 await restarted.locator('#appearance-linked').uncheck();await saved(restarted);p=(await restarted.evaluate(()=>window.sidecast.getState())).settings.profiles[0];assert.deepEqual(p.appearance.desktop,p.appearance.browser);
 console.log('PASS: independent native/browser appearance, shared chat/alerts, fixed top title through overflow/alerts/clear/fade, scalable headings, narrow fit, relinking and restart persistence');
}finally{await app.close();}
