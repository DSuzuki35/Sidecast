import {APPEARANCE_KEYS,appearanceFor} from './appearance.js';
import {fillIcons,svg,el,THEMES,ALERTS,createOverlay} from './shared.js';
import {mountAudioControls} from './audio-controls.js';
const $=s=>document.querySelector(s);const $$=s=>[...document.querySelectorAll(s)];
const api=window.sidecast;let state=await api.getState(),toastTimer,revision=0,saveChain=Promise.resolve();
const view=createOverlay($('#preview-content'));
let appearanceTarget='desktop';
let lastActivity='',lastOverlayButton;
const text=(selector,value)=>{const node=$(selector);if(node.textContent!==value)node.textContent=value;};
const profile=()=>state.settings.profiles.find(p=>p.id===state.settings.activeProfile)||state.settings.profiles[0];
const appearance=()=>profile().appearance.linked?profile():profile().appearance[appearanceTarget];
const shownProfile=()=>appearanceFor(profile(),appearanceTarget);
function toast(text){$('#toast').textContent=text;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,3200);}
function fail(error){toast(error?.message||'Something went wrong.');$('#save-status').textContent='Not saved — please try again.';}
window.addEventListener('unhandledrejection',event=>{event.preventDefault();fail(event.reason);});
function renderUpdates(){
 const u=state.updates;if(!u)return;
 text('#update-version',`v${u.version}`);
 text('#update-status',u.message+(u.phase==='downloading'?` ${u.percent}%`:''));
 $('#check-updates').disabled=['disabled','checking','downloading','ready'].includes(u.phase);
}
function renderLive(incoming){
 if(incoming?.updates)state.updates=incoming.updates;renderUpdates();
 if(incoming?.audioStatus)state.audioStatus=incoming.audioStatus;audioControls.renderStatus(state.audioStatus);
 if(incoming){if('warning' in incoming)state.warning=incoming.warning;state.passwordPersistent=incoming.passwordPersistent??state.passwordPersistent;}
 if(incoming){state.snapshot=incoming.snapshot;state.urls=incoming.urls||state.urls;state.serverError=incoming.serverError??state.serverError;state.shortcutError=incoming.shortcutError??state.shortcutError;state.hasPassword=incoming.hasPassword??state.hasPassword;if(incoming.settings)state.settings.overlay=incoming.settings.overlay;}
 const p=shownProfile(),snap=state.snapshot;
 view.setTarget(appearanceTarget);view.update({...snap,profile:p});$('.preview-stage').dataset.theme=p.theme;
 text('#preview-theme',`${THEMES[p.theme].name.toUpperCase()} / ${THEMES[p.theme].game.toUpperCase()}`);
 const hasContent=p.topAligned||(p.viewerCounts.enabled&&Object.values(p.viewerCounts.platforms).some(Boolean))||snap.messages.some(m=>p.platforms[m.platform])||!!snap.alert;
 if($('#preview-empty').hidden!==hasContent)$('#preview-empty').hidden=hasContent;text('#preview-state',snap.messages.some(m=>m.test)||snap.alert?.test?'TEST PREVIEW · ALSO VISIBLE IN OBS':snap.status.state==='connected'?'LIVE · STREAMER.BOT':'WAITING FOR EVENTS');
 text('#mini-status',snap.status.label);text('#connection-result',snap.status.label);
 $$('.status-dot').forEach(e=>{const cls='status-dot '+snap.status.state;if(e.className!==cls)e.className=cls;});
 text('#queue-count',snap.queued+' IN QUEUE'+(snap.preparing?' · PREPARING AUDIO':''));
 text('#lock-overlay',state.settings.overlay.locked?'Unlock overlay':'Lock overlay');
 if(lastOverlayButton!==state.settings.overlay.visible){lastOverlayButton=state.settings.overlay.visible;$('#open-overlay').innerHTML=svg('external')+(lastOverlayButton?'Overlay is open':'Open overlay');}
 const notices=[state.warning,state.serverError,state.shortcutError].filter(Boolean);$('#notice').hidden=!notices.length;text('#notice',notices.join(' · '));
 const activityKey=JSON.stringify(snap.activity.map(a=>[a.id,a.alertType,a.time,a.test]));if(activityKey===lastActivity)return;lastActivity=activityKey;
 const activity=$('#activity');activity.replaceChildren();
 if(!snap.activity.length){const empty=el('div','empty-activity');empty.innerHTML=svg('spark');empty.append(el('p','','Your next big moments will appear here.'),el('p','','Run a test or connect Streamer.bot.'));activity.append(empty);}
 for(const a of snap.activity){const def=ALERTS[a.alertType];const row=el('div','activity-item');const icon=el('span','event-icon');icon.innerHTML=svg(def.icon);const text=el('div');text.append(el('strong','',a.name),el('p','',def.label+(a.test?' · TEST':'')));row.append(icon,text,el('time','',new Date(a.time).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})));activity.append(row);}
}
function renderControls(){
 text('[data-mode=chat]',appearanceTarget==='browser'?'Chat source':'Chat + alerts');text('[data-mode=alerts]',appearanceTarget==='browser'?'Alerts source':'Alert only');
 audioControls.render(state.audioStatus);
 const p=shownProfile();$('#appearance-target').value=appearanceTarget;$('#appearance-linked').checked=profile().appearance.linked;text('#appearance-hint',profile().appearance.linked?'Editing both outputs. Unlink to customize them separately.':`Editing ${appearanceTarget==='desktop'?'desktop overlay':'browser source'} appearance. Chat, filters, alert timing and audio stay synchronized.`);$('#profile-select').replaceChildren(...state.settings.profiles.map(p=>{const o=el('option','',p.name);o.value=p.id;return o;}));$('#profile-select').value=p.id;
 $('#delete-profile').disabled=state.settings.profiles.length<2;
 $$('[data-profile]').forEach(input=>{const value=p[input.dataset.profile];if(input.type==='checkbox')input.checked=value;else input.value=value;rangeOutput(input);});
 const desktopOnly=appearanceTarget==='desktop'&&!profile().appearance.linked;const placement=$('[data-profile="alertPlacement"]');placement.disabled=desktopOnly;if(desktopOnly)placement.value='inline';text('#alert-placement-hint',desktopOnly?'Desktop alerts always use compact cards. Select Browser source above to configure fullscreen alerts.':'Desktop alerts always use compact cards. In OBS: Compact shows a box in the Chat source; Fullscreen shows only in the separate Alerts source; Both shows one in each. Add the Alerts source at your canvas resolution (for example 1920 × 1080). Sound and speech play once.');
 $$('[data-platform]').forEach(input=>input.checked=p.platforms[input.dataset.platform]);
 $('#viewers-enabled').checked=p.viewerCounts.enabled;$$('[data-viewer-platform]').forEach(input=>input.checked=p.viewerCounts.platforms[input.dataset.viewerPlatform]);
 $$('[data-alert]').forEach(input=>input.checked=p.alerts[input.dataset.alert]);
 $$('[data-alert-duration]').forEach(input=>{input.value=p.alertDurations[input.dataset.alertDuration];rangeOutput(input);});
 $$('[data-highlight]').forEach(input=>input.checked=p.highlights[input.dataset.highlight]);
 $$('[data-highlight-list]').forEach(input=>input.value=p.highlights[input.dataset.highlightList].join(', '));
 $$('[data-theme-choice]').forEach(button=>button.classList.toggle('selected',button.dataset.themeChoice===p.theme));
 $('#accent').value=p.accent;$('#accent-value').textContent=p.accent.toUpperCase();$$('[data-color]').forEach(b=>b.classList.toggle('active',b.dataset.color===p.accent));
 $('#connection-host').value=state.settings.connection.host;$('#connection-port').value=state.settings.connection.port;$('#auto-connect').checked=state.settings.connection.autoConnect;
 $('#connection-password').placeholder=state.hasPassword?'Saved · leave blank to keep':'Optional';
 $('#password-hint').textContent=state.passwordPersistent?'Password is encrypted using Windows.':'Password is kept for this session only.';
 $('#forget-password').hidden=!state.hasPassword;
 $('#hotkey-input').value=state.settings.hotkey;$('#source-port').value=state.settings.sourcePort;$('#always-on-top').checked=state.settings.overlay.alwaysOnTop;$('#hotkey-display').textContent=state.settings.hotkey.replace('Control','Ctrl').split('+').join(' + ');
 renderSources();renderLive();
}
function rangeOutput(input){if(input.type!=='range')return;const out=$(`output[for="${input.id}"]`);if(out)out.textContent=input.value+' '+input.dataset.unit;input.style.setProperty('--fill',((input.value-input.min)/(input.max-input.min)*100)+'%');}
function save(){const mine=++revision,payload=structuredClone(state.settings);$('#save-status').textContent='Saving …';saveChain=saveChain.catch(()=>{}).then(()=>api.saveSettings(payload)).then(result=>{if(mine===revision){state={...result};$('#save-status').textContent='Saved · only on this PC';renderLive();renderSources();}return result;});saveChain.catch(fail);return saveChain;}
async function testAlert(type){await save();await api.testEvent(type);toast(profile().audio.enabled?'Test queued with speech. Local AI may take a moment.':'Visual test queued. Enable alert audio to hear speech.');}
function changeProfile(key,value){(APPEARANCE_KEYS.includes(key)?appearance():profile())[key]=value;renderControls();return save();}
function showPage(name){$$('[data-section]').forEach(s=>s.hidden=s.dataset.section!==name);$$('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===name));if(name==='studio'||name==='alerts')$(`[data-section="${name}"] .page-heading`).after($('.appearance-settings'));$('#breadcrumb').textContent={studio:'Studio',alerts:'Alerts & Events',sources:'Browser sources',connection:'Connection'}[name];window.scrollTo(0,0);}
function renderSources(){
 const defs={chat:['Chat','Chat with compact alert cards when Compact or Both is selected.','chat'],alerts:['Alerts','Fullscreen alerts only. Use Fullscreen or Both; set this source to your canvas size.','spark']};
 $('#source-cards').replaceChildren(...Object.entries(defs).map(([mode,[title,description,icon]])=>{
  const card=el('section','panel source-card');const mark=el('span','event-icon');mark.innerHTML=svg(icon);const input=el('input');input.readOnly=true;input.value=state.urls[mode]||'Browser source unavailable';input.setAttribute('aria-label',title+' URL');
  const button=el('button','button','Copy URL');button.insertAdjacentHTML('afterbegin',svg('copy'));button.disabled=!state.urls[mode];button.onclick=async()=>{await api.copySource(mode);toast(title+' URL copied. Paste it into an OBS browser source.');};
  card.append(mark,el('h2','',title),el('p','',description),input,button);return card;
 }));
}
for(const [type,def] of Object.entries(ALERTS)){
 const row=el('div','alert-option');const heading=el('div','alert-option-heading');const icon=el('span','event-icon');icon.innerHTML=svg(def.icon);const desc=el('div','event-description');desc.append(el('strong','',def.label),el('p','',def.hint));
 const button=el('button','button subtle','Test');button.setAttribute('aria-label',def.label+' test');button.title='Test alert with speech (when alert audio is enabled)';button.onclick=()=>testAlert(type);
 const toggle=el('label','toggle-row');const input=el('input');input.type='checkbox';input.dataset.alert=type;input.setAttribute('aria-label',def.label+' enabled');input.onchange=()=>{profile().alerts[type]=input.checked;save();};toggle.append(input,el('i'));heading.append(icon,desc,button,toggle);
 const duration=el('div','alert-duration');const labelRow=el('div','control-label');const label=el('label','','Display duration');const slider=el('input');slider.type='range';slider.min='3';slider.max='30';slider.step='1';slider.id='duration-'+type;slider.dataset.alertDuration=type;slider.dataset.unit='s';slider.setAttribute('aria-label',def.label+' duration');label.htmlFor=slider.id;const output=el('output');output.htmlFor=slider.id;labelRow.append(label,output);duration.append(labelRow,slider);
 slider.oninput=()=>{profile().alertDurations[type]=Number(slider.value);rangeOutput(slider);};slider.onchange=()=>{profile().alertDurations[type]=Number(slider.value);rangeOutput(slider);save();};
 row.append(heading,duration);$('#alert-options').append(row);
}
const forgetPassword=el('button','button subtle','Remove saved password');forgetPassword.id='forget-password';forgetPassword.type='button';forgetPassword.style.marginTop='12px';forgetPassword.onclick=async()=>{state=await api.connection('forget-password');renderControls();toast('Saved password removed.');};$('#password-hint').after(forgetPassword);
const audioControls=mountAudioControls({api,getProfile:profile,save,notify:toast});
fillIcons();renderControls();api.onState(renderLive);
 $$('[data-highlight]').forEach(input=>input.onchange=()=>{appearance().highlights[input.dataset.highlight]=input.checked;renderLive();save();});
 $$('[data-highlight-list]').forEach(input=>input.onchange=()=>{appearance().highlights[input.dataset.highlightList]=[...new Set(input.value.split(',').map(s=>s.trim().replace(/^@/,'').slice(0,64)).filter(Boolean))].slice(0,20);input.value=appearance().highlights[input.dataset.highlightList].join(', ');renderLive();save();});
$$('[data-page]').forEach(b=>b.onclick=()=>showPage(b.dataset.page));$('.brand').onclick=e=>{e.preventDefault();showPage('studio');};
$$('[data-mode]').forEach(b=>b.onclick=()=>{$$('[data-mode]').forEach(x=>x.classList.toggle('active',x===b));view.setMode(b.dataset.mode);});
$$('[data-theme-choice]').forEach(b=>b.onclick=()=>{appearance().theme=b.dataset.themeChoice;appearance().accent=THEMES[appearance().theme].accent;renderControls();save();});
$$('[data-color]').forEach(b=>b.onclick=()=>changeProfile('accent',b.dataset.color));$('#accent').oninput=e=>{appearance().accent=e.target.value;$('#accent-value').textContent=e.target.value.toUpperCase();renderLive();};$('#accent').onchange=()=>{renderControls();save();};
$$('[data-profile]').forEach(input=>{const apply=()=>{(APPEARANCE_KEYS.includes(input.dataset.profile)?appearance():profile())[input.dataset.profile]=input.type==='checkbox'?input.checked:input.dataset.profile==='alertPlacement'?input.value:Number(input.value);rangeOutput(input);renderLive();};input.oninput=apply;input.onchange=()=>{apply();save();};});
$('#viewers-enabled').onchange=()=>{appearance().viewerCounts.enabled=$('#viewers-enabled').checked;renderLive();save();};
$$('[data-viewer-platform]').forEach(input=>input.onchange=()=>{appearance().viewerCounts.platforms[input.dataset.viewerPlatform]=input.checked;renderLive();save();});
$$('[data-platform]').forEach(input=>input.onchange=()=>{profile().platforms[input.dataset.platform]=input.checked;renderLive();save();});
$('#appearance-target').onchange=e=>{appearanceTarget=e.target.value;renderControls();};
$('#appearance-linked').onchange=async e=>{const p=profile(),look=structuredClone(appearance()),browserPlacement=appearanceFor(p,'browser').alertPlacement;if(e.target.checked){for(const key of APPEARANCE_KEYS)p[key]=look[key];p.alertPlacement=browserPlacement;p.appearance.linked=true;}else{const copy=Object.fromEntries(APPEARANCE_KEYS.map(key=>[key,structuredClone(look[key])]));p.appearance={linked:false,desktop:structuredClone(copy),browser:structuredClone(copy)};}renderControls();await save();};
$('#profile-select').onchange=e=>{state.settings.activeProfile=e.target.value;renderControls();save();};
$('#save-profile').onclick=()=>{$('#profile-name').value='';$('#profile-dialog').showModal();};
$('#profile-dialog').addEventListener('close',()=>{if($('#profile-dialog').returnValue!=='save')return;if(state.settings.profiles.length>=20)return toast('You can save up to 20 profiles.');const copy={...structuredClone(profile()),id:crypto.randomUUID(),name:$('#profile-name').value.trim()||'My setup'};state.settings.profiles.push(copy);state.settings.activeProfile=copy.id;renderControls();save();});
$('#delete-profile').onclick=()=>{if(state.settings.profiles.length<2)return;state.settings.profiles=state.settings.profiles.filter(p=>p.id!==state.settings.activeProfile);state.settings.activeProfile=state.settings.profiles[0].id;renderControls();save();};
$('#test-chat').onclick=$('#empty-demo').onclick=()=>api.testEvent('chat');$('#test-raid').onclick=()=>testAlert('raid');$('#clear-chat').onclick=()=>api.testEvent('clear');
$('#open-overlay').onclick=()=>api.windowAction('show');$('#hide-overlay').onclick=()=>api.windowAction('hide');$('#lock-overlay').onclick=()=>api.windowAction(state.settings.overlay.locked?'unlock':'lock');$('#reset-position').onclick=()=>api.windowAction('reset');$('#quit').onclick=()=>api.windowAction('quit');
$('#connection-form').onsubmit=async e=>{e.preventDefault();state.settings.connection={host:$('#connection-host').value.trim(),port:Number($('#connection-port').value),autoConnect:$('#auto-connect').checked};await save();const password=$('#connection-password').value;const result=await api.connection('connect',password||undefined);state.hasPassword=result.hasPassword;$('#connection-password').value='';renderControls();};
$('#disconnect').onclick=()=>api.connection('disconnect');
$('#check-updates').onclick=async()=>{state.updates=await api.checkUpdates();renderUpdates();};
$('#auto-connect').onchange=()=>{state.settings.connection.autoConnect=$('#auto-connect').checked;save();};
$('#save-advanced').onclick=async()=>{state.settings.hotkey=$('#hotkey-input').value;state.settings.sourcePort=Number($('#source-port').value);state.settings.overlay.alwaysOnTop=$('#always-on-top').checked;await save();renderControls();toast('Settings saved.');};
