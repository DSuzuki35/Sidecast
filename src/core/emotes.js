const PROVIDERS=['bttv','ffz','seventv'];
const channelId=value=>typeof value==='string'&&/^\d{1,25}$/.test(value)?value:'';
const code=value=>typeof value==='string'&&value.length<=100&&!/\s/.test(value)&&value?value:null;
const list=value=>Array.isArray(value)?value.slice(0,3000):[];
function cdn(value,hosts){
 try{const u=new URL(value?.startsWith('//')?'https:'+value:value);return u.protocol==='https:'&&!u.username&&!u.password&&hosts.includes(u.hostname)&&!u.port&&u.href.length<2048?u.href:null;}catch{return null;}
}
export function catalogUrl(provider,channel=''){
 if(channel&&!channelId(channel))throw Error('Invalid Twitch channel');
 if(provider==='bttv')return 'https://api.betterttv.net/3/cached/'+(channel?'users/twitch/'+channel:'emotes/global');
 if(provider==='ffz')return 'https://api.frankerfacez.com/v1/'+(channel?'room/id/'+channel:'set/global');
 if(provider==='seventv')return 'https://7tv.io/v3/'+(channel?'users/twitch/'+channel:'emote-sets/global');
 throw Error('Unknown emote provider');
}
export function parseCatalog(provider,data,channel=false){
 const result=new Map();
 const add=(name,image,zeroWidth=false)=>{name=code(name);if(name&&image)result.set(name,{text:name,image,provider,zeroWidth:!!zeroWidth});};
 if(provider==='bttv')for(const e of channel?[...list(data?.sharedEmotes),...list(data?.channelEmotes)]:list(data)){
  if(e&&/^[a-zA-Z0-9_-]{1,100}$/.test(e.id))add(e.code,`https://cdn.betterttv.net/emote/${e.id}/2x`,e.modifier);
 }
 if(provider==='ffz'){
  const ids=channel?[data?.room?.set]:list(data?.default_sets);
  for(const id of ids)for(const e of list(data?.sets?.[id]?.emoticons))if(e){
   const urls=e.animated||e.urls;add(e.name,cdn(urls?.['2']||urls?.['1']||urls?.['4'],['cdn.frankerfacez.com']),e.modifier);
  }
 }
 if(provider==='seventv')for(const e of list((channel?data?.emote_set:data)?.emotes))if(e?.data){
  const host=e.data.host,files=list(host?.files),file=files.find(f=>f?.name==='2x.webp')||files.find(f=>f?.name==='1x.webp')||files.find(f=>f?.name==='2x.gif');
  if(file)add(e.name||e.data.name,cdn(`${host.url}/${file.name}`,['cdn.7tv.app','cdn.7tv.io']),((e.flags||0)&1)!==0);
 }
 return result;
}
export function emoteFragments(fragments,catalog){
 const result=[];let images=0;
 for(const fragment of fragments){
  if(fragment.image){const known=catalog.get(fragment.text);result.push(fragment.provider&&known?.provider===fragment.provider&&known.zeroWidth?{...fragment,zeroWidth:true}:fragment);images++;continue;}
  for(const token of fragment.text.split(/(\s+)/u)){
   if(!token)continue;const emote=images<100?catalog.get(token):null;
   if(emote){result.push({...emote,text:token});images++;}
   else if(result.length&&!result.at(-1).image)result.at(-1).text+=token;
   else result.push({text:token});
  }
 }
 return result;
}
export async function fetchCatalogJson(url,signal){
 const response=await fetch(url,{signal:AbortSignal.any([signal,AbortSignal.timeout(10000)]),redirect:'error',headers:{Accept:'application/json'}});
 if(!response.ok){await response.body?.cancel();if(response.status===404)return null;throw Error('Emote provider unavailable');}
 const max=8*1024*1024;if(Number(response.headers.get('content-length'))>max){await response.body.cancel();throw Error('Emote catalog too large');}
 let bytes=0;const chunks=[];
 for await(const chunk of response.body){bytes+=chunk.length;if(bytes>max)throw Error('Emote catalog too large');chunks.push(chunk);}
 return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export class EmoteService {
 constructor({fetchJson=fetchCatalogJson,now=Date.now,onUpdate=()=>{}}={}){
  this.fetchJson=fetchJson;this.now=now;this.onUpdate=onUpdate;this.entries=new Map();this.channels=new Map();this.raw=new WeakMap();this.pending=new Set();this.jobs=[];this.running=0;this.closed=false;this.controller=new AbortController();this.merged=new Map();
 }
 ensure(channel=''){
  if(this.closed)return;channel=channelId(channel);
  if(channel){
   if(!this.channels.has(channel)&&this.channels.size>=8){const oldest=[...this.channels.keys()].find(id=>PROVIDERS.every(p=>!this.entries.get(`${p}:${id}`)?.pending));if(oldest){this.channels.delete(oldest);for(const p of PROVIDERS)this.entries.delete(`${p}:${oldest}`);this.merged.delete(oldest);}else channel='';}
   if(channel){this.channels.delete(channel);this.channels.set(channel,true);}
  }
  for(const scope of channel?['',channel]:[''])for(const provider of PROVIDERS){
   const key=`${provider}:${scope}`;let entry=this.entries.get(key);
   if(entry&&(entry.pending||entry.expires>this.now()))continue;
   if(!entry){entry={map:new Map(),expires:0,pending:false};this.entries.set(key,entry);}
   entry.pending=true;
   let resolve;const done=new Promise(r=>resolve=r);this.pending.add(done);
   this.jobs.push(async()=>{
    try{if(this.closed)return;const data=await this.fetchJson(catalogUrl(provider,scope),this.controller.signal);if(this.closed||this.entries.get(key)!==entry)return;entry.map=parseCatalog(provider,data,!!scope);entry.expires=this.now()+15*60_000;this.merged.clear();try{this.onUpdate();}catch{/* UI refresh failure must not invalidate a successful catalog. */}}
    catch{entry.expires=this.now()+5*60_000;}
    finally{entry.pending=false;this.pending.delete(done);resolve();}
   });this.pump();
  }
 }
 pump(){while(!this.closed&&this.running<3&&this.jobs.length){const job=this.jobs.shift();this.running++;job().finally(()=>{this.running--;this.pump();});}}
 catalog(channel=''){
  channel=channelId(channel);if(this.merged.has(channel))return this.merged.get(channel);
  const result=new Map();
  // Channel aliases override global codes. For ties: 7TV > BTTV > FFZ. Native fragments always win.
  for(const scope of channel?['',channel]:[''])for(const provider of ['ffz','bttv','seventv'])for(const [name,e] of this.entries.get(`${provider}:${scope}`)?.map||[])result.set(name,e);
  if(this.merged.size>8)this.merged.delete(this.merged.keys().next().value);this.merged.set(channel,result);return result;
 }
 decorate(message){
  if(message.kind!=='message'||message.platform!=='twitch')return message;
  if(message.channelId&&!this.channels.has(message.channelId)&&this.raw.has(message))return message;
  const raw=this.raw.get(message)||message,fragments=emoteFragments(raw.fragments?.length?raw.fragments:[{text:raw.text}],this.catalog(raw.channelId));
  if(JSON.stringify(fragments)===JSON.stringify(message.fragments))return message;
  const decorated={...raw,fragments,emoteRevision:(message.emoteRevision||0)+1};this.raw.set(decorated,raw);return decorated;
 }
 process(event){if(event?.kind==='message'&&event.platform==='twitch')this.ensure(event.channelId);return event?this.decorate(event):event;}
 async idle(){while(this.pending.size)await Promise.all([...this.pending]);}
 close(){this.closed=true;this.controller.abort();for(const job of this.jobs.splice(0))void job();this.entries.clear();this.channels.clear();this.merged.clear();}
}
