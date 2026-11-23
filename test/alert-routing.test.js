import test from 'node:test';
import assert from 'node:assert/strict';
import {alertPresentation} from '../public/appearance.js';

test('desktop always uses a compact card, never fullscreen',()=>{
 for(const placement of ['inline','center','both'])for(const mode of ['combined','chat','alerts'])assert.equal(alertPresentation(placement,'desktop',mode),'inline');
});
test('Both routes one compact card to chat and fullscreen only to the separate Alerts source',()=>{
 assert.equal(alertPresentation('both','browser','chat'),'inline');
 assert.equal(alertPresentation('both','browser','combined'),'inline');
 assert.equal(alertPresentation('both','browser','alerts'),'center');
});
test('single-destination modes enable only their corresponding browser source',()=>{
 assert.equal(alertPresentation('inline','browser','chat'),'inline');
 assert.equal(alertPresentation('inline','browser','alerts'),null);
 assert.equal(alertPresentation('center','browser','chat'),null);
 assert.equal(alertPresentation('center','browser','combined'),null);
 assert.equal(alertPresentation('center','browser','alerts'),'center');
});
