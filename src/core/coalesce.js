// Bound rendering/serialization work during bursts; ingestion stays synchronous.
export function coalesce(callback, delay=50) {
  let timer=null;
  const schedule=()=>{if(timer===null)timer=setTimeout(()=>{timer=null;callback();},delay);};
  schedule.cancel=()=>{clearTimeout(timer);timer=null;};
  return schedule;
}
