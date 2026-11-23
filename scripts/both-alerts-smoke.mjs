import {_electron as electron} from 'playwright';
import {mkdtemp} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
const data=await mkdtemp(join(tmpdir(),'sidecast-routing-'));
const app=await electron.launch({...(process.env.SIDECAST_EXECUTABLE?{executablePath:resolve(process.env.SIDECAST_EXECUTABLE)}:{}),args:process.env.SIDECAST_EXECUTABLE?[]:['.'],env:{...process.env,SIDECAST_DATA_DIR:data,SIDECAST_SOURCE_PORT:'0'}});
try{
 await app.firstWindow();let page;for(let i=0;i<100;i++){page=app.windows().find(p=>p.url().includes('/index.html'));if(page)break;await new Promise(r=>setTimeout(r,100));}
 await page.getByRole('button',{name:'Alerts & Events',exact:true}).click();
 const placement=page.getByRole('combobox',{name:'Alert placement',exact:true});await placement.selectOption('both');
 await page.locator('#save-status').filter({hasText:'Saved'}).waitFor();
 await page.locator('#duration-raid').fill('30');await page.locator('#duration-raid').dispatchEvent('change');await page.locator('#save-status').filter({hasText:'Saved'}).waitFor();
 const state=await page.evaluate(()=>window.sidecast.getState());
 const sources={};
 for(const mode of ['chat','alerts','combined']){
  const created=app.waitForEvent('window');await app.evaluate(({BrowserWindow},url)=>{new BrowserWindow({show:false,webPreferences:{sandbox:true,backgroundThrottling:false}}).loadURL(url);},state.urls[mode]);
  sources[mode]=await created;await sources[mode].setViewportSize(mode==='alerts'?{width:1920,height:1080}:{width:400,height:650});
  await sources[mode].waitForFunction(()=>!!document.querySelector('.compact-alert-slot'));
  await sources[mode].addStyleTag({content:'*,*::before,*::after{animation:none!important}'});
 }
 await page.evaluate(async()=>{await window.sidecast.windowAction('show');await window.sidecast.windowAction('lock');await window.sidecast.testEvent('chat');await window.sidecast.testEvent('raid');});
 const desktop=app.windows().find(p=>p.url().includes('desktop=1'));
 for(const output of [desktop,sources.chat,sources.combined]){
  await output.locator('.compact-alert-slot .alert-card').waitFor();assert.equal(await output.locator('.centered-alert-slot').isVisible(),false);assert.equal(await output.locator('.centered-alert-slot .alert-card').count(),0);assert.equal(await output.locator('.alert-card').count(),1);
 }
 await sources.alerts.locator('.centered-alert-slot .alert-card').waitFor();assert.equal(await sources.alerts.locator('.compact-alert-slot .alert-card').count(),0);assert.equal(await sources.alerts.locator('.chat-box').isVisible(),false);
 for(const output of [desktop,...Object.values(sources)])assert.equal(await output.locator('.alert-name').innerText(),'balkn');
 const center=await sources.alerts.locator('.alert-card').boundingBox();assert.ok(Math.abs(center.x+center.width/2-960)<2);assert.ok(Math.abs(center.y+center.height/2-540)<2);
 assert.equal(await sources.alerts.locator('.alert-card').evaluate(n=>getComputedStyle(n).backgroundColor),'rgba(0, 0, 0, 0)');
 const event=(await page.evaluate(()=>window.sidecast.getState())).snapshot.alert;
 await sources.chat.evaluate(()=>window.__card=document.querySelector('.alert-card'));await page.evaluate(()=>window.sidecast.testEvent('chat'));await sources.chat.waitForFunction(()=>document.querySelectorAll('.chat-message').length===7);assert.equal(await sources.chat.evaluate(()=>window.__card.isConnected),true);
 // Browser routing is independent of desktop presentation, and preserves the active queue deadline.
 for(const value of ['center','inline','both']){
  await placement.selectOption(value);await page.locator('#save-status').filter({hasText:'Saved'}).waitFor();
  for(const mode of ['chat','combined','alerts']){
   const expected=mode==='alerts'?(value==='inline'?0:1):(value==='center'?0:1);
   await sources[mode].waitForFunction(count=>document.querySelectorAll('.alert-card').length===count,expected);
   assert.equal(await sources[mode].locator(mode==='alerts'?'.compact-alert-slot .alert-card':'.centered-alert-slot .alert-card').count(),0);
  }
  assert.equal(await desktop.locator('.compact-alert-slot .alert-card').count(),1);assert.equal(await desktop.locator('.centered-alert-slot .alert-card').count(),0);
  const snapshot=(await page.evaluate(()=>window.sidecast.getState())).snapshot;assert.equal(snapshot.alert.id,event.id);assert.equal(snapshot.alert.endsAt,event.endsAt);assert.equal(snapshot.queued,0);
 }
 // Studio's two browser previews show the same distinct routes as the live sources.
 await page.locator('#appearance-target').selectOption('browser');await page.getByRole('button',{name:'Studio',exact:false}).click();
 await page.locator('[data-mode="chat"]').click();await page.locator('.preview-stage .compact-alert-slot .alert-card').waitFor();assert.equal(await page.locator('.preview-stage .centered-alert-slot .alert-card').count(),0);
 await page.locator('[data-mode="alerts"]').click();await page.locator('.preview-stage .centered-alert-slot .alert-card').waitFor();assert.equal(await page.locator('.preview-stage .compact-alert-slot .alert-card').count(),0);
 await page.locator('#appearance-target').selectOption('desktop');await page.locator('.preview-stage .compact-alert-slot .alert-card').waitFor();assert.equal(await page.locator('.preview-stage .centered-alert-slot .alert-card').count(),0);
 await page.locator('#appearance-linked').uncheck();await page.locator('#save-status').filter({hasText:'Saved'}).waitFor();await page.getByRole('button',{name:'Alerts & Events',exact:true}).click();assert.equal(await placement.isDisabled(),true);assert.equal(await placement.inputValue(),'inline');
 await page.locator('#appearance-target').selectOption('browser');assert.equal(await placement.isEnabled(),true);assert.equal(await placement.inputValue(),'both');
 await placement.selectOption('center');await page.locator('#save-status').filter({hasText:'Saved'}).waitFor();await page.locator('#appearance-target').selectOption('desktop');await page.locator('#appearance-linked').check();await page.locator('#save-status').filter({hasText:'Saved'}).waitFor();await page.locator('#appearance-target').selectOption('browser');assert.equal(await placement.inputValue(),'center','Linking desktop appearance must preserve browser alert routing');await placement.selectOption('both');await page.locator('#save-status').filter({hasText:'Saved'}).waitFor();
 await page.evaluate(()=>window.sidecast.testEvent('clear'));for(const output of [desktop,...Object.values(sources)])await output.waitForFunction(()=>!document.querySelector('.alert-card'));
 // Two visual sources still share exactly one FIFO item and one speech clip/player.
 await page.evaluate(async()=>{const s=await window.sidecast.getState();s.settings.profiles[0].audio.types.follow.sound='none';s.settings.profiles[0].audio.enabled=true;s.settings.profiles[0].audio.volume=0;s.settings.profiles[0].alertDurations.follow=3;s.settings.profiles[0].alertDurations.raid=3;await window.sidecast.saveSettings(s.settings);await window.sidecast.testEvent('follow');await window.sidecast.testEvent('raid');});
 for(const output of [sources.chat,sources.alerts])await output.locator('.alert-card[data-alert="follow"]').waitFor();
 const playing=(await page.evaluate(()=>window.sidecast.getState())).snapshot;assert.equal(playing.queued,1);assert.equal(playing.alert.audio.clips.length,1);assert.equal(app.windows().filter(p=>p.url().includes('/audio?')).length,1);
 for(const output of [sources.chat,sources.alerts])await output.locator('.alert-card[data-alert="raid"]').waitFor();
 for(const output of [desktop,...Object.values(sources)])await output.waitForFunction(()=>!document.querySelector('.alert-card'));
 await page.reload();await page.getByRole('button',{name:'Alerts & Events',exact:true}).click();await page.locator('#appearance-target').selectOption('browser');assert.equal(await placement.inputValue(),'both');
 await page.getByRole('button',{name:'Browser sources',exact:true}).click();assert.equal(await page.locator('#source-cards .source-card').count(),2);
 console.log('PASS: separate Chat/Alerts browser routing, desktop always compact, compatibility URL, single queue/audio, expiry/clear, Studio target previews, persistence and two source cards');
}finally{await app.close();}
