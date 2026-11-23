import {AudioService,wavDuration} from '../src/audio-service.js';
import {normalizeSettings} from '../src/core/settings.js';
import {resolve,join} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const directory=resolve('test-results/chatterbox-service');await mkdir(directory,{recursive:true});
const service=await new AudioService({directory,root:resolve('.')}).init();
try{
 await service.importReference(join(process.env.APPDATA,'Sidecast/audio/voice/reference.wav'));
 const p=normalizeSettings({profiles:[{audio:{enabled:true,engine:'chatterbox',expressiveness:75,language:'English',types:{raid:{speak:true,sound:'none',template:'Welcome {name}! Thank you for the raid!'}}}}]}).profiles[0];
 const reports=[];
 for(const level of [50,75]){
  p.audio.expressiveness=level;const start=Date.now();const result=await service.prepare({name:'balkn',alertType:'raid'},p);assert.equal(service.error,'');assert.ok(result?.clips.length);const speech=await service.asset(result.clips[0].id);const seconds=wavDuration(speech.data);assert.ok(seconds>1&&seconds<25);
  await writeFile(join(directory,`expression-${level}.wav`),speech.data);reports.push({expressiveness:level,elapsedMs:Date.now()-start,speechSeconds:seconds,id:result.clips[0].id});
 }
 assert.notEqual(reports[0].id,reports[1].id);
 p.audio.language='German';p.audio.types.raid.template='Willkommen {name}! Danke für den Raid!';const german=await service.prepare({name:'balkn',alertType:'raid',message:'Vielen Dank für die tollen Streams. Auf viele weitere Runden!'},p);assert.equal(service.error,'');assert.ok(german?.duration>2);
 if(process.env.SIDECAST_LONG_TTS){p.audio.language='English';p.audio.types.raid.template='Thank you {name}.';const message='Thanks for the great streams and all the racing tips. This community makes every race more enjoyable. I remember the first time I joined and everyone helped me learn the track. Now we have shared a whole year of good moments together. Looking forward to the next championship, late night practice sessions, and many more close finishes. Keep up the good work and a big hello to everyone watching tonight. This is the final sentence of my complete subscription message.';const start=Date.now();const full=await service.prepare({name:'balkn',alertType:'raid',message},p);assert.equal(service.error,'');assert.ok(full.duration>15);reports.push({longMessageCharacters:message.length,elapsedMs:Date.now()-start,speechSeconds:full.duration});}
 await writeFile(join(directory,'result.json'),JSON.stringify(reports,null,2));console.log('PASS: real local Chatterbox cloned-voice synthesis, 50/75 expression cache separation, English/German, valid audio',reports.map(({id,...r})=>r));
}finally{service.close();}
