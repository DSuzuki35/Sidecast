import test from 'node:test';
import assert from 'node:assert/strict';
import {EmoteService,parseCatalog,emoteFragments,catalogUrl} from '../src/core/emotes.js';
import {normalizeEvent} from '../src/core/events.js';
import {Hub} from '../src/core/hub.js';
const seven=(name='Wave',flags=0)=>({name,flags,data:{host:{url:'//cdn.7tv.app/emote/abc',files:[{name:'2x.webp'}]}}});
const message=(id,text='Hey Wave',channelId='123')=>({kind:'message',platform:'twitch',id,userId:'viewer',channelId,text,fragments:[{text}],time:Date.now()});
test('native Twitch IDs and broadcaster/shared-chat scope survive normalization',()=>{
 const event=data=>normalizeEvent({event:{source:'Twitch',type:'ChatMessage'},data});
 const m=event({text:'Kappa',broadcaster:{id:'123'},user:{id:'99'},emotes:[{id:'25',startIndex:0,endIndex:4}]});
 assert.equal(m.channelId,'123');assert.match(m.fragments[0].image,/\/25\/default\/dark\/2\.0$/);
 assert.equal(event({text:'x',isFromSharedChatGuest:true,broadcaster:{id:'123'},sharedChatSource:{id:'456'}}).channelId,'456');
 assert.equal(event({text:'x',user:{id:'99'}}).channelId,'');
});
test('provider adapters use enabled sets, aliases, animated files and safe CDN URLs',()=>{
 assert.equal(parseCatalog('bttv',{sharedEmotes:[{id:'abc',code:'Wave'}],channelEmotes:[{id:'def',code:'Wave',modifier:true}]},true).get('Wave').zeroWidth,true);
 const ffz={default_sets:[1],sets:{1:{emoticons:[{name:'Dance',urls:{2:'//cdn.frankerfacez.com/emote/1/2'},animated:{2:'//cdn.frankerfacez.com/emote/1/animated/2'}}]},2:{emoticons:[{name:'NotGlobal',urls:{1:'//cdn.frankerfacez.com/emote/2/1'}}]}}};
 assert.match(parseCatalog('ffz',ffz).get('Dance').image,/animated/);assert.equal(parseCatalog('ffz',ffz).has('NotGlobal'),false);
 assert.equal(parseCatalog('seventv',{emotes:[seven('Alias',1)]}).get('Alias').zeroWidth,true);
 const bad=seven();bad.data.host.url='https://localhost/secret';assert.equal(parseCatalog('seventv',{emotes:[null,bad]}).size,0);
 assert.throws(()=>catalogUrl('bttv','../123'));assert.throws(()=>catalogUrl('unknown'));
});
test('whole-code matching preserves native emotes, text, whitespace and Unicode',()=>{
 const map=parseCatalog('seventv',{emotes:[seven()]});const native={text:'Wave',image:'https://static-cdn.jtvnw.net/native'};
 assert.deepEqual(emoteFragments([{text:'🙂 Wave\nWavey <Wave> '},native],map),[{text:'🙂 '},{...map.get('Wave')},{text:'\nWavey <Wave> '},native]);
});
test('lazy catalogs do not delay chat and cached channel emotes cannot leak across channels',async()=>{
 let calls=0,release;const gate=new Promise(r=>release=r);
 const service=new EmoteService({fetchJson:async url=>{calls++;await gate;return url.includes('/users/twitch/123')?{emote_set:{emotes:[seven('Wave')]}}:null;}});
 const first=message('1');assert.equal(service.process(first),first);for(let i=0;i<30;i++)service.process(first);release();await service.idle();
 assert.equal(calls,6);const decorated=service.decorate(first);assert.equal(decorated.fragments[1].provider,'seventv');assert.equal(service.decorate(decorated),decorated);
 assert.equal(service.decorate(message('other','Wave','456')).fragments[0].image,undefined);service.close();
});
test('failed refresh retains good cache and backs off; successful removal restores text',async()=>{
 let now=0,fail=false,removed=false,calls=0;
 const service=new EmoteService({now:()=>now,fetchJson:async url=>{calls++;if(fail)throw Error('offline');return url.endsWith('/emote-sets/global')?{emotes:removed?[]:[seven()]}:null;}});
 const m=message('1');service.process(m);await service.idle();const decorated=service.decorate(m);assert.ok(decorated.fragments[1].image);
 now=16*60_000;fail=true;service.process(m);await service.idle();assert.ok(service.decorate(m).fragments[1].image);const total=calls;service.process(m);await service.idle();assert.equal(calls,total);
 now+=6*60_000;fail=false;removed=true;service.process(m);await service.idle();assert.deepEqual(service.decorate(decorated).fragments,[{text:m.text}]);service.close();
});
test('catalog refresh changes only surviving messages and never resurrects moderated chat',async()=>{
 const hub=new Hub();let release;const gate=new Promise(r=>release=r);const service=new EmoteService({fetchJson:async url=>{await gate;return url.endsWith('/emote-sets/global')?{emotes:[seven()]}:null;},onUpdate:()=>hub.refreshMessages(m=>service.decorate(m))});
 hub.ingest(service.process(message('deleted')));hub.ingest(service.process(message('kept')));hub.ingest({kind:'delete',platform:'twitch',messageId:'deleted'});release();await service.idle();
 assert.equal(hub.messages.length,1);assert.equal(hub.messages[0].id,'kept');assert.ok(hub.messages[0].fragments[1].image);hub.clear();hub.refreshMessages(m=>service.decorate(m));assert.equal(hub.messages.length,0);service.close();hub.close();
});
test('channel churn and shutdown keep requests bounded and release queued work',async()=>{
 let calls=0,release;const gate=new Promise(r=>release=r);
 const service=new EmoteService({fetchJson:async()=>{calls++;await gate;return null;}});
 for(let i=1;i<=1000;i++)service.process(message(String(i),'hello',String(i)));
 assert.equal(calls,3);assert.ok(service.entries.size<=27);assert.ok(service.pending.size<=27);assert.equal(service.channels.size,8);
 service.close();release();await service.idle();assert.equal(service.pending.size,0);assert.equal(calls,3);
});
test('channel aliases override global catalogs but native fragments always win',async()=>{
 const service=new EmoteService({fetchJson:async url=>url.endsWith('/users/twitch/123')&&url.includes('betterttv')?{channelEmotes:[{id:'channel',code:'Wave'}]}:url.endsWith('emote-sets/global')?{emotes:[seven()]}:null});
 service.ensure('123');await service.idle();assert.equal(service.decorate(message('1','Wave')).fragments[0].provider,'bttv');
 const native={...message('2','Wave'),fragments:[{text:'Wave',image:'https://static-cdn.jtvnw.net/native'}]};assert.equal(service.decorate(native),native);service.close();
});
test('cached visible emotes survive channel eviction until that channel is loaded again',async()=>{
 const service=new EmoteService({fetchJson:async url=>url.includes('7tv.io/v3/users/')?{emote_set:{emotes:[seven()]}}:null});
 service.ensure('1');await service.idle();const old=service.decorate(message('old','Wave','1'));assert.ok(old.fragments[0].image);
 for(let i=2;i<=9;i++){service.ensure(String(i));await service.idle();}
 assert.equal(service.channels.has('1'),false);assert.equal(service.decorate(old),old);service.close();
});
test('named native emotes after astral Unicode support UTF-16 and legacy code-point indices',()=>{
 for(const [start,end] of [[3,7],[2,6]]){
  const m=normalizeEvent({event:{source:'Twitch',type:'ChatMessage'},data:{text:'🙂 Kappa',emotes:[{id:'25',Name:'Kappa',StartIndex:start,EndIndex:end}]}});
  assert.equal(m.fragments[0].text,'🙂 ');assert.equal(m.fragments[1].text,'Kappa');assert.ok(m.fragments[1].image);
 }
});
test('Streamer.bot third-party images keep their URL and receive catalog zero-width metadata',()=>{
 const m=normalizeEvent({event:{source:'Twitch',type:'ChatMessage'},data:{text:'Hat',emotes:[{Type:'SevenTV',Name:'Hat',StartIndex:0,EndIndex:2,ImageUrl:'https://cdn.7tv.app/emote/hat/1x.webp'}]}});
 const result=emoteFragments(m.fragments,parseCatalog('seventv',{emotes:[seven('Hat',1)]}));assert.equal(result[0].image,m.fragments[0].image);assert.equal(result[0].zeroWidth,true);
});
