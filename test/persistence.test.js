import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,readFile,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadSettings, saveSettings } from '../src/persistence.js';
import { normalizeSettings } from '../src/core/settings.js';
test('persistence roundtrip preserves settings/token without plaintext password',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'sidecast-'));const file=join(dir,'settings.json');
 const crypto={isEncryptionAvailable:()=>true,encryptString:s=>Buffer.from(s.split('').reverse().join('')),decryptString:b=>b.toString().split('').reverse().join('')};
 try{await saveSettings(file,{settings:normalizeSettings(),password:'super-secret',token:'keep-me'},crypto);assert.ok(!(await readFile(file,'utf8')).includes('super-secret'));const loaded=await loadSettings(file,crypto);assert.equal(loaded.password,'super-secret');assert.equal(loaded.token,'keep-me');
 await writeFile(file,'broken');const recovered=await loadSettings(file,crypto);assert.ok(recovered.warning);assert.equal(recovered.settings.sourcePort,3131);
 for(const invalid of ['null','[]','42']){await writeFile(file,invalid);const recovered=await loadSettings(file,crypto);assert.ok(recovered.warning);assert.equal(recovered.settings.sourcePort,3131);}
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('I/O read failures protect the existing settings path from later writes',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'sidecast-io-'));const crypto={isEncryptionAvailable:()=>false};
 try{const loaded=await loadSettings(dir,crypto);assert.equal(loaded.persistenceBlocked,true);assert.match(loaded.warning,/left untouched/);await assert.rejects(saveSettings(dir,loaded,crypto),/protected after a read failure/);}
 finally{await rm(dir,{recursive:true,force:true});}
});
