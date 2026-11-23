let context;const routes=new WeakMap();
export function setAudioGain(audio,volume){
 const value=Number.isFinite(volume)?Math.max(0,Math.min(2.25,volume)):0;
 let route=routes.get(audio);
 if(value>1&&!route){context??=new AudioContext();const source=context.createMediaElementSource(audio),gain=context.createGain();source.connect(gain);gain.connect(context.destination);route={source,gain};routes.set(audio,route);}
 if(route){audio.volume=1;route.gain.gain.value=value;}else audio.volume=value;
}
export async function resumeAudio(){if(context?.state==='suspended')await context.resume();}
export function releaseAudioGain(audio){const route=routes.get(audio);if(route){route.source.disconnect();route.gain.disconnect();routes.delete(audio);}}
