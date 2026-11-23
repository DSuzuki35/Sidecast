import {el,ALERTS} from './shared.js';
import {setAudioGain,resumeAudio,releaseAudioGain} from './audio-gain.js';
const option=(value,label)=>{const o=el('option','',label);o.value=value;return o;};
function select(options){const node=el('select');node.append(...options.map(([value,label])=>option(value,label)));return node;}
function field(label,input){const box=el('label','audio-field',label);box.append(input);return box;}
function toggle(label){const box=el('label','toggle-row');const input=el('input');input.type='checkbox';box.append(el('span','',label),input,el('i'));return {box,input};}
export function mountAudioControls({api,getProfile,save,notify}) {
 const panel=el('section','panel audio-settings');const heading=el('div','panel-heading');const master=toggle('Enable alert audio');heading.append(el('h2','','Sounds & speech'),master.box);panel.append(heading);
 const content=el('div','settings-content audio-global');const output=select([['desktop','Desktop playback'],['obs','OBS audio source']]);const volume=el('input');volume.type='range';volume.min='0';volume.max='150';volume.setAttribute('aria-label','Master audio volume');const volumeLabel=el('output');
 const volumeField=field('Master volume',volume);volumeField.append(volumeLabel);const engine=select([['windows','Windows voice · lightweight'],['qwen','My voice · Qwen (local AI)'],['chatterbox','My voice · Chatterbox (expressive)']]);const device=select([['cuda','NVIDIA GPU'],['cpu','CPU']]);device.setAttribute('aria-label','AI processing device');const language=select([['English','English'],['German','German']]);const voices=select([['','Automatic voice']]);
 output.setAttribute('aria-label','Audio output');engine.setAttribute('aria-label','Speech engine');language.setAttribute('aria-label','Speech language');voices.setAttribute('aria-label','Windows voice');
 content.append(field('Audio output',output),volumeField,field('Speech engine',engine),field('Speech language',language),field('Windows voice',voices),field('Local AI device',device));
 const expression=el('input');expression.type='range';expression.min='0';expression.max='100';expression.step='5';expression.setAttribute('aria-label','Expressiveness');const expressionLabel=el('output');const expressionField=field('Expressiveness',expression);expressionField.append(expressionLabel,el('span','hint','Calm → expressive. 50% is natural; try 70–80% for more animated alerts. This changes Chatterbox delivery, not volume.'));content.append(expressionField);
 const buttons=el('div','audio-actions');const install=el('button','button subtle','Install local voice engine'),reference=el('button','button subtle','Choose my recording'),refresh=el('button','button subtle','Refresh status'),unload=el('button','button subtle','Unload model'),copy=el('button','button subtle','Copy OBS audio URL');buttons.append(install,reference,refresh,unload,copy);
 const status=el('p','hint');status.id='audio-engine-status';const hint=el('p','hint','For OBS, add the dedicated audio URL as one browser source and enable “Control audio via OBS”. TTS finishes before the next alert; it can extend the display duration. Your voice uses a local 3–30 second WAV recording. Local AI needs processing time and uses the selected device; Windows voices are the lighter option.');panel.append(content,buttons,status,hint);
 const preview=el('div','speech-preview');preview.append(el('h3','','Voice preview'));
 const input=el('textarea');input.id='speech-preview-text';input.maxLength=300;input.rows=3;input.placeholder='Type a sentence to try your voice…';input.setAttribute('aria-label','Voice preview text');
 const play=el('button','primary','Play voice preview'),stop=el('button','button subtle','Stop preview');stop.disabled=true;
 const actions=el('div','speech-preview-actions');actions.append(play,stop);const feedback=el('p','hint','Local playback only — not sent to OBS or overlays. Uses the selected voice, language and master volume, even when alert audio is off.');feedback.id='speech-preview-status';feedback.setAttribute('role','status');
 let player=null,previewGeneration=0;const media=el('div');preview.append(field('Custom test text',input),actions,feedback,media);panel.append(preview);
 const clearPlayer=()=>{if(player){player.pause();releaseAudioGain(player);player.removeAttribute('src');player.load();player.remove();player=null;}};
 stop.onclick=async()=>{previewGeneration++;clearPlayer();play.disabled=false;stop.disabled=true;feedback.textContent='Preview stopped.';await api.audioAction('stop-preview');};
 play.onclick=async()=>{
  if(!input.value.trim()){feedback.textContent='Enter some text to test your voice.';input.focus();return;}
  const mine=++previewGeneration;clearPlayer();play.disabled=true;stop.disabled=false;feedback.textContent='Preparing speech… Local AI can take longer on its first request.';
  try{
   await save();if(mine!==previewGeneration)return;
   const result=await api.audioAction('preview',input.value);if(mine!==previewGeneration||!result)return;
   player=el('audio');player.controls=true;player.src=result.url;player.setAttribute('aria-label','Generated voice preview');media.append(player);setAudioGain(player,result.volume);
   player.onended=()=>{if(mine!==previewGeneration)return;feedback.textContent='Preview finished. Press Play on the player to listen again.';};
   player.onerror=()=>{if(mine!==previewGeneration)return;feedback.textContent='Could not play the generated audio. Try again.';};
   await resumeAudio();if(mine!==previewGeneration)return;await player.play();if(mine!==previewGeneration)return;feedback.textContent=result.volume===0?'Playing preview — master volume is muted.':'Playing voice preview locally.';
  }catch(error){if(mine===previewGeneration)feedback.textContent=player?'Voice ready — press Play on the player to listen.':(error.message||'Could not prepare speech.');}
  finally{if(mine===previewGeneration){play.disabled=false;stop.disabled=!player;}}
 };
 window.addEventListener('beforeunload',()=>{previewGeneration++;clearPlayer();api.audioAction('stop-preview').catch(()=>{});});
 const layout=document.querySelector('.alert-layout');layout.before(panel);
 const controls=new Map();
 for(const [type,def] of Object.entries(ALERTS)){
  const row=document.querySelector(`[data-alert="${type}"]`).closest('.alert-option');const details=el('details','alert-audio');details.append(el('summary','','Sound & speech'));
  const grid=el('div','audio-type-grid');const sound=select([['none','Silent'],['chime','Soft chime'],['pulse','Pulse'],['fanfare','Fanfare'],['custom','Custom file']]);sound.setAttribute('aria-label',def.label+' sound');const upload=el('button','button subtle','Choose sound');
  const gain=el('input');gain.type='range';gain.min='0';gain.max='150';gain.setAttribute('aria-label',def.label+' sound volume');const gainOutput=el('output');const gainField=field('Volume',gain);gainField.append(gainOutput);
  const speak=toggle('Read this alert aloud');speak.input.setAttribute('aria-label',def.label+' speech');const template=el('input');template.type='text';template.maxLength=300;template.setAttribute('aria-label',def.label+' speech template');const templateField=field('Spoken text',template);const filename=el('span','audio-file-name');const help=el('p','hint','Placeholders: {name}, {detail}, {message}, {type}, {platform}. The full attached message is read after your template unless you place {message} yourself. Test includes speech when alert audio is on. This switch controls automatic speech for real alerts.');
  grid.append(field('Sound',sound),upload,gainField,speak.box,templateField,filename,help);details.append(grid);row.append(details);controls.set(type,{sound,gain,gainOutput,speak:speak.input,template,filename});
  sound.onchange=()=>{getProfile().audio.types[type].sound=sound.value;save();};gain.oninput=()=>{getProfile().audio.types[type].volume=Number(gain.value);gainOutput.textContent=gain.value+'%';};gain.onchange=()=>save();speak.input.onchange=()=>{getProfile().audio.types[type].speak=speak.input.checked;save();};template.onchange=()=>{getProfile().audio.types[type].template=template.value;save();};
  upload.onclick=async()=>{const file=await api.audioAction('sound');if(file){Object.assign(getProfile().audio.types[type],{sound:'custom',soundId:file.id,soundName:file.name});sound.value='custom';filename.textContent=file.name;await save();}};
 }
 master.input.onchange=()=>{getProfile().audio.enabled=master.input.checked;save();};output.onchange=()=>{getProfile().audio.output=output.value;save();};engine.onchange=()=>{getProfile().audio.engine=engine.value;renderStatus(lastStatus);save();};language.onchange=()=>{getProfile().audio.language=language.value;save();};voices.onchange=()=>{getProfile().audio.voice=voices.value;save();};volume.oninput=()=>{getProfile().audio.volume=Number(volume.value);volumeLabel.textContent=volume.value+'%';};volume.onchange=()=>save();
 expression.oninput=()=>{getProfile().audio.expressiveness=Number(expression.value);expressionLabel.textContent=expression.value+'%';};expression.onchange=()=>save();
 install.onclick=async()=>{await save();renderStatus(await api.audioAction('setup'));notify('Local voice engine setup started. The first download is several GB.');};reference.onclick=async()=>{const result=await api.audioAction('reference');if(result)renderStatus(result);};refresh.onclick=async()=>renderStatus(await api.audioAction('status'));unload.onclick=async()=>renderStatus(await api.audioAction('unload'));copy.onclick=async()=>{await api.copySource('audio');notify('Audio URL copied. Add it once in OBS.');};
 let voiceKey='',lastStatus={};
 device.onchange=()=>{getProfile().audio.device=device.value;save();};
 function renderStatus(s){if(!s)return;lastStatus=s;const key=JSON.stringify(s.voices||[]);if(key!==voiceKey){voiceKey=key;voices.replaceChildren(option('','Automatic voice'),...(s.voices||[]).map(v=>option(v.name,`${v.name} · ${v.language}`)));voices.value=getProfile().audio.voice;}
  const selected=getProfile().audio.engine,isAI=selected!=='windows',installed=selected==='chatterbox'?s.chatterboxInstalled:s.qwenInstalled,label=selected==='chatterbox'?'Chatterbox':'Qwen';expressionField.hidden=selected!=='chatterbox';expression.disabled=selected!=='chatterbox';expression.value=getProfile().audio.expressiveness;expressionLabel.textContent=expression.value+'%';
  const value=[s.installing?'Installing local AI engine …':isAI?`${label} ${installed?'ready':'not installed'}`:'Windows speech',s.hasReference?`Voice recording: ${s.voiceName}`:'No personal voice recording selected',s.busy?'Preparing speech …':s.qwenLoaded||s.chatterboxLoaded?'AI model loaded · auto-unloads after 60 seconds':'AI model unloaded',s.error].filter(Boolean).join(' · ');if(status.textContent!==value)status.textContent=value;install.disabled=s.installing;install.hidden=!isAI||installed;install.textContent=`Install ${label} voice engine`;unload.disabled=!s.qwenLoaded&&!s.chatterboxLoaded;
 }
 return {renderStatus,render(s){const a=getProfile().audio;master.input.checked=a.enabled;output.value=a.output;engine.value=a.engine;device.value=a.device;language.value=a.language;voices.value=a.voice;volume.value=a.volume;volumeLabel.textContent=a.volume+'%';for(const [type,c] of controls){const t=a.types[type];c.sound.value=t.sound;c.gain.value=t.volume;c.gainOutput.textContent=t.volume+'%';c.speak.checked=t.speak;c.template.value=t.template;c.filename.textContent=t.soundName;}renderStatus(s);}};
}
