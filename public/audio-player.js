import {setAudioGain,resumeAudio,releaseAudioGain} from './audio-gain.js';
const params=new URLSearchParams(location.search),output=params.get('desktop')==='1'?'desktop':'obs';
let socket,retry,closing=false,current=null,playing=null,generation=0;const seen=new Set();
function stop(){generation++;if(playing){playing.pause();releaseAudioGain(playing);playing.src='';playing=null;}document.body.dataset.state='idle';}
async function play(clips,mine,endsAt){
 for(const clip of clips){if(generation!==mine||Date.now()>=endsAt)return;const url=new URL('/media/'+encodeURIComponent(clip.id),location.href);url.searchParams.set('token',params.get('token')||'');const audio=new Audio(url);setAudioGain(audio,clip.volume);playing=audio;document.body.dataset.state='playing';
  await new Promise(resolve=>{let timer;const done=()=>{clearTimeout(timer);audio.pause();releaseAudioGain(audio);resolve();};audio.onended=done;audio.onerror=done;audio.onemptied=done;resumeAudio().then(()=>{if(generation!==mine){done();return;}return audio.play();}).then(()=>{if(clip.maxSeconds)timer=setTimeout(done,clip.maxSeconds*1000);}).catch(()=>{document.body.dataset.state='blocked';done();});});
 }
 if(generation===mine){playing=null;document.body.dataset.state='idle';}
}
function update(snapshot){const alert=snapshot.alert;const enabled=snapshot.profile.audio?.enabled&&snapshot.profile.audio.output===output;const key=alert?`${alert.id}:${alert.startedAt}`:null;
 if(!enabled||!alert||snapshot.serverTime>=alert.endsAt){current=null;stop();return;}
 if(current===key)return;current=key;stop();if(seen.has(key))return;seen.add(key);if(seen.size>200)seen.delete(seen.values().next().value);
 if(!alert.audio||alert.audio.output!==output||snapshot.serverTime-alert.startedAt>1500)return;
 const endsAt=Date.now()+alert.endsAt-snapshot.serverTime;play(alert.audio.clips,generation,endsAt);
}
function connect(){const url=new URL('/live',location.href);url.protocol=location.protocol==='https:'?'wss:':'ws:';url.searchParams.set('token',params.get('token')||'');url.searchParams.set('audio','1');socket=new WebSocket(url);socket.onmessage=e=>{try{const state=JSON.parse(e.data);if(state.type==='snapshot')update(state);}catch{}};socket.onerror=()=>socket.close();socket.onclose=()=>{stop();current=null;if(!closing)retry=setTimeout(connect,2000);};}
window.addEventListener('beforeunload',()=>{closing=true;clearTimeout(retry);stop();socket?.close();},{once:true});connect();
