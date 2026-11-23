import {appearanceFor,alertPresentation} from './appearance.js';
import {emojiParts,messageHighlight} from './text.js';
export const icons={
 grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
 spark:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z"/>',
 layers:'<path d="m12 3 10 5-10 5L2 8l10-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
 link:'<path d="m10 13 4-4m-5 6-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 10a4 4 0 0 0 6 0l4-4a4 4 0 0 0-6-6l-2 2" transform="translate(1 -1)"/>',
 external:'<path d="M14 3h7v7m0-7L10 14m0-10H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-5"/>',
 sliders:'<path d="M4 7h7m4 0h5M4 17h3m4 0h9"/><circle cx="13" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
 trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
 power:'<path d="M12 2v10m6-7a9 9 0 1 1-12 0"/>',
 chat:'<path d="M21 11a8 8 0 0 1-8 8H7l-5 3 2-6a8 8 0 1 1 17-5Z"/><path d="M7 10h10m-10 4h6"/>',
 eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
 heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0l-1 1-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
 star:'<path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6Z"/>',
 gift:'<path d="M3 8h18v4H3zM5 12v9h14v-9M12 8v13M12 8H8a3 3 0 1 1 3-3l1 3Zm0 0h4a3 3 0 1 0-3-3l-1 3Z"/>',
 raid:'<path d="m3 7 5 5-5 5m7-10 5 5-5 5m7-10 5 5-5 5"/>',
 bolt:'<path d="m13 2-9 12h7l-1 8 10-12h-7l1-8Z"/>',
 copy:'<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>'
};
export const svg=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.spark}</svg>`;
export function fillIcons(root=document){root.querySelectorAll('[data-icon]').forEach(e=>e.innerHTML=svg(e.dataset.icon));}
export const THEMES={grid:{name:'Grid',game:'iRacing',accent:'#ff6548'},endurance:{name:'Endurance',game:'LMU',accent:'#e2ed64'},vice:{name:'Vice',game:'GTA6',accent:'#d48bff'},minimal:{name:'Minimal',game:'Essentials',accent:'#e2e5e9'}};
export const ALERTS={follow:{title:'NEW FOLLOW',label:'Follows',icon:'heart',hint:'A new face in your community.'},sub:{title:'NEW SUB',label:'Subs & Members',icon:'star',hint:'New subscriptions and YouTube memberships.'},resub:{title:'WELCOME BACK',label:'Resubs',icon:'spark',hint:'For the regulars who keep coming back.'},gift:{title:'GIFTED LOVE',label:'Gift Subs',icon:'gift',hint:'Gifted subscriptions and memberships.'},raid:{title:'RAID INCOMING',label:'Raids',icon:'raid',hint:'A whole community drops in.'},cheer:{title:'BIG SUPPORT',label:'Cheers & Support',icon:'bolt',hint:'Bits, Super Chats, Super Stickers, and Kicks.'}};
export function el(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;}
function platformIcon(platform){const e=el('span',`platform-icon ${platform}`);e.title={twitch:'Twitch',youtube:'YouTube',kick:'Kick'}[platform]||platform;e.setAttribute('aria-label',e.title);
 const paths={twitch:'<path d="M4 2 2 6v14h5v3l4-3h5l6-6V2Zm16 11-4 4h-5l-3 3v-3H5V4h15Z"/><path d="M10 7h2v6h-2zm5 0h2v6h-2z"/>',youtube:'<path d="M22 7s0-3-3-3H5C2 4 2 7 2 7v10s0 3 3 3h14c3 0 3-3 3-3Z"/><path d="m10 8 6 4-6 4Z" fill="#15161b"/>',kick:'<path d="M3 3h6v6h3V6h3V3h6v6h-3v3h-3v3h3v3h3v3h-6v-3h-3v-3H9v6H3Z"/>'};
 e.innerHTML=`<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${paths[platform]||''}</svg>`;return e;
}
function image(url,alt,cls,onError){const img=el('img',cls);img.src=url;img.alt=alt;img.referrerPolicy='no-referrer';img.addEventListener('error',()=>{if(onError){onError(img);return;}if(cls==='emote')img.replaceWith(document.createTextNode((img.classList.contains('emote-layer')?' ':'')+alt));else img.remove();},{once:true});return img;}
function appendEmojiText(node,text){for(const part of emojiParts(text))node.append(part.emoji?el('span','unicode-emoji',part.text):document.createTextNode(part.text));return node;}
function appendEmotes(body,fragments){
 let group=null,space='';
 const flush=()=>{if(space){appendEmojiText(body,space);space='';}};
 for(const fragment of fragments){
  if(!fragment.image){if(group&&/^\s*$/.test(fragment.text)){space+=fragment.text;continue;}flush();appendEmojiText(body,fragment.text);group=null;continue;}
  const img=image(fragment.image,fragment.text,'emote',failed=>{const stack=failed.parentElement;if(stack?.classList.contains('emote-stack'))stack.replaceWith(document.createTextNode([...stack.querySelectorAll('img')].map(n=>n.alt).join(' ')));});img.title=fragment.text+(fragment.provider?' · '+({bttv:'BetterTTV',ffz:'FrankerFaceZ',seventv:'7TV'}[fragment.provider]||fragment.provider):'');
  if(fragment.zeroWidth&&group){space='';img.classList.add('emote-layer');group.append(img);}
  else{flush();group=el('span','emote-stack');group.append(img);body.append(group);}
 }
 flush();
}
function messageNode(m,p){
 const card=el('article','chat-message');card.dataset.id=m.id;card.dataset.emoteRevision=m.emoteRevision||0;
 const isAlert=m.kind==='alert-message';if(isAlert){card.classList.add('chat-alert-message');card.dataset.alertType=m.alertType;}
 const highlight=isAlert?'':messageHighlight(m,p.highlights);if(highlight)card.dataset.highlight=highlight;
 const meta=el('div','message-meta');if(p.platformIcons)meta.append(platformIcon(m.platform));
 if(p.badges){for(const badge of m.badges||[])meta.append(image(badge.image,badge.name,'badge'));if(m.role)meta.append(el('span','role-badge',m.role));}
 const name=appendEmojiText(el('strong','username'),m.name);if(m.color)name.style.color=m.color;meta.append(name);
 if(isAlert){const def=ALERTS[m.alertType]||ALERTS.follow;const label=el('span','chat-alert-label');label.innerHTML=svg(def.icon);label.append(document.createTextNode(def.title));meta.append(label);}
 if(highlight)meta.append(el('span','highlight-label',{mention:'MENTION',person:'SPOTLIGHT',moderator:'MOD'}[highlight]));
 if(m.test)meta.append(el('span','test-badge','TEST'));
 if(p.timestamps)meta.append(el('time','message-time',new Date(m.time).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})));
 const body=el('div','message-body');const fragments=m.fragments?.length?m.fragments:[{text:m.text}];appendEmotes(body,fragments);
 const parts=emojiParts(m.text);const emojiCount=parts.filter(p=>p.emoji).length;if(emojiCount>0&&emojiCount<=6&&parts.every(p=>p.emoji||!p.text.trim())&&!fragments.some(f=>f.image))body.classList.add('emoji-only');
 card.append(meta,body);return card;
}
export function createOverlay(container,{mode='combined',target='desktop'}={}) {
 const alertSlot=el('div','alert-slot compact-alert-slot'),centerSlot=el('div','alert-slot centered-alert-slot');alertSlot.hidden=centerSlot.hidden=true;const chat=el('section','chat-box');const head=el('div','chat-heading');head.innerHTML='<span><i></i> LIVE CHAT</span><span class="chat-heading-mark">SIDECAST / LIVE</span>';const mark=head.lastElementChild,counts=el('span','viewer-counts');head.append(counts);const stack=el('div','chat-stack');chat.append(head,stack);container.append(alertSlot,chat,centerSlot);
 let latest=null,lastMessages='',lastStyle='',lastAlert='',lastTheme='',lastViewers='',currentMode=mode,clockOffset=0,timer;const nodes=new Map();
 function paint(){
  clearTimeout(timer);if(!latest)return;const p=appearanceFor(latest.profile,target);const now=Date.now()+clockOffset;
  const themeKey=JSON.stringify([p.theme,p.accent,p.fontSize,p.opacity,p.spacing,p.radius]);
  if(themeKey!==lastTheme){lastTheme=themeKey;container.dataset.theme=p.theme;container.style.setProperty('--accent',p.accent);container.style.setProperty('--chat-font',p.fontSize+'px');container.style.setProperty('--chat-opacity',p.opacity/100);container.style.setProperty('--message-gap',p.spacing+'px');container.style.setProperty('--chat-radius',p.radius+'px');}
  container.classList.toggle('only-alerts',currentMode==='alerts');
  container.classList.toggle('chat-top-aligned',!!p.topAligned);
  const placement=alertPresentation(p.alertPlacement,target,currentMode);
  if(container.dataset.alertPlacement!==(placement||'none'))container.dataset.alertPlacement=placement||'none';
  const messages=latest.messages.filter(m=>p.platforms[m.platform]&&(!p.fadeSeconds||now-m.time<p.fadeSeconds*1000)).slice(-p.maxMessages);
  const selected=p.viewerCounts?.enabled?['twitch','youtube'].filter(k=>p.viewerCounts.platforms[k]):[];
  chat.hidden=currentMode==='alerts'||(!messages.length&&!selected.length&&!p.topAligned);stack.hidden=!messages.length;mark.hidden=selected.length>0;counts.hidden=!selected.length;
  const viewerKey=JSON.stringify(selected.map(k=>[k,latest.viewers?.[k]??null]));
  if(viewerKey!==lastViewers){lastViewers=viewerKey;counts.replaceChildren(...selected.map(platform=>{const value=latest.viewers?.[platform],known=Number.isSafeInteger(value)&&value>=0;const chip=el('span','viewer-count');chip.dataset.viewerPlatform=platform;chip.append(platformIcon(platform),el('strong','viewer-value',known?new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:1}).format(value):'—'));chip.title=`${platform==='twitch'?'Twitch':'YouTube'} viewers: ${known?value.toLocaleString('en'):'waiting for Streamer.bot'}`;chip.setAttribute('aria-label',chip.title);return chip;}));}
  const headings={grid:['RACE CONTROL','GRID / COMMS'],endurance:['PIT WALL','ENDURANCE / RADIO'],vice:['VICE FEED','AFTER HOURS'],minimal:['LIVE CHAT','SIDECAST / LIVE']};const heading=headings[p.theme]||headings.grid;
  if(head.dataset.theme!==p.theme){head.dataset.theme=p.theme;head.firstElementChild.replaceChildren(el('i'),document.createTextNode(heading[0]));mark.textContent=heading[1];}
  const styleKey=JSON.stringify([p.badges,p.timestamps,p.platformIcons,p.highlights]);
  const messageKey=JSON.stringify([messages.map(m=>[m.id,m.emoteRevision||0]),styleKey]);
  if(messageKey!==lastMessages){
   lastMessages=messageKey;
   if(styleKey!==lastStyle){lastStyle=styleKey;nodes.clear();stack.replaceChildren();}
   const ids=new Set(messages.map(m=>m.id));for(const [id,node] of nodes)if(!ids.has(id)){node.remove();nodes.delete(id);}
   messages.forEach((m,index)=>{let node=nodes.get(m.id);if(!node||node.dataset.emoteRevision!==String(m.emoteRevision||0)){const next=messageNode(m,p);node?.replaceWith(next);node=next;nodes.set(m.id,node);}if(stack.children[index]!==node)stack.insertBefore(node,stack.children[index]||null);});
   stack.scrollTop=stack.scrollHeight;
  }
  const a=latest.alert,visible=!!placement&&a&&a.endsAt>now;
  alertSlot.hidden=!visible||placement!=='inline';centerSlot.hidden=!visible||placement!=='center';
  const alertKey=visible?JSON.stringify([a.id,placement]):'';
  if(visible&&alertKey!==lastAlert){
   lastAlert=alertKey;const def=ALERTS[a.alertType]||ALERTS.follow;const card=el('article','alert-card');card.dataset.alert=a.alertType;
   const stamp=el('div','alert-stamp');stamp.innerHTML=svg(def.icon);
   const info=el('div','alert-info');const tag=el('div','alert-label',def.title);if(a.test)tag.append(el('span','test-badge','TEST'));
   info.append(tag,appendEmojiText(el('strong','alert-name'),a.name),appendEmojiText(el('p','alert-detail'),a.detail));
   let message;if(a.message){card.classList.add('has-message');message=el('p','alert-message');appendEmotes(message,a.messageFragments?.length?a.messageFragments:[{text:a.message}]);}
   const meter=el('div','alert-meter');meter.style.animationDuration=(a.endsAt-a.startedAt)+'ms';meter.style.animationDelay=(-(now-a.startedAt))+'ms';
   card.append(stamp,info,...(message?[message]:[]),platformIcon(a.platform),meter);
   alertSlot.replaceChildren(...(alertSlot.hidden?[]:[card]));
   centerSlot.replaceChildren(...(centerSlot.hidden?[]:[card]));
  }
  if(!visible&&lastAlert){lastAlert='';alertSlot.replaceChildren();centerSlot.replaceChildren();}
  // Wake only for the next visible expiry; CSS owns the alert animation.
  const deadlines=[];
  if(currentMode!=='alerts'&&p.fadeSeconds)for(const m of messages)deadlines.push(m.time+p.fadeSeconds*1000);
  if(visible)deadlines.push(a.endsAt);
  if(deadlines.length)timer=setTimeout(paint,Math.max(1,Math.min(...deadlines)-now));
 }
 const followBottom=()=>{stack.scrollTop=stack.scrollHeight;};
 const observer=new ResizeObserver(followBottom);observer.observe(stack);
 return {update(snapshot){latest=snapshot;clockOffset=(snapshot.serverTime||Date.now())-Date.now();paint();},setMode(value){currentMode=value;paint();},setTarget(value){const next=value==='browser'?'browser':'desktop';if(next!==target){target=next;paint();}},destroy(){clearTimeout(timer);observer.disconnect();}};
}
