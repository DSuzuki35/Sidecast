import test from 'node:test';
import assert from 'node:assert/strict';
import {previewProfile,previewText} from '../src/core/speech-preview.js';
import {normalizeSettings} from '../src/core/settings.js';
import {speechText} from '../src/core/audio-settings.js';
import {Hub} from '../src/core/hub.js';
test('voice preview validates text and uses a temporary speech-only profile without changing live settings',()=>{
 const p=normalizeSettings().profiles[0],copy=structuredClone(p);const preview=previewProfile(p,'Hello {name}');
 assert.deepEqual(p,copy);assert.equal(preview.audio.enabled,true);assert.equal(preview.audio.types.follow.speak,true);assert.equal(preview.audio.types.follow.sound,'none');assert.equal(preview.audio.types.follow.volume,100);
 assert.equal(previewText('  Hello  '),'Hello');for(const text of ['',null,{},'x'.repeat(301)])assert.throws(()=>previewText(text));
});
test('explicit alert speech tests prepare audio even when automatic speaking and sound are off',async()=>{
 const settings=normalizeSettings({profiles:[{audio:{enabled:true,types:{follow:{sound:'none',speak:false}}}}]});let calls=0;
 const h=new Hub({settings,prepareAlert:async(_e,p)=>{assert.equal(p.audio.types.follow.speak,true);calls++;return null;}});
 try{h.ingest({kind:'alert',id:'test-speech',test:true,testSpeech:true,platform:'twitch',alertType:'follow'});await new Promise(r=>setImmediate(r));assert.equal(calls,1);assert.equal(h.alert.id,'test-speech');assert.equal(h.settings.profiles[0].audio.types.follow.speak,false);}finally{h.close();}
});

test('unknown raid speakers are greeted naturally without inventing a channel name',()=>{
 assert.equal(speechText({alertType:'raid',name:'Unknown raider',nameMissing:true},'Thanks {name}!'),'Thanks our raiding community!');
});
