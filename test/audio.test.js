import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,readdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {AudioService,wavDuration} from '../src/audio-service.js';
import {normalizeAudio,speechText} from '../src/core/audio-settings.js';
import {normalizeSettings} from '../src/core/settings.js';
import {Hub} from '../src/core/hub.js';
import {createSourceServer} from '../src/server.js';

test('audio templates treat event text literally and settings reject unsafe paths',()=>{
 const settings=normalizeAudio({volume:900,types:{follow:{soundId:'../../voice.wav',volume:-1,speak:true}}});assert.equal(settings.volume,150);assert.equal(settings.types.follow.volume,0);assert.equal(settings.types.follow.soundId,'');
 assert.equal(speechText({name:'{detail} <speak>',detail:'great'},'Thanks {name}. {detail}'),'Thanks {detail} <speak>. great');
});

test('WAV durations use byte rate correctly for stereo PCM',()=>{
 const rate=24000,seconds=4,b=Buffer.alloc(44+rate*4*seconds);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(2,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*4,28);b.writeUInt16LE(4,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(b.length-44,40);assert.equal(wavDuration(b),seconds);
});

test('audio preparation preserves FIFO and clear prevents a late alert replay',async()=>{
 let resolveAudio;const settings=normalizeSettings({profiles:[{audio:{enabled:true,types:{follow:{speak:true}}},alertDurations:{follow:3,raid:4}}]});const h=new Hub({settings,prepareAlert:()=>new Promise(r=>resolveAudio=r)});
 try{h.ingest({kind:'alert',id:'a',platform:'twitch',alertType:'follow'});h.ingest({kind:'alert',id:'b',platform:'twitch',alertType:'raid'});await Promise.resolve();assert.equal(h.alert,null);assert.equal(h.queue.length,2);assert.equal(h.snapshot().preparing,true);
 resolveAudio({clips:[],duration:8,output:'desktop'});await new Promise(r=>setImmediate(r));assert.equal(h.alert.id,'a');assert.equal(h.alert.endsAt-h.alert.startedAt,8000);assert.equal(h.queue.length,1);
 h.clear();h.ingest({kind:'alert',id:'c',platform:'twitch',alertType:'follow'});await Promise.resolve();h.clear();resolveAudio(null);await new Promise(r=>setImmediate(r));assert.equal(h.alert,null);assert.equal(h.queue.length,0);
 }finally{h.close();}
});

test('Windows TTS generates playable audio and media routes never expose voice recordings',{skip:process.platform!=='win32'},async()=>{
 const directory=await mkdtemp(join(tmpdir(),'sidecast-audio-'));const service=await new AudioService({directory,root:resolve('.')}).init();const hub=new Hub();const server=await createSourceServer({hub,publicDir:resolve('public'),port:0,token:'audio-test',audio:service});
 await service.voiceLoad;
 try{assert.ok(service.voices.length,'At least one Windows voice must be installed for this integration test');const p=normalizeSettings({profiles:[{audio:{enabled:true,voice:service.voices[0].name,types:{follow:{speak:true,template:'Hello balkn.'}}}}]}).profiles[0];const clip=await service.prepare({id:'a',name:'balkn',alertType:'follow'},p);assert.equal(clip.clips.length,2);assert.ok(clip.duration>1);assert.equal(service.error,'');
 const privateResult=await service.prepare({id:'private',name:'private words',alertType:'follow'},p,undefined,{privatePreview:true});assert.ok(wavDuration(privateResult.previewData)>0);assert.equal(await service.asset(privateResult.clips.at(-1).id),null);assert.equal((await readdir(join(directory,'media'))).some(n=>n.startsWith('preview-')),false);
 const speech=await service.asset(clip.clips[1].id);assert.ok(wavDuration(speech.data)>0);assert.equal(await service.asset('../voice/reference.wav'),null);
 await writeFile(join(directory,'media',clip.clips[1].id),'interrupted generation');
 const duplicates=await Promise.all([service.prepare({name:'balkn',alertType:'follow'},p),service.prepare({name:'balkn',alertType:'follow'},p)]);assert.equal(duplicates[0].clips[1].id,duplicates[1].clips[1].id);assert.ok(wavDuration((await service.asset(duplicates[0].clips[1].id)).data)>0);assert.equal(service.status().busy,false);
 assert.equal((await fetch(server.origin+'/media/'+clip.clips[1].id)).status,403);assert.equal((await fetch(server.origin+'/media/'+clip.clips[1].id+'?token=audio-test')).status,200);
 await writeFile(join(directory,'voice','reference.wav'),'private');assert.equal((await fetch(server.origin+'/media/reference.wav?token=audio-test')).status,404);
 assert.equal((await fetch(server.origin+'/audio')).status,403);assert.equal((await fetch(server.origin+'/audio?token=audio-test')).status,200);
 }finally{service.close();await server.close();hub.close();await rm(directory,{recursive:true,force:true});}
});

test('volume edits preserve synthesis and refresh playback settings before display',async()=>{
 const settings=normalizeSettings({profiles:[{audio:{enabled:true,types:{follow:{speak:true}}}}]});
 const calls=[];const h=new Hub({settings,prepareAlert:(_event,profile,signal)=>new Promise(resolve=>calls.push({profile,signal,resolve}))});
 try{
  h.ingest({kind:'alert',id:'volume',platform:'twitch',alertType:'follow'});await new Promise(r=>setImmediate(r));
  const edited=structuredClone(h.settings);edited.profiles[0].audio.volume=23;edited.profiles[0].alertDurations.follow=11;h.updateSettings(edited);
  assert.equal(calls[0].signal.aborted,false);calls[0].resolve({clips:[],duration:1});await new Promise(r=>setImmediate(r));
  assert.equal(h.alert,null);assert.equal(calls.length,2);assert.equal(calls[1].profile.audio.volume,23);
  calls[1].resolve({clips:[],duration:1});await new Promise(r=>setImmediate(r));assert.equal(h.alert.endsAt-h.alert.startedAt,11000);
 }finally{h.close();}
});

test('empty speech skips synthesis and cache maintenance cannot report a false TTS failure',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'sidecast-audio-cache-'));const service=await new AudioService({directory,root:resolve('.')}).init();
 try{
  const p=normalizeSettings({profiles:[{audio:{enabled:true,types:{follow:{sound:'none',speak:true,template:'{detail}'}}}}]}).profiles[0];
  assert.equal(await service.prepare({alertType:'follow',detail:''},p),null);assert.equal(service.error,'');
  if(process.platform==='win32'){
   service.prune=async()=>{throw Object.assign(Error('racing cleanup'),{code:'ENOENT'});};p.audio.types.follow.template='Hello.';
   const result=await service.prepare({alertType:'follow'},p);assert.equal(result.clips.length,1);assert.equal(service.error,'');
  }
 }finally{await service.voiceLoad;service.close();await rm(directory,{recursive:true,force:true});}
});


test('stopping a queued preview cannot stop a live Qwen alert already generating',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'sidecast-serial-preview-'));const service=await new AudioService({directory,root:resolve('.')}).init();await service.voiceLoad;
 try{
  const wav=(await service.asset('builtin-chime.wav')).data;await writeFile(join(directory,'voice','reference.wav'),wav);
  let finish,started,stops=0;const ready=new Promise(r=>started=r);service.stopWorker=()=>{stops++;};
  service.requestQwen=request=>new Promise(resolve=>{finish=async()=>{await writeFile(request.output,wav);resolve({ok:true});};started();});
  const p=normalizeSettings({profiles:[{audio:{enabled:true,engine:'qwen',types:{follow:{sound:'none',speak:true,template:'Hello {name}'}}}}]}).profiles[0];
  const live=service.prepare({name:'live',alertType:'follow'},p);await ready;
  const controller=new AbortController();const preview=service.prepare({name:'preview',alertType:'follow'},p,controller.signal,{privatePreview:true});controller.abort();await finish();
  assert.ok(await live);assert.equal(await preview,null);assert.equal(stops,0);
 }finally{service.close();await rm(directory,{recursive:true,force:true});}
});
