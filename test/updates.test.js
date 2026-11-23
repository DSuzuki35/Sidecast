import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {UpdateService,updateEligibility} from '../src/updates.js';

class Updater extends EventEmitter {
  calls=0;
  async checkForUpdates(){this.calls++;this.emit('checking-for-update');return this.result;}
}
test('only an installed Windows build can auto-update',()=>{
  const base={packaged:true,platform:'win32',env:{},installed:true};
  assert.equal(updateEligibility(base),'');
  for(const override of [{packaged:false},{platform:'linux'},{installed:false},{env:{PORTABLE_EXECUTABLE_DIR:'C:/portable'}},{env:{SIDECAST_DATA_DIR:'test'}}])assert.ok(updateEligibility({...base,...override}));
});
test('download is serialized and never restarts the running app',async()=>{
  const updater=new Updater();let done;
  updater.result={downloadPromise:new Promise(resolve=>done=resolve)};
  const service=new UpdateService({updater,version:'0.2.9'});
  assert.equal(updater.autoDownload,true);assert.equal(updater.autoInstallOnAppQuit,true);
  assert.equal(updater.autoRunAppAfterInstall,false);assert.equal(updater.allowPrerelease,false);
  assert.equal(updater.allowDowngrade,false);
  const pending=service.check();await Promise.resolve();
  updater.emit('update-available',{version:'0.3.0'});
  updater.emit('download-progress',{percent:41.6});
  assert.equal(service.snapshot().percent,42);
  await service.check();assert.equal(updater.calls,1);
  updater.emit('update-downloaded',{version:'0.3.0'});done();await pending;
  assert.equal(service.snapshot().phase,'ready');
  await service.check();assert.equal(updater.calls,1);
  service.close();
});
test('network/download errors are safe, recoverable, and do not expose URLs',async()=>{
  const updater=new Updater(),service=new UpdateService({updater,version:'0.2.9'});
  updater.checkForUpdates=async()=>{throw Error('secret URL');};
  await service.check();assert.equal(service.snapshot().phase,'error');
  assert.ok(!JSON.stringify(service.snapshot()).includes('secret'));
  updater.checkForUpdates=async()=>{updater.emit('update-not-available');return null;};
  await service.check();assert.equal(service.snapshot().phase,'current');
  updater.checkForUpdates=async()=>({downloadPromise:Promise.reject(Error('private download'))});
  await service.check();assert.equal(service.snapshot().phase,'error');
  service.close();updater.emit('error',Error('late failure')); // Keep error handler during quit.
});
test('unsupported builds and closed services never contact the feed',async()=>{
  const updater=new Updater();const service=new UpdateService({updater,version:'0.2.9',disabled:'Install Sidecast first.'});
  service.start();await service.check();assert.equal(updater.calls,0);assert.equal(service.snapshot().phase,'disabled');
  const enabled=new UpdateService({updater,version:'0.2.9'});enabled.close();await enabled.check();assert.equal(updater.calls,0);
});
