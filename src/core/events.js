import { randomUUID, createHash } from 'node:crypto';
const str = (value, max = 4000) => typeof value === 'string' ? value.slice(0,max) : '';
const count = value => Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;
const identityName=u=>[u?.name,u?.displayName,u?.login,u?.username,u?.userName,u?.user_name,u?.display_name].map(v=>str(v,100).trim()).find(Boolean)||'';
const obj = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
export function safeImage(value) {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && value.length < 2048 ? u.href : null; } catch { return null; }
}
function fragments(text, emotes, platform) {
  const result = []; let offset = 0;
  const entries = (Array.isArray(emotes) ? emotes : []).slice(0,100).filter(e=>e&&typeof e==='object').map(e=>{
    const id=str(e.id??e.Id,100),type=str(e.type??e.Type).toLowerCase();
    const fallback=platform==='twitch'&&(!type||type==='twitch')&&/^[a-zA-Z0-9_-]{1,100}$/.test(id)?`https://static-cdn.jtvnw.net/emoticons/v2/${id}/default/dark/2.0`:null;
    let start=e.startIndex??e.StartIndex??e.start,end=e.endIndex??e.EndIndex??e.end;const name=str(e.name??e.Name,100);
    // Streamer.bot uses string indices; older upstream payloads can use Unicode code points.
    if(name&&Number.isInteger(start)&&Number.isInteger(end)&&text.slice(start,end+1)!==name){
      const points=Array.from(text);if(start>=0&&end>=start&&points.slice(start,end+1).join('')===name){start=points.slice(0,start).join('').length;end=start+name.length-1;}else return {start:-1};
    }
    const provider=['bttv','betterttv'].includes(type)?'bttv':['ffz','frankerfacez'].includes(type)?'ffz':['7tv','seventv'].includes(type)?'seventv':null;
    return {start,end,image:safeImage(e.imageUrl??e.ImageUrl??e.url)||fallback,provider,zeroWidth:e.zeroWidth===true||e.ZeroWidth===true};
  }).sort((a,b)=>a.start-b.start);
  for (const e of entries) {
    if (!e.image || !Number.isInteger(e.start) || !Number.isInteger(e.end) || e.start < offset || e.end < e.start || e.end >= text.length) continue;
    if(e.start>offset) result.push({text:text.slice(offset,e.start)});
    result.push({text:text.slice(e.start,e.end+1),image:e.image,...(e.provider?{provider:e.provider}:{}),...(e.zeroWidth?{zeroWidth:true}:{})}); offset=e.end+1;
  }
  if(offset<text.length) result.push({text:text.slice(offset)});
  return result.length ? result : [{text}];
}
function attachedMessage(d,legacy,platform) {
  // Do not substitute systemMessage: it is the subscription summary, not the viewer's words.
  const parts=Array.isArray(d.parts)?d.parts:[];
  const validParts=parts.length<=200&&parts.length&&parts.every(p=>p&&typeof p.text==='string');
  const text=str([d.text,d.message,legacy.text,legacy.message].find(v=>typeof v==='string'&&v.trim())||(validParts?parts.map(p=>p.text).join(''):''));
  if(validParts&&parts.map(p=>p.text).join('')===text){
    return {message:text,messageFragments:parts.map(p=>{
      const image=safeImage(p.imageUrl);return {text:p.text,...(image?{image,...(p.zeroWidth===true?{zeroWidth:true}:{})}:{})};
    })};
  }
  return {message:text,messageFragments:fragments(text,d.emotes??legacy.emotes,platform)};
}
export const EVENT_SUBSCRIPTIONS = {
  Twitch: ['ChatMessage','ChatMessageDeleted','ChatCleared','UserBanned','UserTimedOut','Follow','Sub','ReSub','GiftSub','GiftBomb','Raid','Cheer','ViewerCountUpdate','StreamOnline','StreamOffline'],
  YouTube: ['Message','MessageDeleted','UserBanned','UserTimedout','NewSubscriber','NewSponsor','MemberMileStone','MembershipGift','SuperChat','SuperSticker','StatisticsUpdated','BroadcastEnded','BroadcastMonitoringEnded'],
  Kick: ['ChatMessage','UserBanned','UserTimedOut','Follow','Subscription','Resubscription','GiftSubscription','MassGiftSubscription','KicksGifted']
};
const alertMap = {Follow:'follow',NewSubscriber:'follow',Sub:'sub',Subscription:'sub',NewSponsor:'sub',ReSub:'resub',Resubscription:'resub',MemberMileStone:'resub',GiftSub:'gift',GiftBomb:'gift',GiftSubscription:'gift',MassGiftSubscription:'gift',MembershipGift:'gift',Raid:'raid',Cheer:'cheer',SuperChat:'cheer',SuperSticker:'cheer',KicksGifted:'cheer'};
export function normalizeEvent(envelope) {
  if(!envelope?.event || !envelope.data || !EVENT_SUBSCRIPTIONS[envelope.event.source]?.includes(envelope.event.type)) return null;
  const {source,type}=envelope.event; const platform=source.toLowerCase(); const d=obj(envelope.data); const legacy=obj(d.message);
  if(type==='ViewerCountUpdate'||type==='StatisticsUpdated'){
    const value=type==='ViewerCountUpdate'?d.viewerCount:d.concurrentViewers;
    if(d.isTest||!Number.isSafeInteger(value)||value<0)return null;
    return {kind:'viewers',platform,count:value,broadcastId:str(d.broadcast?.id,200)};
  }
  if(['StreamOnline','StreamOffline','BroadcastEnded','BroadcastMonitoringEnded'].includes(type))return d.isTest?null:{kind:'viewers',platform,count:null,broadcastId:str(d.broadcast?.id,200)};
  const raidUser=type==='Raid'?[d.raider,d.user,legacy,d].find(u=>identityName(u)):null;
  const user=obj(raidUser ?? d.user ?? d.targetUser ?? d.raider ?? d.gifter ?? d.sender ?? (Object.keys(legacy).length ? legacy : d));
  if(type==='ChatCleared') return {kind:'clear',platform};
  if(type==='ChatMessageDeleted' || type==='MessageDeleted') {
    const id=str(d.messageId ?? d.id ?? d.targetMessageId);
    return id ? {kind:'delete',platform,messageId:`${platform}:${id}`} : null;
  }
  if(['UserBanned','UserTimedOut','UserTimedout'].includes(type)) {
    const userId=str(user.id ?? d.userId ?? d.target_user_id); return userId ? {kind:'purge',platform,userId} : null;
  }
  const now=Date.now();
  const originalId=str(d.messageId ?? d.eventId ?? legacy.msgId ?? d.id);
  const stableTime=str(d.createdAt ?? d.followedAt ?? envelope.timeStamp);
  const id=originalId || (stableTime ? createHash('sha256').update(JSON.stringify([type,stableTime,user.id,user.name])).digest('hex').slice(0,24) : randomUUID());
  const raidName=type==='Raid'?identityName(raidUser):'';
  const base={id:`${platform}:${id}`,platform,userId:str(user.id ?? user.userId,200),name:str(user.name ?? user.displayName ?? user.login ?? user.username ?? d.userName ?? d.user_name ?? d.display_name,100) || 'Anonymous',time:now,test:!!d.isTest};
  if(type==='Raid'){base.name=raidName||'Unknown raider';base.nameMissing=!raidName;}
  if(type==='ChatMessage' || type==='Message') {
    const text=str(d.text ?? (typeof d.message==='string' ? d.message : legacy.message));
    if(!text) return null;
    const badges=(Array.isArray(user.badges) ? user.badges : []).slice(0,8).filter(b=>b&&typeof b==='object').map(b=>({name:str(b.name ?? b.type,50),image:safeImage(b.imageUrl ?? b.image)})).filter(b=>b.image);
    const broadcaster=d.isFromSharedChatGuest?obj(d.sharedChatSource):obj(d.broadcaster);
    const channel=str(broadcaster.id??d.channelId??obj(d.channel).id??legacy.channelId??legacy.roomId,25);
    return {...base,kind:'message',text,...(platform==='twitch'?{channelId:/^\d{1,25}$/.test(channel)?channel:''}:{}),color:/^#[0-9a-f]{6}$/i.test(user.color) ? user.color : null,badges,fragments:fragments(text,d.emotes ?? legacy.emotes,platform),role:user.isModerator ? 'MOD' : user.isSponsor ? 'SUB' : ''};
  }
  const alertType=alertMap[type]; if(!alertType) return null;
  // Ignore individual gifts belonging to a bulk gift event to avoid double alerts.
  if(type==='GiftSub' && (d.fromCommunitySubGift || d.fromSubBomb || d.isFromGiftBomb)) return null;
  let detail='Glad you are here';
  if(alertType==='sub') detail=d.isPrime ? 'Prime is on the grid' : 'Welcome to the crew';
  if(alertType==='resub') {const months=count(d.cumulativeMonths ?? d.totalMonths ?? d.months ?? d.durationMonths ?? d.duration ?? user.monthsSubscribed)||1;detail=`${months} ${months===1?'month':'months'}`;}
  if(alertType==='gift') detail=`${count(d.gifts ?? d.giftCount ?? d.total ?? d.count ?? (Array.isArray(d.recipients) ? d.recipients.length : undefined) ?? d.amount) || 1} gifted subs`;
  if(alertType==='raid') detail=`${count(d.viewers)} viewers`;
  if(alertType==='cheer') detail=type==='Cheer' ? `${count(d.bits)} Bits` : str(d.amountDisplayString ?? d.amountFormatted ?? d.amount,80) || (count(d.amount ?? d.kicks)>0 ? `${count(d.amount ?? d.kicks)} ${type==='KicksGifted'?'Kicks':'Support'}` : 'Thanks for your support');
  return {...base,kind:'alert',alertType,detail,...attachedMessage(d,legacy,platform)};
}
