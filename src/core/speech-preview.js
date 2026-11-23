export function previewText(text){
  if(typeof text!=='string'||text.length>300)throw Error('Enter between 1 and 300 characters.');
  const value=text.replace(/[\u0000-\u001f]/g,' ').trim();
  if(!value)throw Error('Enter some text to test your voice.');return value;
}
export function previewProfile(profile){
  const p=structuredClone(profile);p.audio.enabled=true;
  Object.assign(p.audio.types.follow,{sound:'none',speak:true,volume:100,template:'{detail}'});
  return p;
}
