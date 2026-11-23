import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSettings} from '../src/core/settings.js';
import {appearanceFor} from '../public/appearance.js';

test('both alert placement survives normalization independently for each output',()=>{
 const p=normalizeSettings({profiles:[{alertPlacement:'both',appearance:{linked:false,desktop:{alertPlacement:'both'},browser:{alertPlacement:'center'}}}]}).profiles[0];
 assert.equal(p.alertPlacement,'both');assert.equal(appearanceFor(p,'desktop').alertPlacement,'both');assert.equal(appearanceFor(p,'browser').alertPlacement,'center');
 assert.equal(normalizeSettings({profiles:[{alertPlacement:'invalid'}]}).profiles[0].alertPlacement,'inline');
});
test('old profiles retain linked output appearance',()=>{
 const p=normalizeSettings({profiles:[{theme:'vice',fontSize:24,topAligned:true}]}).profiles[0];
 assert.equal(p.appearance.linked,true);assert.deepEqual(appearanceFor(p,'desktop'),appearanceFor(p,'browser'));assert.equal(appearanceFor(p).topAligned,true);
});
test('output styles stay separate while content and audio settings remain shared',()=>{
 const p=normalizeSettings({profiles:[{audio:{enabled:true},platforms:{kick:false},maxMessages:15,appearance:{linked:false,desktop:{theme:'vice',fontSize:22,topAligned:true},browser:{theme:'minimal',fontSize:14,topAligned:false,audio:{enabled:false},platforms:{kick:true}}}}]}).profiles[0];
 const desktop=appearanceFor(p,'desktop'),browser=appearanceFor(p,'browser');assert.equal(desktop.theme,'vice');assert.equal(browser.theme,'minimal');assert.equal(desktop.topAligned,true);assert.equal(browser.topAligned,false);assert.equal(browser.audio.enabled,true);assert.equal(browser.platforms.kick,false);assert.equal(browser.maxMessages,15);assert.equal('appearance' in browser,false);
});
