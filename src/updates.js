// No feed requests from development, portable, unpacked, or isolated test builds.
export function updateEligibility({packaged,platform,env,installed}){
  if(env.SIDECAST_DATA_DIR)return 'Automatic updates are disabled for isolated test profiles.';
  if(!packaged)return 'Automatic updates are available in the installed Windows app.';
  if(platform!=='win32'||env.PORTABLE_EXECUTABLE_DIR||!installed)return 'Install Sidecast with the Windows setup to receive automatic updates.';
  return '';
}

export class UpdateService {
  constructor({updater,version,disabled='',onChange=()=>{}}){
    this.updater=updater;this.onChange=onChange;this.closed=false;this.busy=false;
    this.state={version,phase:disabled?'disabled':'idle',message:disabled||'Automatic updates are enabled.',availableVersion:'',percent:0};
    if(disabled)return;
    updater.logger=null;
    updater.autoDownload=true;
    updater.autoInstallOnAppQuit=true;
    updater.autoRunAppAfterInstall=false;
    updater.allowPrerelease=false;
    updater.allowDowngrade=false;
    updater.disableWebInstaller=true;
    updater.on('checking-for-update',()=>this.set({phase:'checking',message:'Checking for updates…'}));
    updater.on('update-not-available',()=>this.set({phase:'current',message:'Sidecast is up to date.'}));
    updater.on('update-available',info=>this.set({phase:'downloading',availableVersion:info.version,percent:0,message:'Downloading an update in the background…'}));
    updater.on('download-progress',info=>{
      const percent=Math.max(0,Math.min(100,Math.round(Number(info.percent)||0)));
      if(percent!==this.state.percent)this.set({percent});
    });
    updater.on('update-downloaded',info=>this.set({phase:'ready',availableVersion:info.version,percent:100,message:'Update ready. It will install when you choose Quit from the Sidecast tray menu. Sidecast will not restart automatically.'}));
    updater.on('error',()=>this.error());
    updater.on('update-cancelled',()=>this.error());
  }
  snapshot(){return {...this.state};}
  set(next){if(this.closed)return;Object.assign(this.state,next);this.onChange(this.snapshot());}
  error(){this.set({phase:'error',message:'Could not check or download the update. Check your connection and try again.'});}
  start(){
    if(this.closed||this.state.phase==='disabled'||this.startTimer)return;
    this.startTimer=setTimeout(()=>void this.check(),15000);this.startTimer.unref?.();
    this.interval=setInterval(()=>void this.check(),6*60*60*1000);this.interval.unref?.();
  }
  async check(){
    if(this.closed||this.busy||['disabled','ready'].includes(this.state.phase))return;
    this.busy=true;
    try{const result=await this.updater.checkForUpdates();await result?.downloadPromise;}
    catch{this.error();}
    finally{this.busy=false;}
  }
  close(){this.closed=true;clearTimeout(this.startTimer);clearInterval(this.interval);}
}
