import { app,BrowserWindow,ipcMain,globalShortcut,Tray,Menu,nativeImage,clipboard,screen,safeStorage,dialog } from 'electron';
import { join,dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Hub } from './core/hub.js';
import { normalizeSettings,activeProfile } from './core/settings.js';
import { createSourceServer } from './server.js';
import { loadSettings,saveSettings } from './persistence.js';
import { createConnectionManager } from './connection.js';
import { testEvents } from './demo.js';
import { coalesce } from './core/coalesce.js';
import { AudioService,powershell } from './audio-service.js';
import {spawn} from 'node:child_process';
import {AudioPlayerWindow} from './audio-window.js';
import {previewProfile,previewText} from './core/speech-preview.js';
import {EmoteService} from './core/emotes.js';
import {existsSync} from 'node:fs';
import electronUpdater from 'electron-updater';
import {UpdateService,updateEligibility} from './updates.js';

const root=dirname(dirname(fileURLToPath(import.meta.url)));
if(process.env.SIDECAST_DATA_DIR)app.setPath('userData',process.env.SIDECAST_DATA_DIR);
app.setName('Sidecast');
let control,overlay,tray,hub,source,config,file,connectionManager,audioService,audioPlayer,emotes,setupProcess,previewRequest,quitting=false,shortcutError='',serverError='',audioWindowError='',saveError='',saveQueue=Promise.resolve(),boundsTimer;
let updates;
const single=app.requestSingleInstanceLock();
if(!single)app.quit();
else {
  app.on('second-instance',()=>showControl());
  app.whenReady().then(start).catch(error=>{console.error('Sidecast start failed:',error.message);app.quit();});
}
function showControl(){if(control&&!control.isDestroyed()){control.show();control.restore();control.focus();}}
function persist(){const snapshot={settings:structuredClone(config.settings),password:config.password,token:config.token,persistenceBlocked:config.persistenceBlocked};saveQueue=saveQueue.catch(()=>{}).then(()=>saveSettings(file,snapshot,safeStorage)).then(()=>{if(saveError){saveError='';publish();}});return saveQueue;}
function urls(){if(!source)return {};return {...Object.fromEntries(['chat','alerts','combined'].map(mode=>[mode,`${source.origin}/overlay?token=${config.token}&mode=${mode}`])),audio:`${source.origin}/audio?token=${config.token}`};}
function audioStatus(){return {...audioService?.status(),error:[audioService?.error,audioWindowError].filter(Boolean).join(' '),installing:!!setupProcess};}
function controlState(){return {settings:config.settings,snapshot:hub.snapshot(),urls:urls(),audioStatus:audioStatus(),updates:updates?.snapshot(),hasPassword:!!config.password,passwordPersistent:safeStorage.isEncryptionAvailable(),shortcutError,serverError,warning:[config.warning,saveError].filter(Boolean).join(' ')};}
function sendState(win,state){try{if(!win.webContents.isDestroyed())win.webContents.send('sidecast:changed',state);}catch{/* A closing or crashed renderer is refreshed on its next state request. */}}
const publish=coalesce(()=>{
 if(control&&!control.isDestroyed()&&control.isVisible()&&!control.isMinimized())sendState(control,controlState());
 if(overlay&&!overlay.isDestroyed()&&overlay.isVisible())sendState(overlay,{snapshot:hub.snapshot()});
});
function setOverlay(patch){config.settings.overlay={...config.settings.overlay,...patch};applyOverlay();hub.updateSettings(config.settings);persist().catch(reportSave);}
function reportSave(){saveError='Could not save settings.';publish();}
function applyOverlay(){
  if(!overlay)return;
  const s=config.settings.overlay;
  overlay.setAlwaysOnTop(s.alwaysOnTop,'screen-saver');overlay.setIgnoreMouseEvents(s.locked,{forward:true});overlay.setFocusable(!s.locked);
  overlay.setResizable(!s.locked);if(s.visible)overlay.showInactive();else overlay.hide();updateTray();
}
function registerShortcut(){globalShortcut.unregisterAll();shortcutError='';try{if(!globalShortcut.register(config.settings.hotkey,()=>setOverlay({locked:!config.settings.overlay.locked})))shortcutError='Hotkey is already in use. Unlock the overlay from settings or the tray.';}catch{shortcutError='Invalid hotkey. Example: Control+Shift+Space';}}
function updateTray(){if(!tray)return;tray.setContextMenu(Menu.buildFromTemplate([
 {label:'Open Sidecast',click:showControl},
 {label:config.settings.overlay.visible?'Hide overlay':'Show overlay',click:()=>setOverlay({visible:!config.settings.overlay.visible})},
 {label:'Unlock overlay',click:()=>setOverlay({locked:false,visible:true})},
 {type:'separator'},{label:'Quit Sidecast',click:()=>app.quit()}
]));}
function icon(){const size=32,b=Buffer.alloc(size*size*4);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=(y*size+x)*4;const on=y>6&&y<25&&((x+y/2>15&&x+y/2<21)||(x+y/2>24&&x+y/2<30));b[i]=on?142:24;b[i+1]=on?240:23;b[i+2]=on?194:20;b[i+3]=255;}return nativeImage.createFromBitmap(b,{width:size,height:size});}
function secure(win){win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',event=>event.preventDefault());win.webContents.session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));}
function initialBounds(){
  const s=config.settings.overlay;const candidate={x:s.x??40,y:s.y??80,width:s.width,height:s.height};const area=screen.getDisplayMatching(candidate).workArea;
  candidate.width=Math.min(candidate.width,area.width);candidate.height=Math.min(candidate.height,area.height);
  candidate.x=Math.max(area.x,Math.min(candidate.x,area.x+area.width-candidate.width));candidate.y=Math.max(area.y,Math.min(candidate.y,area.y+area.height-candidate.height));return candidate;
}
async function startServer(){
  audioPlayer?.close();
  if(source){await source.close();source=null;}serverError='';
  try{source=await createSourceServer({hub,publicDir:join(root,'public'),port:process.env.SIDECAST_SOURCE_PORT!==undefined?Number(process.env.SIDECAST_SOURCE_PORT):config.settings.sourcePort,token:config.token,audio:audioService});}
  catch{serverError=`Browser source: port ${config.settings.sourcePort} is unavailable. Choose a different port under Connection.`;}
}
async function syncAudioWindow(){
  if(quitting)return false;
  const audio=activeProfile(config.settings).audio;
  return audioPlayer.ensure(audio.enabled&&audio.output==='desktop'&&source?urls().audio+'&desktop=1':null);
}

async function connect(){hub.clearTests();await connectionManager.connect({...config.settings.connection,password:config.password});}
function trusted(event,controlOnly=true){
  const win=BrowserWindow.fromWebContents(event.sender);
  if(!win||event.senderFrame!==event.sender.mainFrame||!(win===control||(!controlOnly&&win===overlay)))throw Error('Not allowed');
}
function handle(channel,fn,controlOnly=true){ipcMain.handle(`sidecast:${channel}`,async(event,payload)=>{trusted(event,controlOnly);return fn(payload,event);});}
function stopSetup(){if(!setupProcess?.pid)return Promise.resolve();const pid=setupProcess.pid;return new Promise(resolve=>{const killer=spawn(join(process.env.SystemRoot||'C:\\Windows','System32','taskkill.exe'),['/PID',String(pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});killer.on('error',resolve);killer.on('close',resolve);});}
async function start(){
  const disabled=updateEligibility({packaged:app.isPackaged,platform:process.platform,env:process.env,installed:existsSync(join(dirname(app.getPath('exe')),'Uninstall Sidecast.exe'))});
  updates=new UpdateService({updater:disabled?null:electronUpdater.autoUpdater,version:app.getVersion(),disabled,onChange:()=>{if(hub&&!quitting)publish();}});
  file=join(app.getPath('userData'),'settings.json');config=await loadSettings(file,safeStorage);
  audioService=new AudioService({directory:join(app.getPath('userData'),'audio'),root,onChange:()=>{if(hub&&!quitting)publish();}});await audioService.init();
  hub=new Hub({settings:config.settings,prepareAlert:(event,profile,signal)=>audioService.prepare(event,profile,signal)});
  emotes=new EmoteService({onUpdate:()=>{if(!quitting)hub.refreshMessages(message=>emotes.decorate(message));}});
  connectionManager=createConnectionManager(event=>hub.ingest(emotes.process(event)),status=>hub.setStatus(status));
  // Start unlocked: users must always be able to find and recover the overlay.
  config.settings.overlay.locked=false;hub.updateSettings(config.settings);await startServer();await persist().catch(reportSave);
  const webPreferences={preload:join(root,'src','preload.cjs'),autoplayPolicy:'no-user-gesture-required',contextIsolation:true,nodeIntegration:false,sandbox:true};
  control=new BrowserWindow({width:1360,height:940,minWidth:1030,minHeight:720,backgroundColor:'#0e1014',title:'Sidecast',autoHideMenuBar:true,show:false,icon:icon(),webPreferences});secure(control);
  control.on('close',event=>{if(!quitting){event.preventDefault();control.hide();}});
  control.on('show',publish);control.on('restore',publish);
  overlay=new BrowserWindow({...initialBounds(),minWidth:280,minHeight:240,transparent:true,frame:false,hasShadow:false,resizable:true,show:false,skipTaskbar:true,title:'Sidecast Overlay',webPreferences});secure(overlay);
  overlay.on('close',event=>{if(!quitting){event.preventDefault();setOverlay({visible:false});}});
  overlay.on('show',publish);
  audioPlayer=new AudioPlayerWindow({createWindow:()=>{const win=new BrowserWindow({show:false,skipTaskbar:true,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false,autoplayPolicy:'no-user-gesture-required'}});secure(win);return win;},onError:error=>{audioWindowError=error;if(!quitting)publish();}});
  await syncAudioWindow();
  const rememberBounds=()=>{clearTimeout(boundsTimer);boundsTimer=setTimeout(()=>{if(overlay.isDestroyed()||quitting)return;Object.assign(config.settings.overlay,overlay.getBounds());persist().catch(reportSave);},300);};
  overlay.on('move',rememberBounds);overlay.on('resize',rememberBounds);
  tray=new Tray(icon());tray.setToolTip('Sidecast · Your chat. In the game.');tray.on('double-click',showControl);updateTray();
  handle('state',(_payload,event)=>event.sender===control.webContents?controlState():{snapshot:hub.snapshot()},false);
  handle('save',async input=>{
    const previous=config.settings;const next=normalizeSettings(input);
    // Bounds belong to the actual window; stale controls must not move it.
    Object.assign(next.overlay,overlay.getBounds(),{visible:previous.overlay.visible,locked:previous.overlay.locked});config.settings=next;
    if(next.sourcePort!==previous.sourcePort)await startServer();
    if(next.hotkey!==previous.hotkey)registerShortcut();if(next.overlay.alwaysOnTop!==previous.overlay.alwaysOnTop)applyOverlay();hub.updateSettings(next);await persist();await syncAudioWindow();return controlState();
  });
  handle('connection',async ({action,password}={})=>{
    if(action==='disconnect'){await connectionManager.disconnect();hub.setStatus({state:'offline',label:'Disconnected'});}
    else if(action==='forget-password'){config.password='';await persist();}
    else if(action==='connect'){if(typeof password==='string'){config.password=password.slice(0,1024);if(config.warning==='Please enter your saved password again.')config.warning='';}await persist();await connect();}
    return controlState();
  });
  handle('window',({action,value}={},event)=>{
    const fromControl=event.sender===control.webContents;
    if(action==='lock')setOverlay({locked:true});
    if(action==='unlock')setOverlay({locked:false});
    if(action==='show'&&fromControl)setOverlay({visible:true});
    if(action==='hide')setOverlay({visible:false});
    if(action==='reset'&&fromControl){const a=screen.getPrimaryDisplay().workArea;overlay.setBounds({x:a.x+40,y:a.y+60,width:400,height:650});setOverlay({visible:true,locked:false});}
    if(action==='resize'){
      if(!config.settings.overlay.locked&&Number.isFinite(value?.width)&&Number.isFinite(value?.height))overlay.setSize(Math.round(Math.max(280,Math.min(1600,value.width))),Math.round(Math.max(240,Math.min(1800,value.height))));
      return;
    }
    if(action==='quit'&&fromControl)app.quit();
    return fromControl?controlState():{snapshot:hub.snapshot()};
  },false);
  handle('test',type=>{if(type==='clear')hub.clear();else for(const event of testEvents(type))hub.ingest(event.kind==='alert'?{...event,testSpeech:true}:event);return controlState();});
  handle('updates',()=>{void updates.check();return updates.snapshot();});
  handle('copy',type=>{const url=urls()[type];if(!url)throw Error('Browser source unavailable');clipboard.writeText(url);return true;});
  handle('audio',async ({action,text}={})=>{
    if(action==='stop-preview'){previewRequest?.abort();previewRequest=null;return true;}
    if(action==='preview'){
      const value=previewText(text);if(previewRequest)throw Error('A voice preview is already being prepared. Stop it first.');
      const controller=new AbortController();previewRequest=controller;
      try{
        const profile=previewProfile(activeProfile(config.settings));
        const result=await audioService.prepare({alertType:'follow',detail:value},profile,controller.signal,{privatePreview:true});
        if(controller.signal.aborted)return null;
        const clip=result?.clips[0],data=result?.previewData;
        if(controller.signal.aborted)return null;
        if(!data)throw Error(audioService.error||'Speech could not be generated. Check the selected voice.');
        return {url:'data:audio/wav;base64,'+data.toString('base64'),volume:clip.volume};
      }finally{if(previewRequest===controller)previewRequest=null;}
    }
    if(action==='status')return audioStatus();
    if(action==='sound'){const result=await dialog.showOpenDialog(control,{title:'Choose an alert sound',properties:['openFile'],filters:[{name:'Audio',extensions:['wav','mp3','ogg']}]});return result.canceled?null:audioService.importSound(result.filePaths[0]);}
    if(action==='reference'){const result=await dialog.showOpenDialog(control,{title:'Choose your voice recording (3–30 seconds)',properties:['openFile'],filters:[{name:'WAV recording',extensions:['wav']}]});return result.canceled?null:audioService.importReference(result.filePaths[0]);}
    if(action==='unload'){audioService.stopWorker();publish();return audioService.status();}
    if(action==='setup'&&!setupProcess){const script=join(root.replace('app.asar','app.asar.unpacked'),'scripts',activeProfile(config.settings).audio.engine==='chatterbox'?'setup-chatterbox.ps1':'setup-tts.ps1');setupProcess=spawn(powershell,['-NoProfile','-ExecutionPolicy','Bypass','-File',script,...(activeProfile(config.settings).audio.device==='cpu'?['-CpuOnly']:[])],{windowsHide:true,stdio:'ignore'});audioService.error='';setupProcess.on('error',()=>{setupProcess=null;audioService.error='Could not start the voice engine installer.';publish();});setupProcess.on('exit',code=>{setupProcess=null;if(code)audioService.error='Voice engine setup failed. Retry installation to resume the download.';if(!quitting)publish();});publish();}
    return audioStatus();
  });
  hub.on('change',publish);
  await control.loadFile(join(root,'public','index.html'));await overlay.loadFile(join(root,'public','overlay.html'),{query:{desktop:'1'}});
  registerShortcut();applyOverlay();control.show();publish();
  updates.start();
  if(config.settings.connection.autoConnect)await connect();
}
app.on('window-all-closed',()=>{});
app.on('before-quit',event=>{
  if(quitting)return;event.preventDefault();quitting=true;clearTimeout(boundsTimer);publish.cancel();globalShortcut.unregisterAll();emotes?.close();hub?.close();
  updates?.close();previewRequest?.abort();audioPlayer?.close();audioService?.close();
  if(config&&overlay&&!overlay.isDestroyed()){Object.assign(config.settings.overlay,overlay.getBounds());persist().catch(()=>{});}
  Promise.allSettled([connectionManager?.disconnect(),source?.close(),saveQueue,stopSetup()]).finally(()=>{tray?.destroy();app.quit();});
});
