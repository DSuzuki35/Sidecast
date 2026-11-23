import { readFile,writeFile,mkdir,rename,copyFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomBytes } from 'node:crypto';
import { normalizeSettings } from './core/settings.js';
export async function loadSettings(file,crypto) {
  let raw={},warning='',contents,persistenceBlocked=false;
  try { contents=await readFile(file,'utf8'); }
  catch(error){if(error.code!=='ENOENT'){warning='Could not read settings. Existing file left untouched. Restart Sidecast to retry.';persistenceBlocked=true;}}
  if(contents!==undefined)try { const parsed=JSON.parse(contents);if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error('invalid');raw=parsed; }
  catch{warning='Could not read settings. Defaults restored.';try{await copyFile(file,file+'.corrupt-'+Date.now());warning+=' A backup has been created.';}catch{persistenceBlocked=true;warning='Invalid settings could not be backed up. Existing file left untouched. Restart Sidecast to retry.';}}
  let password='';
  if(typeof raw.encryptedPassword==='string')try{password=crypto.decryptString(Buffer.from(raw.encryptedPassword,'base64'));}catch{warning='Please enter your saved password again.';}
  return {settings:normalizeSettings(raw.settings),password,token:typeof raw.token==='string'&&raw.token ? raw.token : randomBytes(24).toString('hex'),warning,persistenceBlocked};
}
export async function saveSettings(file,{settings,password,token,persistenceBlocked},crypto) {
  if(persistenceBlocked)throw Error('Settings are protected after a read failure. Restart Sidecast to retry.');
  const data={settings:normalizeSettings(settings),token};
  if(password&&crypto.isEncryptionAvailable())data.encryptedPassword=crypto.encryptString(password).toString('base64');
  await mkdir(dirname(file),{recursive:true});
  await writeFile(file+'.tmp',JSON.stringify(data,null,2),'utf8');await rename(file+'.tmp',file);
}
