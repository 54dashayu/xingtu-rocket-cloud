// Abort alone is not a deadline: a stalled fetch/body implementation may never settle.
// Race the entire operation and consume late completions without allowing a cache write.
export async function withDeadline(operation,{timeoutMs=20000,signal}={}) {
 const controller=new AbortController();let timer,onAbort;
 const stopped=new Promise((_,reject)=>{
  onAbort=()=>{const error=signal?.reason||new Error('Upstream request aborted');controller.abort(error);reject(error);};
  if(signal?.aborted){onAbort();return;}
  signal?.addEventListener('abort',onAbort,{once:true});
  timer=setTimeout(()=>{const error=Object.assign(new Error('Upstream request deadline exceeded'),{code:'UPSTREAM_TIMEOUT'});controller.abort(error);reject(error);},timeoutMs);
 });
 try {return await Promise.race([stopped,Promise.resolve().then(()=>{controller.signal.throwIfAborted();return operation(controller.signal);})]);}
 finally {clearTimeout(timer);signal?.removeEventListener('abort',onAbort);}
}

