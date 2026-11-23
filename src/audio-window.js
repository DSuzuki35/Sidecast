// A failed optional player must never reject a settings save or app startup.
export class AudioPlayerWindow {
  constructor({createWindow,onError=()=>{}}){this.createWindow=createWindow;this.onError=onError;this.window=null;this.target=null;this.loading=null;this.generation=0;}
  close(){
    this.generation++;this.target=null;this.loading=null;
    const window=this.window;this.window=null;if(window&&!window.isDestroyed())window.destroy();
    this.onError('');
  }
  ensure(url){
    if(!url){this.close();return Promise.resolve(false);}
    if(this.target===url&&(this.loading||(this.window&&!this.window.isDestroyed())))return this.loading||Promise.resolve(true);
    this.close();this.target=url;const generation=this.generation;
    const loading=this.load(url,generation);this.loading=loading;
    loading.finally(()=>{if(this.loading===loading)this.loading=null;});return loading;
  }
  async load(url,generation){
    for(let attempt=0;attempt<2;attempt++){
      let window;
      try{
        window=this.createWindow();this.window=window;await window.loadURL(url);
        if(generation!==this.generation)return false;
        this.onError('');return true;
      }catch(error){
        if(window&&!window.isDestroyed())window.destroy();if(this.window===window)this.window=null;
        if(generation!==this.generation)return false;
        if(attempt===1){
          // Do not expose the private browser-source URL from Chromium's error message.
          const code=/^ERR_[A-Z_]+$/.test(error.code||'')?` (${error.code})`:'';
          this.onError(`Audio playback could not start${code}. Settings are saved. Toggle alert audio off and on to retry.`);
        }
      }
    }
    this.target=null;return false;
  }
}
