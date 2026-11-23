import {normalizeAudio} from './audio-settings.js';
export const THEMES = { grid: '#ff6548', endurance: '#e2ed64', vice: '#d48bff', minimal: '#e2e5e9' };
export const ALERT_TYPES = ['follow', 'sub', 'resub', 'gift', 'raid', 'cheer'];
const bool = (v, fallback) => typeof v === 'boolean' ? v : fallback;
const number = (v, fallback, min, max) => Number.isFinite(Number(v)) && v !== null && v !== '' ? Math.min(max, Math.max(min, Number(v))) : fallback;
const port = (v, fallback) => Number.isInteger(Number(v)) && Number(v) > 0 && Number(v) <= 65535 ? Number(v) : fallback;
const names = value => [...new Set((Array.isArray(value)?value:[]).filter(v=>typeof v==='string').map(v=>v.trim().replace(/^@/,'').slice(0,64)).filter(Boolean))].slice(0,20);
function normalizeAppearance(p={}) {
  const theme=Object.hasOwn(THEMES,p.theme)?p.theme:'grid';
  return {theme,accent:/^#[0-9a-f]{6}$/i.test(p.accent)?p.accent:THEMES[theme],
    fontSize:number(p.fontSize,16,11,32),opacity:number(p.opacity,85,0,100),spacing:number(p.spacing,10,0,28),radius:number(p.radius,14,0,28),
    topAligned:bool(p.topAligned,false),timestamps:bool(p.timestamps,false),badges:bool(p.badges,true),platformIcons:bool(p.platformIcons,true),
    highlights:{enabled:bool(p.highlights?.enabled,true),moderators:bool(p.highlights?.moderators,true),mentions:names(p.highlights?.mentions),users:names(p.highlights?.users)},
    viewerCounts:{enabled:bool(p.viewerCounts?.enabled,false),platforms:Object.fromEntries(['twitch','youtube'].map(k=>[k,bool(p.viewerCounts?.platforms?.[k],true)]))},
    alertPlacement:['center','both'].includes(p.alertPlacement)?p.alertPlacement:'inline'};
}
export function normalizeProfile(p={},index=0) {
  const legacyDuration=number(p.alertSeconds,7,3,30),look=normalizeAppearance(p);
  return {
    id:typeof p.id==='string'&&/^[a-zA-Z0-9_-]{1,60}$/.test(p.id)?p.id:`profile-${index}`,
    name:typeof p.name==='string'&&p.name.trim()?p.name.trim().slice(0,40):'My setup',
    ...look,
    appearance:{linked:bool(p.appearance?.linked,true),desktop:normalizeAppearance({...look,...p.appearance?.desktop}),browser:normalizeAppearance({...look,...p.appearance?.browser})},
    maxMessages:Math.round(number(p.maxMessages,30,1,100)),fadeSeconds:number(p.fadeSeconds,0,0,300),
    audio:normalizeAudio(p.audio),
    platforms:Object.fromEntries(['twitch','youtube','kick'].map(k=>[k,bool(p.platforms?.[k],true)])),
    alertDurations:Object.fromEntries(ALERT_TYPES.map(k=>[k,number(p.alertDurations?.[k],legacyDuration,3,30)])),
    alerts:Object.fromEntries(ALERT_TYPES.map(k=>[k,bool(p.alerts?.[k],true)]))
  };
}
export function normalizeSettings(input = {}) {
  const s = input && typeof input === 'object' ? input : {};
  const profiles = (Array.isArray(s.profiles) && s.profiles.length ? s.profiles : [{}]).slice(0,20).map((p,i)=>normalizeProfile(p && typeof p === 'object' ? p : {}, i));
  const used = new Set(); profiles.forEach((p,i)=>{ if(used.has(p.id)) p.id=`profile-${i}-${p.id}`; used.add(p.id); });
  return {
    version: 1, profiles, activeProfile: profiles.some(p=>p.id===s.activeProfile) ? s.activeProfile : profiles[0].id,
    connection: {
      host: typeof s.connection?.host === 'string' && /^[a-zA-Z0-9.-]{1,253}$/.test(s.connection.host) ? s.connection.host : '127.0.0.1',
      port: port(s.connection?.port,8080), autoConnect: bool(s.connection?.autoConnect,false)
    },
    sourcePort: port(s.sourcePort,3131), hotkey: typeof s.hotkey === 'string' && s.hotkey.length < 100 && s.hotkey.trim() ? s.hotkey.trim() : 'Control+Shift+Space',
    overlay: { visible: bool(s.overlay?.visible,false), locked: bool(s.overlay?.locked,false), alwaysOnTop: bool(s.overlay?.alwaysOnTop,true),
      x: Number.isFinite(s.overlay?.x) ? s.overlay.x : null, y: Number.isFinite(s.overlay?.y) ? s.overlay.y : null,
      width: Math.round(number(s.overlay?.width,400,280,1600)), height: Math.round(number(s.overlay?.height,650,240,1800)) }
  };
}
export const DEFAULT_SETTINGS = normalizeSettings();
export const activeProfile = settings => settings.profiles.find(p=>p.id===settings.activeProfile) || settings.profiles[0];
