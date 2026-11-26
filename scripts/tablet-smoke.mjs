import {_electron as electron,webkit} from 'playwright';
import {mkdtemp,readFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {createServer} from 'node:net';
import {once} from 'node:events';
const data=await mkdtemp(join(tmpdir(),'sidecast-tablet-'));
const reservation=createServer();reservation.listen(0,'127.0.0.1');await once(reservation,'listening');const sourcePort=String(reservation.address().port);await new Promise(resolve=>reservation.close(resolve));
const app=await electron.launch({...(process.env.SIDECAST_EXECUTABLE?{executablePath:resolve(process.env.SIDECAST_EXECUTABLE)}:{}),args:process.env.SIDECAST_EXECUTABLE?[]:['.'],env:{...process.env,SIDECAST_DATA_DIR:data,SIDECAST_SOURCE_PORT:sourcePort}});
let browser;
try{
 await app.firstWindow();let control;
 for(let i=0;i<100;i++){control=app.windows().find(w=>w.url().includes('/index.html'));if(control)break;await new Promise(r=>setTimeout(r,100));}
 const errors=[];control.on('pageerror',e=>errors.push(e.message));
 await control.locator('[data-page="sources"]').click();assert.equal(await control.locator('#lan-enabled').isChecked(),false);
 const originalURL=(await control.evaluate(()=>window.sidecast.getState())).urls.chat;
 await control.locator('#lan-enabled').check();await control.locator('#tablet-links img').first().waitFor();
 let state=await control.evaluate(()=>window.sidecast.getState());assert.ok(state.tabletLinks.length);assert.match(state.urls.chat,/http:\/\/127\.0\.0\.1:/);
 assert.equal(state.urls.chat,originalURL);
 const tabletURL=state.tabletLinks[0].url;assert.match(state.tabletLinks[0].qr,/^data:image\/png;base64,/);
 assert.equal((JSON.parse(await readFile(join(data,'settings.json'),'utf8'))).settings.lanEnabled,true);
 // WebKit exercises the tablet page in Safari's engine; no real user profile is opened.
 browser=await webkit.launch({headless:true});const tablet=await browser.newPage({viewport:{width:820,height:1180},isMobile:true,hasTouch:true});tablet.on('pageerror',e=>errors.push(e.message));
 await tablet.goto(tabletURL);await tablet.locator('#tablet-status').filter({hasText:'Sidecast connected'}).waitFor();
 assert.equal(await tablet.locator('#tablet-empty').isVisible(),true);
 assert.equal(await tablet.locator('body').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(14, 16, 20)');
 await control.evaluate(async()=>{await window.sidecast.testEvent('chat');await window.sidecast.testEvent('sub');});
 await tablet.locator('.chat-message').first().waitFor();await tablet.locator('.alert-card').waitFor();
 assert.ok(await tablet.locator('.unicode-emoji').count()>0);assert.equal(await tablet.locator('#tablet-empty').isVisible(),false);
 assert.equal(await tablet.locator('audio').count(),0);
 for(const viewport of [{width:820,height:1180},{width:1180,height:820},{width:390,height:844}]){
  await tablet.setViewportSize(viewport);assert.equal(await tablet.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 }
 await tablet.setViewportSize({width:820,height:1180});await mkdir('test-results',{recursive:true});await tablet.screenshot({path:'test-results/tablet-portrait.png',animations:'disabled'});
 const obs=await browser.newPage();await obs.goto(state.urls.chat);await obs.locator('.chat-message').first().waitFor();assert.equal(await obs.locator('#tablet-bar').isVisible(),false);assert.equal(await obs.locator('body').evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)');
 await control.locator('#lan-enabled').uncheck();await tablet.locator('#tablet-status').filter({hasText:'Disconnected'}).waitFor();
 await control.waitForFunction(async()=>(await window.sidecast.getState()).tabletLinks.length===0);
 assert.equal(await control.locator('#tablet-links img').count(),0);
 await control.locator('#lan-enabled').check();await control.locator('#tablet-links img').first().waitFor();
 state=await control.evaluate(()=>window.sidecast.getState());assert.equal(state.tabletLinks[0].url,tabletURL);assert.equal(state.urls.chat,originalURL);
 await tablet.locator('#tablet-status').filter({hasText:'Sidecast connected'}).waitFor();await tablet.locator('.chat-message').first().waitFor();
 assert.deepEqual(errors,[]);
 console.log('PASS: LAN toggle persistence, local QR/link, WebKit live chat/emoji/alerts, portrait/landscape/phone layout, transparent OBS, disable/re-enable');
}finally{await browser?.close();await app.close();}
