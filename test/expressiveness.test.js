import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAudio} from '../src/core/audio-settings.js';
import {AudioService} from '../src/audio-service.js';
import {normalizeSettings} from '../src/core/settings.js';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
test('Chatterbox is optional and expressiveness is bounded and migrates without switching engine',()=>{
 assert.equal(normalizeAudio().engine,'windows');assert.equal(normalizeAudio({engine:'qwen'}).engine,'qwen');
 assert.equal(normalizeAudio({engine:'chatterbox'}).engine,'chatterbox');assert.equal(normalizeAudio().expressiveness,50);
 assert.equal(normalizeAudio({expressiveness:1000}).expressiveness,100);assert.equal(normalizeAudio({expressiveness:-2}).expressiveness,0);
 assert.equal(normalizeAudio({expressiveness:'oops'}).expressiveness,50);
});
test('Chatterbox speech uses full text and expression in the request and cache, with the shared private reference',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'sidecast-expression-'));const service=await new AudioService({directory,root:resolve('.')}).init();await service.voiceLoad;
 try{
  const wav=(await service.asset('builtin-chime.wav')).data;await writeFile(join(directory,'voice/reference.wav'),wav);
  const requests=[];service.requestChatterbox=async request=>{requests.push(request);await writeFile(request.output,wav);};
  const p=normalizeSettings({profiles:[{audio:{enabled:true,engine:'chatterbox',expressiveness:75,types:{resub:{speak:true,sound:'none'}}}}]}).profiles[0];
  const message='Full sub message. '.repeat(30),event={name:'balkn',alertType:'resub',detail:'12 months',message};
  const a=await service.prepare(event,p);assert.equal(service.error,'');assert.equal(requests.length,1);assert.ok(requests[0].text.endsWith(message));assert.equal(requests[0].expressiveness,75);
  const cached=await service.prepare(event,p);assert.equal(requests.length,1);assert.equal(a.clips[0].id,cached.clips[0].id);
  p.audio.expressiveness=20;const b=await service.prepare(event,p);assert.equal(requests.length,2);assert.notEqual(a.clips[0].id,b.clips[0].id);
 }finally{service.close();await rm(directory,{recursive:true,force:true});}
});
