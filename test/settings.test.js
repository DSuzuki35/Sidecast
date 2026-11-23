import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSettings } from '../src/core/settings.js';
test('settings clamp hostile numeric input and retain zero fade',()=>{
  const s=normalizeSettings({profiles:[{id:'one',name:'One',fontSize:999,opacity:-2,fadeSeconds:0,theme:'oops',accent:'url(x)'}],activeProfile:'gone',connection:{port:0,host:'ws://bad/path'}});
  assert.equal(s.profiles[0].fontSize,32); assert.equal(s.profiles[0].opacity,0); assert.equal(s.profiles[0].fadeSeconds,0); assert.equal(s.profiles[0].theme,'grid'); assert.equal(s.activeProfile,'one'); assert.equal(s.connection.port,8080); assert.equal(s.connection.host,'127.0.0.1');
});

test('per-alert durations migrate the old value and clamp each type independently',()=>{
 const legacy=normalizeSettings({profiles:[{alertSeconds:12}]}).profiles[0];
 assert.deepEqual(legacy.alertDurations,{follow:12,sub:12,resub:12,gift:12,raid:12,cheer:12});
 const p=normalizeSettings({profiles:[{alertSeconds:9,alertDurations:{follow:3,sub:99,raid:15,gift:-4,cheer:'bad',unknown:8}}]}).profiles[0];
 assert.deepEqual(p.alertDurations,{follow:3,sub:30,resub:9,gift:3,raid:15,cheer:9});
 assert.deepEqual(normalizeSettings({profiles:[p]}).profiles[0].alertDurations,p.alertDurations);
});
test('normalization does not preserve secrets or arbitrary keys in public settings',()=>{
  const s=normalizeSettings({password:'secret',connection:{password:'secret'},profiles:[]});
  assert.ok(s.profiles.length); assert.ok(!JSON.stringify(s).includes('secret')); assert.equal(s.sourcePort,3131);
});
