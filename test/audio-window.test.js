import test from 'node:test';
import assert from 'node:assert/strict';
import {AudioPlayerWindow} from '../src/audio-window.js';
function fixture(failures){const windows=[],errors=[];const player=new AudioPlayerWindow({onError:e=>errors.push(e),createWindow:()=>{const w={destroyed:false,isDestroyed(){return this.destroyed;},destroy(){this.destroyed=true;},async loadURL(){if(failures-->0)throw Object.assign(Error('private URL'),{code:'ERR_FAILED'});}};windows.push(w);return w;}});return {player,windows,errors};}
test('failed audio startup retries in a fresh window and retains one healthy player',async()=>{
 const {player,windows,errors}=fixture(1);assert.equal(await player.ensure('http://local/audio'),true);assert.equal(windows.length,2);assert.equal(windows[0].destroyed,true);assert.equal(errors.at(-1),'');
 await player.ensure('http://local/audio');assert.equal(windows.length,2);player.close();assert.equal(windows[1].destroyed,true);
});
test('persistent audio failure is bounded, sanitized and retryable',async()=>{
 const {player,windows,errors}=fixture(2);assert.equal(await player.ensure('http://local/audio'),false);assert.ok(windows.every(w=>w.destroyed));assert.match(errors.at(-1),/ERR_FAILED/);assert.doesNotMatch(errors.at(-1),/private URL/);
 assert.equal(await player.ensure('http://local/audio'),true);assert.equal(errors.at(-1),'');player.close();
});
test('closing during an audio load cancels recovery and overlapping ensures share a load',async()=>{
 let reject,created=0;const errors=[];const player=new AudioPlayerWindow({onError:e=>errors.push(e),createWindow:()=>{created++;return {isDestroyed:()=>false,destroy(){reject(Error('closed'));},loadURL:()=>new Promise((_r,j)=>reject=j)};}});
 const a=player.ensure('http://local/audio'),b=player.ensure('http://local/audio');assert.equal(a,b);player.close();assert.equal(await a,false);assert.equal(created,1);assert.equal(errors.at(-1),'');
});
