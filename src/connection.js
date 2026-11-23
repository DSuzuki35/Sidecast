import { StreamerbotClient } from '@streamerbot/client';
import { normalizeEvent, EVENT_SUBSCRIPTIONS } from './core/events.js';
export function connectStreamerbot(config,onEvent,onStatus) {
  let stopped=false,blocked=false,retry=null,attempt=0,client,retryStatus;
  const report=status=>{if(!stopped)onStatus(status);};
  const schedule=()=>{
    if(stopped||blocked||retry)return;
    report(retryStatus||{state:'connecting',label:'Reconnecting to Streamer.bot …'});
    retry=setTimeout(async()=>{retry=null;const previous=client;client=null;await previous?.disconnect().catch(()=>{});if(!stopped)start();},Math.min(15000,1000*2**Math.min(attempt++,4)));retry.unref?.();
  };
  function start() {
    if(stopped)return;
    retryStatus=null;
    report({state:'connecting',label:'Connecting to Streamer.bot …'});
    let authPending=false;
    const current=new StreamerbotClient({...config,immediate:false,autoReconnect:false,subscribe:{},logger:null,
      onData:payload=>{if(!stopped&&client===current) {if(payload.request==='Hello')authPending=!!payload.authentication;const event=normalizeEvent(payload);if(event)onEvent(event);}},
      onConnect:()=>{(async()=>{
        authPending=false;
        const available=await current.getEvents();const subscriptions={};
        for(const [platform,types] of Object.entries(EVENT_SUBSCRIPTIONS)) {
          const supported=types.filter(type=>available.events?.[platform]?.includes(type));if(supported.length)subscriptions[platform]=supported;
        }
        const result=await current.subscribe(subscriptions);
        if(result.status!=='ok')throw new Error('subscription');
        if(stopped||client!==current)return;
        clearTimeout(retry);retry=null;attempt=0;report({state:'connected',label:'Streamer.bot connected'});
      })().catch(()=>{if(stopped||client!==current)return;retryStatus={state:'error',label:'Could not subscribe to events — retrying …'};report(retryStatus);current.disconnect().catch(()=>{});schedule();});},
      onDisconnect:()=>{if(client===current)schedule();},
      onError:error=>{
        if(stopped||client!==current)return;
        if(/auth|password/i.test(error.message) || (authPending && error.message==='Request failed')) {blocked=true;clearTimeout(retry);retry=null;report({state:'auth-error',label:'Authentication failed — check your password'});}
        else schedule();
      }
    });
    client=current;
    current.connect().catch(()=>{if(client===current)schedule();});
  }
  start();
  return async()=>{stopped=true;clearTimeout(retry);await client?.disconnect().catch(()=>{});};
}
export function createConnectionManager(onEvent,onStatus) {
  let queue=Promise.resolve(),stop=null,generation=0;
  const enqueue=action=>{queue=queue.catch(()=>{}).then(action);return queue;};
  return {
    connect(config){const current=++generation;return enqueue(async()=>{if(stop)await stop();stop=null;if(current!==generation)return;stop=connectStreamerbot(config,event=>{if(current===generation)onEvent(event);},status=>{if(current===generation)onStatus(status);});});},
    disconnect(){++generation;return enqueue(async()=>{if(stop)await stop();stop=null;});}
  };
}
