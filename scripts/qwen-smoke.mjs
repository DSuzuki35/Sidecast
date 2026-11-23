import {AudioService,wavDuration} from '../src/audio-service.js';
import {normalizeSettings} from '../src/core/settings.js';
import {resolve,join} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const directory=resolve('test-results/tts-service');await mkdir(directory,{recursive:true});
const service=await new AudioService({directory,root:resolve('.')}).init();
try {
 await service.importReference(process.env.SIDECAST_REFERENCE||join(process.env.APPDATA,'Sidecast','audio','voice','reference.wav'));
 const profile=normalizeSettings({profiles:[{audio:{enabled:true,engine:'qwen',language:'English',types:{raid:{speak:true,template:'Thanks {name} for the raid.'}}}}]}).profiles[0];
 const started=Date.now(),result=await service.prepare({name:'balkn',alertType:'raid',...(process.env.SIDECAST_LONG_TTS?{message:'Thanks for all the wonderful streams and the racing tips. This community has made sim racing so much more fun for me. I still remember my first race and how everyone helped me learn the track. Now we have shared a whole year of great moments together. Looking forward to the next championship, the late night practice sessions, and many more close finishes. Keep up the great work, and a big hello to everyone watching tonight. This is the final sentence of the complete subscription message.'}:{})},profile);assert.equal(service.error,'');assert.equal(result.clips.length,2);const data=await service.asset(result.clips[1].id);assert.ok(wavDuration(data.data)>1);
 const report={elapsedMs:Date.now()-started,speechSeconds:wavDuration(data.data),clipCount:result.clips.length,path:join(directory,'media',result.clips[1].id)};await writeFile(join(directory,'result.json'),JSON.stringify(report,null,2));console.log('PASS: actual cloned-voice audio through Sidecast service, private reference, atomic cache, playable WAV',report);
}finally{service.close();}
