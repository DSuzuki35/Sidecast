export const AUDIO_TYPES=['follow','sub','resub','gift','raid','cheer'];
const templates={follow:'Thanks {name} for following!',sub:'Welcome {name}, thanks for subscribing!',resub:'Welcome back {name}. {detail}.',gift:'Thank you {name} for {detail}.',raid:'Welcome {name} and your community! {detail}.',cheer:'Thank you {name}! {detail}.'};
const volume=(v,f=70)=>Number.isFinite(Number(v))&&v!==null?Math.max(0,Math.min(150,Number(v))):f;
export function normalizeAudio(a={}) {
 return {enabled:a?.enabled===true,output:a?.output==='obs'?'obs':'desktop',volume:volume(a?.volume),engine:['qwen','chatterbox'].includes(a?.engine)?a.engine:'windows',expressiveness:Number.isFinite(Number(a?.expressiveness))&&a?.expressiveness!==null?Math.max(0,Math.min(100,Number(a.expressiveness))):50,device:a?.device==='cpu'?'cpu':'cuda',language:a?.language==='German'?'German':'English',voice:typeof a?.voice==='string'?a.voice.slice(0,150):'',
  types:Object.fromEntries(AUDIO_TYPES.map(type=>{const t=a?.types?.[type]||{};return [type,{sound:['none','chime','pulse','fanfare','custom'].includes(t.sound)?t.sound:(type==='raid'?'fanfare':'chime'),soundId:typeof t.soundId==='string'&&/^sound-[a-f0-9-]+\.(wav|mp3|ogg)$/.test(t.soundId)?t.soundId:'',soundName:typeof t.soundName==='string'?t.soundName.slice(0,100):'',volume:volume(t.volume,80),speak:t.speak===true,template:typeof t.template==='string'&&t.template.trim()?t.template.slice(0,300):templates[type]}];}))};
}
export function speechText(event,template) {
 const values={name:event.alertType==='raid'&&event.nameMissing?'our raiding community':event.name||'someone',detail:event.detail||'',message:event.message||'',type:event.alertType||'',platform:event.platform||''};
 // Existing/custom templates keep working; an explicit placeholder controls where the message is spoken.
 const spoken=template.replace(/\{(name|detail|message|type|platform)\}/g,(_,key)=>values[key]);
 return (spoken+(!template.includes('{message}')&&values.message?' '+values.message:'')).replace(/[\u0000-\u001f]/g,' ');
}
