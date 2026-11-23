const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('sidecast',Object.freeze({
  getState:()=>ipcRenderer.invoke('sidecast:state'),
  saveSettings:settings=>ipcRenderer.invoke('sidecast:save',settings),
  connection:(action,password)=>ipcRenderer.invoke('sidecast:connection',{action,password}),
  windowAction:(action,value)=>ipcRenderer.invoke('sidecast:window',{action,value}),
  testEvent:type=>ipcRenderer.invoke('sidecast:test',type),
  copySource:type=>ipcRenderer.invoke('sidecast:copy',type),
  audioAction:(action,text)=>ipcRenderer.invoke('sidecast:audio',{action,text}),
  onState:callback=>{const listener=(_event,state)=>callback(state);ipcRenderer.on('sidecast:changed',listener);return()=>ipcRenderer.removeListener('sidecast:changed',listener);}
}));
