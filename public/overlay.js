import {appearanceFor} from './appearance.js';
import {createOverlay} from './shared.js';
const params=new URLSearchParams(location.search);const desktop=params.get('desktop')==='1'&&!!window.sidecast;
const tablet=!desktop&&params.get('tablet')==='1';
if(tablet){document.body.classList.add('tablet-page');document.querySelector('#tablet-bar').hidden=false;document.querySelector('#tablet-empty').hidden=false;document.title='Sidecast · Tablet';}
function tabletStatus(value){if(tablet)document.querySelector('#tablet-status').textContent=value;}
const view=createOverlay(document.querySelector('#live-content'),{target:desktop?'desktop':'browser',mode:['chat','alerts'].includes(params.get('mode'))?params.get('mode'):'combined'});
function update(snapshot){view.update(snapshot);if(tablet){tabletStatus(snapshot.status.state==='connected'?'Live · Streamer.bot':snapshot.status.state==='offline'?'Sidecast connected · Streamer.bot offline':`Sidecast connected · ${snapshot.status.label}`);document.querySelector('#tablet-empty').hidden=snapshot.messages.some(m=>snapshot.profile.platforms[m.platform])||!!snapshot.alert;}if(desktop){const unlocked=!snapshot.overlay.locked;document.body.classList.toggle('editing',unlocked);document.querySelector('#edit-bar').hidden=!unlocked;document.querySelector('#resize-grip').hidden=!unlocked;document.querySelector('#overlay-placeholder').hidden=!unlocked||appearanceFor(snapshot.profile,'desktop').topAligned||snapshot.messages.length>0||!!snapshot.alert;}}
if(desktop){
 update((await window.sidecast.getState()).snapshot);window.sidecast.onState(state=>update(state.snapshot));
 document.querySelector('#overlay-lock').onclick=()=>window.sidecast.windowAction('lock');document.querySelector('#overlay-hide').onclick=()=>window.sidecast.windowAction('hide');
 const grip=document.querySelector('#resize-grip');let drag,resizeFrame,pendingSize;
 const flushResize=()=>{resizeFrame=null;if(pendingSize){const size=pendingSize;pendingSize=null;window.sidecast.windowAction('resize',size);}};
 grip.onpointerdown=e=>{drag={x:e.screenX,y:e.screenY,w:innerWidth,h:innerHeight};grip.setPointerCapture(e.pointerId);};
 grip.onpointermove=e=>{if(drag){pendingSize={width:drag.w+e.screenX-drag.x,height:drag.h+e.screenY-drag.y};if(!resizeFrame)resizeFrame=requestAnimationFrame(flushResize);}};
 const endDrag=()=>{drag=null;cancelAnimationFrame(resizeFrame);flushResize();};grip.onpointerup=endDrag;grip.onlostpointercapture=endDrag;
}else{
 let retry,socket,closing=false;function connect(){const url=new URL('/live',location.href);url.protocol=location.protocol==='https:'?'wss:':'ws:';url.searchParams.set('token',params.get('token')||'');const ws=new WebSocket(url);socket=ws;
 ws.onmessage=e=>{try{const data=JSON.parse(e.data);if(data.type==='snapshot')update(data);}catch{}};
 ws.onclose=()=>{if(!closing){tabletStatus('Disconnected · Reconnecting…');retry=setTimeout(connect,2000);}};ws.onerror=()=>ws.close();
 }window.addEventListener('beforeunload',()=>{closing=true;clearTimeout(retry);socket?.close();view.destroy();},{once:true});connect();
}
