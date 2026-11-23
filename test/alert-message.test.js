import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeEvent} from '../src/core/events.js';
import {normalizeAudio,speechText} from '../src/core/audio-settings.js';
import {Hub} from '../src/core/hub.js';

const message='Thanks for all the streams! '.repeat(17)+'See you on the next lap 🏁';
const event=(source,type,extra)=>normalizeEvent({event:{source,type},data:{messageId:'test',user:{id:'42',name:'balkn'},cumulativeMonths:12,...extra}});
test('attached alert text survives current and legacy Streamer.bot event shapes',()=>{
 for(const [source,type,extra] of [
  ['Twitch','ReSub',{text:message,systemMessage:'Do not read this summary'}],
  ['Twitch','Sub',{message}],['Twitch','Cheer',{message:{message},bits:500}],
  ['YouTube','SuperChat',{message,amount:'EUR 5'}],['YouTube','MemberMileStone',{message,months:12}],
  ['Kick','Resubscription',{message:{text:message}}]
 ])assert.equal(event(source,type,extra).message,message);
 assert.equal(event('Twitch','ReSub',{systemMessage:'Subscription summary'}).message,'');
 assert.equal(event('Twitch','Sub',{message:{unexpected:'object'}}).message,'');
});
test('alert message emotes retain text, including all text when parts are inconsistent',()=>{
 const text='Hi Kappa 🏁';const a=event('Twitch','ReSub',{text,parts:[{type:'text',text:'Hi '},{type:'emote',text:'Kappa',imageUrl:'https://example.com/kappa.png'},{type:'text',text:' 🏁'}]});
 assert.equal(a.messageFragments.map(f=>f.text).join(''),text);assert.equal(a.messageFragments[1].image,'https://example.com/kappa.png');
 const b=event('Twitch','ReSub',{text,parts:[{type:'text',text:'missing words'}]});assert.equal(b.messageFragments.map(f=>f.text).join(''),text);
 assert.equal(event('Twitch','ReSub',{parts:[{type:'text',text:'All the words 🏁'}]}).message,'All the words 🏁');
});
test('deleted or banned attached messages disappear from history and stop active/queued speech',()=>{
 const h=new Hub();try{
  h.ingest(event('Twitch','ReSub',{text:message}));h.ingest({...event('Twitch','ReSub',{text:message}),id:'twitch:queued'});
  h.ingest({kind:'delete',platform:'twitch',messageId:'twitch:test'});assert.equal(h.messages.some(m=>m.sourceMessageId==='twitch:test'),false);
  assert.notEqual(h.alert?.id,'twitch:test');h.ingest({kind:'purge',platform:'twitch',userId:'42'});
  assert.equal(h.messages.length,0);assert.equal(h.alert,null);assert.equal(h.queue.length,0);
 }finally{h.close();}
});
test('speech appends the entire attached message to existing templates, once, as literal text',()=>{
 const a={name:'balkn',alertType:'resub',detail:'12 months',message};
 const template=normalizeAudio().types.resub.template;
 assert.equal(speechText(a,template),`Welcome back balkn. 12 months. ${message}`);
 assert.equal(speechText(a,'{name} says: {message}'),`balkn says: ${message}`);
 assert.equal(speechText({...a,message:'{name} <speak>hello</speak>'},'{message}'),'{name} <speak>hello</speak>');
 assert.equal(speechText({...a,message:''},'{detail}'),'12 months');
});
test('queued alert chat history retains full message and emotes separately from the event summary',()=>{
 const h=new Hub();try{
  const a=event('Twitch','ReSub',{text:message});h.ingest(a);
  const row=h.messages[0];assert.equal(row.detail,'12 months');assert.equal(row.text,`12 months\n${message}`);assert.equal(row.message,message);
  assert.equal(row.fragments.map(f=>f.text).join(''),row.text);assert.equal(h.alert.message,message);
 }finally{h.close();}
});
