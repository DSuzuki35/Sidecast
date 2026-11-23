import { spawn } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import { createServer } from 'node:net';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// The portable NSIS launcher does not forward Electron's inspector stderr.
// Connect to the test instance's explicit CDP port instead of electron.launch.
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const {version}=JSON.parse(await readFile('package.json','utf8'));
const data=await mkdtemp(join(tmpdir(),'sidecast-portable-'));
const child=spawn(resolve(`release/Sidecast-${version}-portable.exe`),[`--remote-debugging-port=${port}`],{windowsHide:true,stdio:'ignore',env:{...process.env,SIDECAST_DATA_DIR:data,SIDECAST_SOURCE_PORT:'0'}});
let browser,page;
try {
 const deadline=Date.now()+60000;let ready=false;
 while(Date.now()<deadline){try{ready=(await fetch(`http://127.0.0.1:${port}/json/version`)).ok;}catch{}if(ready)break;await new Promise(r=>setTimeout(r,250));}
 assert.ok(ready,'Portable app did not expose its test debugging endpoint');
 browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
 for(let i=0;i<80;i++){page=browser.contexts()[0].pages().find(p=>p.url().includes('/index.html'));if(page)break;await new Promise(r=>setTimeout(r,100));}
 assert.ok(page,'Portable control window did not load');await page.waitForFunction(()=>!!window.sidecast);
 const state=await page.evaluate(()=>window.sidecast.getState());assert.equal(state.snapshot.status.state,'offline');assert.equal((await fetch(state.urls.chat)).status,200);
 await page.evaluate(()=>window.sidecast.testEvent('chat'));await page.locator('.preview-stage .chat-message').first().waitFor();
 assert.equal((await page.evaluate(()=>window.sidecast.getState())).snapshot.messages.length,3);
 const audioState=await page.evaluate(async()=>{const s=await window.sidecast.getState();s.settings.profiles[0].audio.enabled=true;s.settings.profiles[0].audio.volume=0;return window.sidecast.saveSettings(s.settings);});
 assert.equal(audioState.audioStatus.error,'');
 assert.ok(browser.contexts()[0].pages().some(p=>p.url()===audioState.urls.audio+'&desktop=1'),'Portable audio player must finish loading');
 console.log('PASS: signed portable launcher extracts, opens Sidecast, serves browser sources, renders chat and starts desktop audio with isolated settings');
} finally {
 if(page)await page.evaluate(()=>window.sidecast.windowAction('quit')).catch(()=>{});
 if(browser)await browser.close().catch(()=>{});
 if(child.exitCode===null){await Promise.race([new Promise(r=>child.once('exit',r)),new Promise(r=>setTimeout(r,3000))]);if(child.exitCode===null)child.kill();}
}
