import {_electron as electron} from 'playwright';
import {mkdtemp} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
const data=await mkdtemp(join(tmpdir(),'sidecast-history-'));
const app=await electron.launch({...(process.env.SIDECAST_EXECUTABLE?{executablePath:resolve(process.env.SIDECAST_EXECUTABLE)}:{}),args:process.env.SIDECAST_EXECUTABLE?[]:['.'],env:{...process.env,SIDECAST_DATA_DIR:data,SIDECAST_SOURCE_PORT:'0'}});
try{
 await app.firstWindow();let page;for(let i=0;i<100;i++){page=app.windows().find(p=>p.url().includes('/index.html'));if(page)break;await new Promise(r=>setTimeout(r,100));}
 await page.getByRole('heading',{name:'Your stream. Your style.'}).waitFor();
 await page.evaluate(async()=>{const s=await window.sidecast.getState();Object.assign(s.settings.profiles[0],{theme:'vice',topAligned:true,fontSize:18,maxMessages:5,alertPlacement:'both',alertDurations:{...s.settings.profiles[0].alertDurations,follow:3,raid:3}});await window.sidecast.saveSettings(s.settings);await window.sidecast.windowAction('show');await window.sidecast.windowAction('lock');});
 await page.reload();await page.getByRole('heading',{name:'Your stream. Your style.'}).waitFor();const state=await page.evaluate(()=>window.sidecast.getState());const sources={};
 for(const mode of ['chat','alerts']){const created=app.waitForEvent('window');await app.evaluate(({BrowserWindow},url)=>{new BrowserWindow({show:false,webPreferences:{sandbox:true,backgroundThrottling:false}}).loadURL(url);},state.urls[mode]);sources[mode]=await created;await sources[mode].waitForFunction(()=>!!document.querySelector('.chat-stack'));}
 const desktop=app.windows().find(p=>p.url().includes('desktop=1'));
 await page.evaluate(async()=>{await window.sidecast.testEvent('chat');await window.sidecast.testEvent('follow');await window.sidecast.testEvent('raid');});
 for(const output of [page,desktop,sources.chat]){await output.locator('.chat-alert-message[data-alert-type="follow"]').waitFor();assert.equal(await output.locator('.chat-alert-message').count(),1);}
 await sources.alerts.locator('.centered-alert-slot .alert-card[data-alert="follow"]').waitFor();
 await sources.chat.evaluate(()=>window.__follow=document.querySelector('.chat-alert-message'));
 await sources.chat.locator('.chat-alert-message[data-alert-type="raid"]').waitFor();assert.equal(await sources.chat.evaluate(()=>window.__follow.isConnected),true);
 for(const output of [sources.chat,sources.alerts,desktop])await output.waitForFunction(()=>!document.querySelector('.alert-card'));
 for(const output of [page,desktop,sources.chat]){assert.equal(await output.locator('.chat-alert-message').count(),2);assert.match(await output.locator('.chat-alert-message[data-alert-type="raid"]').innerText(),/balkn[\s\S]*RAID INCOMING[\s\S]*128 viewers/);}
 assert.equal(await sources.alerts.locator('.chat-alert-message:visible').count(),0);assert.equal(await sources.chat.locator('.centered-alert-slot').isVisible(),false);
 await page.locator('.preview-stage').screenshot({path:'test-results/alert-history.png',animations:'disabled'});
 // Incoming ordinary messages displace the event rows through the same message limit.
 await page.evaluate(()=>window.sidecast.testEvent('chat'));await sources.chat.waitForFunction(()=>document.querySelectorAll('.chat-message').length===5);assert.equal(await sources.chat.locator('.chat-alert-message').count(),2);
 await page.evaluate(()=>window.sidecast.testEvent('chat'));await sources.chat.waitForFunction(()=>!document.querySelector('.chat-alert-message'));assert.equal(await sources.chat.locator('.chat-message').count(),5);
 // Fade applies exactly like normal chat and expires without another incoming event.
 await page.evaluate(async()=>{await window.sidecast.testEvent('clear');const s=await window.sidecast.getState();s.settings.profiles[0].fadeSeconds=1;await window.sidecast.saveSettings(s.settings);await window.sidecast.testEvent('follow');});
 await sources.chat.locator('.chat-alert-message').waitFor();await sources.chat.locator('.chat-alert-message').waitFor({state:'detached'});assert.equal(await sources.chat.locator('.compact-alert-slot .alert-card').count(),1,'History fade must not stop the separate alert animation');
 await page.evaluate(()=>window.sidecast.testEvent('clear'));await sources.chat.locator('.alert-card').waitFor({state:'detached'});assert.equal((await page.evaluate(()=>window.sidecast.getState())).snapshot.messages.length,0);
 console.log('PASS: queued alerts create single themed chat rows, remain after animations, share scrolling/message-limit/fade, keep fullscreen isolated, and clear normally in native/browser/preview');
}finally{await app.close();}
