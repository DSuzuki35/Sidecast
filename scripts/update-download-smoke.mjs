// Uses the real NSIS updater and Authenticode verification. Installer spawning is
// intercepted: this test must never replace the user's running installation.
import {_electron as electron} from 'playwright';
import {mkdtemp,readFile,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {join,resolve,basename} from 'node:path';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
const manifest=JSON.parse(await readFile('package.json','utf8'));
const directory=resolve(`release/${manifest.version}`),data=await mkdtemp(join(tmpdir(),'sidecast-update-download-'));
const github=process.argv.includes('--github');
const server=createServer(async(req,res)=>{
  const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1);
  if(name!==basename(name)||!['latest.yml',`Sidecast-${manifest.version}-Setup.exe`].includes(name)){res.writeHead(404).end();return;}
  const file=join(directory,name);res.setHeader('Content-Length',(await stat(file)).size);createReadStream(file).pipe(res);
});
server.listen(0,'127.0.0.1');await once(server,'listening');
const application=await electron.launch({executablePath:join(directory,'win-unpacked/Sidecast.exe'),args:[],env:{...process.env,SIDECAST_DATA_DIR:data,SIDECAST_SOURCE_PORT:'0'}});
try{
  const result=await application.evaluate(async({app},{data,directory,port,github})=>{
    const require=process.getBuiltinModule('module').createRequire(app.getAppPath()+'/package.json');
    const {NsisUpdater}=require('electron-updater');
    const {ElectronHttpExecutor}=require('electron-updater/out/electronHttpExecutor.js');
    const {UpdateService}=require('./src/updates.js');
    let quitHandler,spawned;const phases=[],errors=[];
    const adapter={version:'0.2.8',name:'Sidecast',isPackaged:true,appUpdateConfigPath:directory+'/win-unpacked/resources/app-update.yml',userDataPath:data,baseCachePath:data,whenReady:()=>app.whenReady(),onQuit:fn=>{quitHandler=fn;},quit:()=>{throw Error('Unexpected quit');},relaunch:()=>{throw Error('Unexpected relaunch');}};
    const updater=new NsisUpdater(null,adapter);
    updater.httpExecutor=new ElectronHttpExecutor();updater.disableDifferentialDownload=true;
    if(!github)updater.setFeedURL({provider:'generic',url:`http://127.0.0.1:${port}`});
    updater.on('error',e=>errors.push(e.message));
    updater.spawnLog=async(file,args)=>{spawned={file,args};return true;};
    const service=new UpdateService({updater,version:adapter.version,onChange:s=>{if(phases.at(-1)!==s.phase)phases.push(s.phase);}});
    await service.check();const snapshot=service.snapshot();
    const beforeQuit=spawned;service.close();if(quitHandler)quitHandler(0);
    return {snapshot,phases,errors,beforeQuit,spawned,installerPath:updater.installerPath};
  },{data,directory,port:server.address().port,github});
  assert.equal(result.snapshot.phase,'ready',JSON.stringify(result));
  assert.equal(result.snapshot.availableVersion,manifest.version);
  assert.equal(result.beforeQuit,undefined);
  assert.ok(result.spawned.args.includes('/S'));assert.ok(result.spawned.args.includes('--updated'));
  assert.ok(!result.spawned.args.includes('--force-run'));
  assert.equal(result.spawned.file,result.installerPath);
  console.log(`PASS: ${github?'public GitHub':'local'} feed, real installer download/checksum/signature, ready state, silent install on quit without restart (installer spawn intercepted)`);
}finally{await application.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
