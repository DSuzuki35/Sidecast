import {_electron as electron} from 'playwright';
import {mkdtemp,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
const data=await mkdtemp(join(tmpdir(),'sidecast-update-ui-'));
const application=await electron.launch({...(process.env.SIDECAST_EXECUTABLE?{executablePath:resolve(process.env.SIDECAST_EXECUTABLE)}:{}),args:process.env.SIDECAST_EXECUTABLE?[]:['.'],env:{...process.env,SIDECAST_DATA_DIR:data,SIDECAST_SOURCE_PORT:'0'}});
try{
  await application.firstWindow();let page;
  for(let i=0;i<100;i++){page=application.windows().find(p=>p.url().includes('/index.html'));if(page)break;await new Promise(r=>setTimeout(r,100));}
  await page.locator('[data-page="connection"]').click();
  const state=await page.evaluate(()=>window.sidecast.getState());
  assert.equal(state.updates.phase,'disabled');assert.equal(await page.locator('#check-updates').isDisabled(),true);
  const overlay=application.windows().find(p=>p.url().includes('/overlay.html'));
  assert.match(await overlay.evaluate(()=>window.sidecast.checkUpdates().then(()=>'',e=>e.message)),/Not allowed/i);
  await application.evaluate(({app,BrowserWindow},state)=>{
    const require=process.getBuiltinModule('module').createRequire(app.getAppPath()+'/package.json');
    const {UpdateService}=require('./src/updates.js');const {EventEmitter}=require('node:events');
    globalThis.__updateFixture=new EventEmitter();globalThis.__updateFixture.checkForUpdates=async()=>null;
    const control=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('/index.html'));
    globalThis.__updateService=new UpdateService({updater:globalThis.__updateFixture,version:app.getVersion(),onChange:updates=>control.webContents.send('sidecast:changed',{...state,updates})});
    globalThis.__updateFixture.emit('update-available',{version:'0.3.0'});
    globalThis.__updateFixture.emit('download-progress',{percent:63});
  },state);
  await page.getByText('Downloading an update in the background… 63%',{exact:true}).waitFor();
  await application.evaluate(()=>globalThis.__updateFixture.emit('update-downloaded',{version:'0.3.0'}));
  await page.getByText(/Update ready. It will install when you choose Quit/).waitFor();
  assert.equal(await page.locator('#check-updates').isDisabled(),true);
  await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/app-updates.png',fullPage:true});
  // A downloaded update does not close or restart the control app.
  assert.equal((await page.evaluate(()=>window.sidecast.getState())).updates.phase,'disabled');
  console.log('PASS: isolated updater disabled, overlay IPC denied, download/ready UI, no restart');
}finally{await application.close();}
