const segmenter=new Intl.Segmenter(undefined,{granularity:'grapheme'});
const emoji=/\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20e3/u;

// Keep families, skin tones, flags and keycaps together, with no remote assets.
export function emojiParts(text='') {
 if(!emoji.test(text))return [{text,emoji:false}];
 const parts=[];let plain='';
 for(const {segment} of segmenter.segment(text)){
  if(emoji.test(segment)){if(plain){parts.push({text:plain,emoji:false});plain='';}parts.push({text:segment,emoji:true});}
  else plain+=segment;
 }
 if(plain)parts.push({text:plain,emoji:false});return parts;
}

export function messageHighlight(message,highlights) {
 if(!highlights?.enabled)return '';
 const mentions=new Set((highlights.mentions||[]).map(n=>n.toLowerCase()));
 for(const match of (message.text||'').matchAll(/(?:^|[^\p{L}\p{N}_@])@([\p{L}\p{N}_.-]+)/gu))if(mentions.has(match[1].replace(/[.-]+$/,'').toLowerCase()))return 'mention';
 if((highlights.users||[]).some(n=>n.toLowerCase()===(message.name||'').toLowerCase()))return 'person';
 if(highlights.moderators&&message.role==='MOD')return 'moderator';
 return '';
}
