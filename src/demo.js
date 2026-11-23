import { normalizeEvent } from './core/events.js';
import { randomUUID } from 'node:crypto';
const demoName='balkn';
const names=[demoName,'nightshift','MaxOnTrack','violet.exe','ThePitCrew','Benji'];
const messages=['That last lap was incredible 🔥','Clean racing. Keep it respectful 🫶🏽','Hello from Hamburg 👋','One more lap? Count me in.','This overlay looks clean','🏁 🔥 🇩🇪'];
let index=0;
export function testEvents(type) {
  if(type==='chat')return Array.from({length:3},()=>{
    const n=index++%names.length; const source=['Twitch','YouTube','Kick'][n%3];
    return normalizeEvent({event:{source,type:source==='YouTube'?'Message':'ChatMessage'},data:{messageId:randomUUID(),eventId:randomUUID(),text:messages[n],message:messages[n],user:{name:names[n],id:`demo-${n}`,isModerator:n===1,color:['#bd98ff','#f3b879','#80d8bd'][n%3]},isTest:true}});
  });
  const eventType={follow:'Follow',sub:'Sub',resub:'ReSub',gift:'GiftBomb',raid:'Raid',cheer:'Cheer'}[type];
  if(!eventType)return [];
  const text=['sub','resub','cheer'].includes(type)?'Thanks for the great streams! So many good moments together. Here is to many more — see you on the next lap! 🏁':'';
  return [normalizeEvent({event:{source:'Twitch',type:eventType},data:{messageId:randomUUID(),user:{name:demoName},viewers:128,bits:500,gifts:5,cumulativeMonths:12,text,isTest:true}})];
}
