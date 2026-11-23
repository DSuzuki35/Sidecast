import test from 'node:test';
import assert from 'node:assert/strict';
import { emojiParts,messageHighlight } from '../public/text.js';

test('emoji parsing preserves joined families, skin tones, flags, keycaps and literal HTML',()=>{
 const value='<b>Hi</b> 👨‍👩‍👧‍👦 🫶🏽 🇩🇪 1️⃣ 🏁';const parts=emojiParts(value);
 assert.equal(parts.map(p=>p.text).join(''),value);
 assert.deepEqual(parts.filter(p=>p.emoji).map(p=>p.text),['👨‍👩‍👧‍👦','🫶🏽','🇩🇪','1️⃣','🏁']);
 assert.deepEqual(emojiParts('plain 123'),[{text:'plain 123',emoji:false}]);
});

test('highlights match whole mentions and people, with explicit priority and opt-out',()=>{
 const options={enabled:true,mentions:['balkn'],users:['PitCrew'],moderators:true};
 assert.equal(messageHighlight({text:'Hi @Balkn!',name:'PitCrew',role:'MOD'},options),'mention');
 assert.equal(messageHighlight({text:'Hi @balkn.'},options),'mention');assert.equal(messageHighlight({text:'Hi @balkn.other'},options),'');
 assert.equal(messageHighlight({text:'Hi @balkn_extra and mail@balkn',name:'Other'},options),'');
 assert.equal(messageHighlight({text:'hello',name:'pitcrew',role:'MOD'},options),'person');
 assert.equal(messageHighlight({text:'hello',role:'MOD'},options),'moderator');
 assert.equal(messageHighlight({text:'@balkn',role:'MOD'},{...options,enabled:false}),'');
 assert.equal(messageHighlight({text:'hello',role:'MOD'},{...options,moderators:false}),'');
});
