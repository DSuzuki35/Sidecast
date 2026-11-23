export const APPEARANCE_KEYS=['theme','accent','fontSize','opacity','spacing','radius','topAligned','timestamps','badges','platformIcons','highlights','viewerCounts','alertPlacement'];
export function alertPresentation(placement,target,mode){
 if(target==='desktop')return 'inline';
 const route=['inline','center','both'].includes(placement)?placement:'inline';
 if(mode==='alerts')return route==='inline'?null:'center';
 return route==='center'?null:'inline';
}
export function appearanceFor(profile,target='desktop'){
 const {appearance,...base}=profile;
 if(appearance?.linked!==false)return base;
 const selected=appearance[target==='browser'?'browser':'desktop']||{};
 return {...base,...Object.fromEntries(APPEARANCE_KEYS.filter(k=>Object.hasOwn(selected,k)).map(k=>[k,selected[k]]))};
}
