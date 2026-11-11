// Resolve weather sample locations only when the user opens the weather details.
// Keep weather at its original coordinate; a place label must not move the sample.
export function placeLabel(data){
 if(String(data?.status)!=='0')return null;
 const a=data.result?.addressComponent;
 if(!a)return null;
 const parts=[a.nation==='中国'?'':a.nation,a.province,a.city,a.county,a.town].filter(Boolean);
 return [...new Set(parts)].join(' · ')||null;
}
export function createPlaceLookup({fetcher=fetch,storage=globalThis.sessionStorage}={}){
 const pending=new Map();let config;
 return function lookup(latitude,longitude){
  if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180)return Promise.resolve(null);
  const key=`weather-place-v1:${latitude.toFixed(4)},${longitude.toFixed(4)}`;
  try{const value=storage?.getItem(key);if(value)return Promise.resolve(value);}catch{}
  if(pending.has(key))return pending.get(key);
  const work=(async()=>{try{
   if(!config)config=fetcher('./api/map-config').then(r=>{if(!r.ok)throw Error();return r.json();}).catch(e=>{config=null;throw e;});
   const {token}=await config;if(!token)return null;
   const url=new URL('https://api.tianditu.gov.cn/geocoder');
   url.search=new URLSearchParams({postStr:JSON.stringify({lon:longitude,lat:latitude,ver:1}),type:'geocode',tk:token});
   let response=await fetcher(url,{signal:AbortSignal.timeout(8000)});
   if(response.status===429){await new Promise(resolve=>setTimeout(resolve,2200));response=await fetcher(url,{signal:AbortSignal.timeout(8000)});}
   if(!response.ok)return null;
   const label=placeLabel(await response.json());
   if(label)try{storage?.setItem(key,label);}catch{}
   return label;
  }catch{return null;}finally{pending.delete(key);}})();
  pending.set(key,work);return work;
 };
}
let lookup;
export function installWeatherPlaces(details){
 if(!details)return;
 lookup??=createPlaceLookup();let loading=false,done=false;
 details.addEventListener('toggle',async()=>{
  if(!details.open||loading||done)return;loading=true;
  const nodes=[...details.querySelectorAll('[data-weather-place]')];
  // Pace requests: this browser key has a low reverse-geocoding QPS allowance.
  let next=0;
  await Promise.all([0].map(async()=>{while(next<nodes.length){const el=nodes[next++];
   const label=await lookup(Number(el.dataset.lat),Number(el.dataset.lon));
   if(label&&el.isConnected){el.textContent=label;el.title=el.dataset.coordinates;}
   if(next<nodes.length)await new Promise(resolve=>setTimeout(resolve,1200));
  }}));
  loading=false;done=true;
 });
}
