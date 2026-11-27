import {nearestObserverCity} from '../3d/observers.js?v=0.03-0035';
// Labels never change the weather request point. Local city references are not geocodes.
const valid=(lat,lon)=>Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function coordinatesLabel(lat,lon){return valid(lat,lon)?`${lat.toFixed(4)}°, ${lon.toFixed(4)}°`:'坐标待核实';}
export function fallbackPlace(latitude,longitude){
 const coordinates=coordinatesLabel(latitude,longitude);
 if(!valid(latitude,longitude))return {label:'坐标待核实',kind:'invalid',coordinates,note:'无有效采样坐标，未查询地名。'};
 const city=nearestObserverCity({latitude,longitude},300);
 if(!city)return {label:`${coordinates}（地名待核实）`,kind:'coordinates',coordinates,note:'本地较大城市资料覆盖不足，保留原采样坐标；不据此判断陆地或海域。'};
 const rad=Math.PI/180,a=city.latitude*rad,b=latitude*rad,d=(longitude-city.longitude)*rad;
 const bearing=(Math.atan2(Math.sin(d)*Math.cos(b),Math.cos(a)*Math.sin(b)-Math.sin(a)*Math.cos(b)*Math.cos(d))/rad+360)%360;
 const direction=['北','东北','东','东南','南','西南','西','西北'][Math.round(bearing/45)%8];
 const km=Math.max(1,Math.round(city.distanceKm/(city.distanceKm<20?1:10))*(city.distanceKm<20?1:10));
 const label=city.distanceKm<1?`${city.name}周边（位置参考）`:`${city.name}${direction}方约${km}公里`;
 return {label,kind:'city_reference',coordinates,note:'按已收录城市中心估算方位和距离，仅供定位，不代表该城市行政辖区或陆地。'};
}
export function placeLabel(data){
 if(String(data?.status)!=='0')return null;
 const a=data.result?.addressComponent;if(!a)return null;
 const clean=x=>typeof x==='string'&&!['市辖区','县','市','省直辖县级行政区划'].includes(x.trim())?x.trim():'';
 const city=clean(a.city),province=clean(a.province),nation=clean(a.nation);
 const region=city||province;
 return region?[nation&&nation!=='中国'&&nation!==region?nation:'',region].filter(Boolean).join(' · '):nation?`${nation}（地区参考）`:null;
}
export function weatherLocationHTML(point){
 const {latitude,longitude}=point,r=fallbackPlace(latitude,longitude);
 return `<span data-weather-place data-lat="${esc(latitude)}" data-lon="${esc(longitude)}" data-coordinates="${esc(r.coordinates)}" title="${esc(r.coordinates+' · '+r.note)}" tabindex="0">${esc(r.label)}</span>`;
}
export function createPlaceLookup({fetcher=fetch,storage,now=Date.now,paceMs=1200,sleep=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 if(storage===undefined)try{storage=globalThis.sessionStorage;}catch{storage=null;}
 const pending=new Map(),cache=new Map();let config,configUntil=0,tail=Promise.resolve(),lastStart=-Infinity;
 return function lookup(latitude,longitude,{isCurrent=()=>true}={}){
  const fallback=fallbackPlace(latitude,longitude);if(fallback.kind==='invalid')return Promise.resolve(fallback);
  const key=`weather-place-v2:${latitude},${longitude}`;
  let cached=cache.get(key);try{cached??=JSON.parse(storage?.getItem(key)||'null');}catch{}
  if(cached?.expires>now()&&typeof cached.value?.label==='string')return Promise.resolve(cached.value);
  if(pending.has(key))return pending.get(key).then(value=>value.cancelled&&isCurrent()?lookup(latitude,longitude,{isCurrent}):value);
  const work=tail.then(async()=>{
   if(!isCurrent())return {...fallback,cancelled:true};
   await sleep(Math.max(0,lastStart+paceMs-now()));
   if(!isCurrent())return {...fallback,cancelled:true};lastStart=now();
   let value=fallback;
   try{
    if(!config||now()>configUntil){configUntil=now()+60000;config=fetcher('./api/map-config',{signal:AbortSignal.timeout(4000)}).then(r=>r.ok?r.json():{}).catch(()=>({}));}
    const {token}=await config;
    if(token&&isCurrent()){
     const url=new URL('https://api.tianditu.gov.cn/geocoder');
     url.search=new URLSearchParams({postStr:JSON.stringify({lon:longitude,lat:latitude,ver:1}),type:'geocode',tk:token});
     const response=await fetcher(url,{signal:AbortSignal.timeout(5000)});
     if(response.ok){const label=placeLabel(await response.json());if(label)value={label,kind:'geocoded',coordinates:fallback.coordinates,note:'天地图行政区域名称；天气仍使用原采样坐标。'};}
    }
   }catch{} // A failed reverse lookup leaves the immediate local reference intact.
   const entry={value,expires:now()+(value.kind==='geocoded'?86400000:300000)};
   cache.set(key,entry);if(cache.size>256)cache.delete(cache.keys().next().value);
   try{storage?.setItem(key,JSON.stringify(entry));}catch{}
   return value;
  }).finally(()=>pending.delete(key));
  tail=work.catch(()=>{});pending.set(key,work);return work;
 };
}
let lookup;
export function installWeatherPlaces(details,{lookup:providedLookup}={}){
 if(!details)return;
 const resolve=providedLookup||(lookup??=createPlaceLookup());let loading=false,done=false;
 async function update(){
  if(!details.open||loading||done||!details.isConnected)return;loading=true;
  try{
   for(const el of details.querySelectorAll('[data-weather-place]')){
    if(!details.open||!details.isConnected)return;
    const lat=el.dataset.lat,lon=el.dataset.lon;
    const current=()=>details.isConnected&&details.open&&el.isConnected&&el.dataset.lat===lat&&el.dataset.lon===lon;
    const r=await resolve(Number(lat),Number(lon),{isCurrent:current});
    if(current()&&r){el.textContent=r.label;el.title=r.coordinates+' · '+r.note;}
   }
   done=true;
  }finally{loading=false;}
 }
 details.addEventListener('toggle',update);if(details.open)update();
}
