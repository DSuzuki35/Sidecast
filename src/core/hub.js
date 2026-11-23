import { EventEmitter } from 'node:events';
import { normalizeSettings, activeProfile } from './settings.js';
const synthesisKey=a=>JSON.stringify([a.enabled,a.engine,a.voice,a.language,a.device,a.engine==='chatterbox'?a.expressiveness:null,Object.entries(a.types).map(([type,t])=>[type,t.speak,t.template])]);
export class Hub extends EventEmitter {
  constructor({settings=normalizeSettings(),now=Date.now,prepareAlert=null}={}) {
    super(); this.settings=settings; this.now=now; this.messages=[]; this.activity=[]; this.seen=new Set(); this.queue=[]; this.alert=null;
    this.status={state:'offline',label:'Disconnected'}; this.received=0;
    this.timer=null;
    this.prepareAlert=prepareAlert;this.preparing=null;this.closed=false;
    this.viewers={twitch:null,youtube:null};this.youtubeViewers=new Map();
  }
  snapshot() {
    return {type:'snapshot',profile:activeProfile(this.settings),messages:this.messages,alert:this.alert,queued:this.queue.length,preparing:!!this.preparing,viewers:{...this.viewers},status:this.status,activity:this.activity,received:this.received,overlay:this.settings.overlay,serverTime:this.now()};
  }
  publish() { this.emit('change',this.snapshot()); }
  refreshMessages(transform) {
    let changed=false;this.messages=this.messages.map(message=>{const updated=transform(message);changed ||= updated!==message;return updated;});
    if(changed)this.publish();
  }
  updateSettings(settings) {
    const previous=activeProfile(this.settings),previousAudio=JSON.stringify([previous.audio,previous.alertDurations]);
    this.settings=normalizeSettings(settings);
    const current=activeProfile(this.settings);
    if(previousAudio!==JSON.stringify([current.audio,current.alertDurations])){
      if(synthesisKey(previous.audio)!==synthesisKey(current.audio)){if(this.preparing)this.pauseQueueExpiry(this.now());this.preparing?.controller.abort();this.preparing=null;}
      else if(this.preparing)this.preparing.refresh=true;
      for(const item of this.queue){delete item._audioReady;delete item.audio;}
    }
    const p=activeProfile(this.settings); this.queue=this.queue.filter(a=>p.alerts[a.alertType] && p.platforms[a.platform]);
    if(this.alert && (!p.alerts[this.alert.alertType] || !p.platforms[this.alert.platform])) this.alert=null;
    this.tick(false); this.publish();
  }
  setStatus(status) { this.status=status;if(status.state!=='connected'){this.viewers={twitch:null,youtube:null};this.youtubeViewers.clear();}this.publish(); }
  ingest(event) {
    if(!event) return;
    if(event.kind==='viewers'){
      if(event.platform==='twitch')this.viewers.twitch=event.count;
      else if(event.platform==='youtube'){
        if(event.count===null){
          if(!event.broadcastId)this.youtubeViewers.clear();
          else {this.youtubeViewers.delete(event.broadcastId);this.youtubeViewers.delete('current');}
        }else if(event.broadcastId){
          this.youtubeViewers.delete('current');this.youtubeViewers.set(event.broadcastId,event.count);
        }else if(this.youtubeViewers.size<=1){
          this.youtubeViewers.set(this.youtubeViewers.keys().next().value||'current',event.count);
        }
        if(this.youtubeViewers.size>20)this.youtubeViewers.delete(this.youtubeViewers.keys().next().value);
        this.viewers.youtube=this.youtubeViewers.size?[...this.youtubeViewers.values()].reduce((a,b)=>a+b,0):null;
      }
      this.publish();return;
    }
    if(['delete','purge','clear'].includes(event.kind)) {
      const matches=m=>m?.platform===event.platform&&(event.kind==='delete'?(m.id===event.messageId||m.sourceMessageId===event.messageId):event.kind==='purge'?m.userId===event.userId:true);
      this.messages=this.messages.filter(m=>!matches(m));
      // Attached viewer text follows chat moderation, including speech that has not started yet.
      this.queue=this.queue.filter(a=>!a.message||!matches(a));
      if(this.alert?.message&&matches(this.alert))this.alert=null;
      this.tick(false);
      this.publish(); return;
    }
    const dedupeKey=`${event.kind}:${event.alertType||''}:${event.id}`;
    if(!event.id || this.seen.has(dedupeKey)) return;
    this.seen.add(dedupeKey); if(this.seen.size>2000) this.seen.delete(this.seen.values().next().value);
    this.received++;
    if(event.kind==='message') this.messages=[...this.messages,event].slice(-200);
    if(event.kind==='alert') {
      this.activity=[event,...this.activity].slice(0,20);
      const p=activeProfile(this.settings);
      if(p.alerts[event.alertType] && p.platforms[event.platform]) this.queue.push({...event,queuedAt:Math.max(this.now(),this.alert?.audio?this.alert.endsAt:0)});
      this.queue=this.queue.slice(-50); this.tick(false);
    }
    this.publish();
  }
  pauseQueueExpiry(until) { for(const item of this.queue)item.queuedAt=Math.max(item.queuedAt,until); }
  tick(notify=true) {
    let changed=false; const now=this.now();
    if(this.alert && now>=this.alert.endsAt) { this.alert=null; changed=true; }
    // Speech work is progress, not stale queue time. Its own worker timeout remains bounded.
    const previousCount=this.queue.length;if(!this.preparing)this.queue=this.queue.filter(a=>now-a.queuedAt<120000);changed ||= previousCount!==this.queue.length;
    if(this.preparing&&!this.queue.includes(this.preparing.event)){this.preparing.controller.abort();this.preparing=null;}
    const next=this.queue[0],profile=activeProfile(this.settings);
    const needsAudio=next&&this.prepareAlert&&profile.audio.enabled&&((next.test&&next.testSpeech)||profile.audio.types[next.alertType]?.speak||profile.audio.types[next.alertType]?.sound!=='none');
    if(next&&needsAudio&&!next._audioReady&&!this.preparing){
      const pending={event:next,controller:new AbortController()};this.preparing=pending;changed=true;
      const audioProfile=structuredClone(profile);if(next.test&&next.testSpeech)audioProfile.audio.types[next.alertType].speak=true;
      Promise.resolve().then(()=>this.prepareAlert(next,audioProfile,pending.controller.signal)).catch(()=>null).then(audio=>{
        if(this.closed||this.preparing!==pending)return;this.pauseQueueExpiry(this.now());this.preparing=null;
        if(this.queue.includes(next)&&!pending.refresh){next.audio=audio;next._audioReady=true;}this.tick(false);this.publish();
      });
    }
    if(!this.alert&&next&&(!needsAudio||next._audioReady)) {
      this.queue.shift();const {_audioReady,...event}=next;const duration=Math.max(profile.alertDurations[next.alertType],needsAudio?next.audio?.duration||0:0)*1000;
      if(!needsAudio)delete event.audio;this.alert={...event,startedAt:now,endsAt:now+duration};changed=true;
      if(needsAudio)this.pauseQueueExpiry(this.alert.endsAt);
      // Add once when the queued alert actually starts; its chat lifetime is independent of the animation.
      const detail=event.detail||'',message=event.message||'',text=detail+(message?'\n'+message:'');
      const fragments=[{text:detail},...(message?[{text:'\n'},...(event.messageFragments||[{text:message}])]:[])];
      this.messages=[...this.messages,{kind:'alert-message',id:`alert:${event.alertType}:${event.id}`,sourceMessageId:event.id,alertType:event.alertType,platform:event.platform,userId:event.userId||'',name:event.name||'Anonymous',detail,message,text,fragments,time:now,test:!!event.test,badges:[]}].slice(-200);
      if(needsAudio&&this.queue.length)queueMicrotask(()=>{if(!this.closed)this.tick();});
    }
    clearTimeout(this.timer);this.timer=null;
    const deadline=Math.min(this.alert?.endsAt??Infinity,...(this.preparing?[]:this.queue.map(a=>a.queuedAt+120000)));
    if(Number.isFinite(deadline)){this.timer=setTimeout(()=>this.tick(),Math.max(1,deadline-now));this.timer.unref();}
    if(changed&&notify) this.publish();
  }
  clear() { this.messages=[]; this.queue=[]; this.alert=null; this.activity=[];this.preparing?.controller.abort();this.preparing=null;this.tick(false);this.publish(); }
  clearTests() { this.messages=this.messages.filter(m=>!m.test); this.queue=this.queue.filter(a=>!a.test); this.activity=this.activity.filter(a=>!a.test); if(this.alert?.test)this.alert=null; this.tick(false); this.publish(); }
  close() { this.closed=true;this.preparing?.controller.abort();this.preparing=null;clearTimeout(this.timer);this.timer=null; }
}
