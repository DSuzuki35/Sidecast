import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEvent } from '../src/core/events.js';
const event = (source, type, data) => normalizeEvent({ event: { source, type }, data });

test('current Twitch chat keeps identity, text and HTTPS emotes', () => {
  const m = event('Twitch', 'ChatMessage', { messageId: '42', text: 'Hey Kappa', user: { id: '7', name: 'Mira', color: '#aabbcc', badges: [{ name: 'subscriber', imageUrl: 'https://example.com/b.png' }] }, emotes: [{ StartIndex: 4, EndIndex: 8, Name: 'Kappa', ImageUrl: 'https://example.com/e.png' }] });
  assert.equal(m.id, 'twitch:42'); assert.equal(m.name, 'Mira'); assert.equal(m.text, 'Hey Kappa');
  assert.deepEqual(m.fragments, [{ text: 'Hey ' }, { text: 'Kappa', image: 'https://example.com/e.png' }]);
  assert.equal(m.badges[0].name, 'subscriber');
});
test('legacy Twitch and YouTube/Kick payloads normalize', () => {
  for (const [source, type, data, name, text] of [
    ['Twitch','ChatMessage',{message:{msgId:'a',message:'hello',displayName:'Old',userId:'3'}},'Old','hello'],
    ['YouTube','Message',{eventId:'b',message:'video',user:{name:'YT',id:'4'}},'YT','video'],
    ['Kick','ChatMessage',{messageId:'c',text:'kick!',user:{name:'K',id:'5'}},'K','kick!']
  ]) { const m = event(source,type,data); assert.equal(m.name,name); assert.equal(m.text,text); }
});
test('untrusted fields remain text and invalid images/colors are dropped', () => {
  const m = event('Twitch','ChatMessage',{text:'<img onerror=alert(1)>',user:{name:'<script>',color:'url(x)',badges:[{imageUrl:'javascript:bad'}]},emotes:[{StartIndex:0,EndIndex:2,ImageUrl:'http://localhost/private'}]});
  assert.equal(m.text,'<img onerror=alert(1)>'); assert.equal(m.color,null); assert.deepEqual(m.badges,[]); assert.deepEqual(m.fragments,[{text:m.text}]);
  assert.equal(normalizeEvent(null),null); assert.equal(event('Other','ChatMessage',{}),null);
});
test('follows, raids and subscriptions use current nested users', () => {
  assert.equal(event('Twitch','Follow',{targetUser:{name:'Follower'}}).name,'Follower');
  const raid = event('Twitch','Raid',{raider:{name:'Raider'},viewers:123});
  assert.equal(raid.alertType,'raid'); assert.equal(raid.name,'Raider'); assert.equal(raid.detail,'123 viewers');
  assert.equal(event('Twitch','ReSub',{user:{name:'Sub'},cumulativeMonths:12}).detail,'12 months');
  assert.equal(event('YouTube','NewSponsor',{user:{name:'Member'}}).alertType,'sub');
  assert.equal(event('Kick','Subscription',{user:{name:'Member'}}).alertType,'sub');
});
test('deletion and user moderation cannot accidentally clear whole chat', () => {
  assert.deepEqual(event('Twitch','ChatMessageDeleted',{messageId:'42'}),{kind:'delete',platform:'twitch',messageId:'twitch:42'});
  assert.equal(event('Twitch','ChatMessageDeleted',{}),null);
  assert.deepEqual(event('Twitch','UserBanned',{user:{id:'7'}}),{kind:'purge',platform:'twitch',userId:'7'});
});
test('bulk gifts suppress component events and preserve Kick recipient count',()=>{
 assert.equal(event('Twitch','GiftSub',{user:{name:'Gifter'},fromCommunitySubGift:true}),null);
 assert.equal(event('Twitch','GiftSub',{user:{name:'Gifter'},fromSubBomb:true}),null);
 assert.equal(event('Kick','MassGiftSubscription',{user:{name:'Gifter'},recipients:[{id:'1'},{id:'2'},{id:'3'},{id:'4'},{id:'5'}]}).detail,'5 gifted subs');
});
test('null metadata does not drop a readable message and legacy moderation purges correctly',()=>{
 assert.equal(event('Twitch','ChatMessage',{text:'hello',emotes:[null],user:{name:'N',badges:[null]}}).text,'hello');
 assert.deepEqual(event('Twitch','UserTimedOut',{target_user_id:'7'}),{kind:'purge',platform:'twitch',userId:'7'});
});
test('Kick renewal duration is retained and unknown support amounts are not fabricated',()=>{
 assert.equal(event('Kick','Resubscription',{user:{name:'K'},duration:6}).detail,'6 months');
 assert.equal(event('Kick','KicksGifted',{user:{name:'K'}}).detail,'Thanks for your support');
 assert.equal(event('YouTube','SuperChat',{user:{name:'YT'},amount:'€5.00'}).detail,'€5.00');
});


test('raid identity prefers the raider and skips empty name fields',()=>{
 assert.equal(event('Twitch','Raid',{user:{},raider:{name:'',login:'balkn'},viewers:12}).name,'balkn');
 assert.equal(event('Twitch','Raid',{user:{name:'receiver'},raider:{name:'balkn'},viewers:12}).name,'balkn');
 assert.equal(event('Twitch','Raid',{displayName:'balkn',viewers:12}).name,'balkn');
 assert.equal(event('Twitch','Raid',{raider:null,viewers:12}).nameMissing,true);
});
