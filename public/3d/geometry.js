import {mapLaunch} from '../map/model.js';
import {simulationProfile} from '../map/prediction.js';
import {visibilitySamples,visibilityFootprint,elevationAt} from '../map/visibility.js';
import {solarPosition,altitudeAt} from '../map/solar.js';
import {sunEvents} from '../map/sun-events.js';
export {solarPosition,altitudeAt,elevationAt};
export const R=6371;
export function xyz(p,scale=1){const a=p.latitude*Math.PI/180,b=p.longitude*Math.PI/180,r=1+(p.height||0)*scale/R;return [r*Math.cos(a)*Math.cos(b),r*Math.sin(a),-r*Math.cos(a)*Math.sin(b)];}
export function createScenario(site,net,azimuth=90){const launch=mapLaunch({id:'3d-reference',name:'参考上升段',pad:site,timing:{net,precision:'精确到秒'},scheduleStatus:{code:'tentative'}});const profile=simulationProfile(launch,{target:150,azimuth});return {launch,profile,end:profile.duration+300};}
export function frame(s,t){const time=Date.parse(s.launch.timing.net)+t*1000;const parcels=visibilitySamples(s.launch,{profile:s.profile,persistenceSeconds:300,atSeconds:t,untilSeconds:s.end}).flat();return {time,sun:solarPosition(time),parcels};}
export function footprint(s,t){return visibilityFootprint(s.launch,{profile:s.profile,persistenceSeconds:300,untilSeconds:s.end,minElevation:5,...(t===undefined?{}:{atSeconds:t})});}
export function pair(site,day,azimuth){const e=sunEvents(day+'T04:00:00Z',site,'Asia/Shanghai',-4);return ['sunrise','sunset'].map(kind=> e[kind]?{kind,...createScenario(site,e[kind],azimuth)}:null);}
// Independent Cartesian line-of-sight check: segment intersects the solid sphere.
export function earthBlocked(observer,point){const a=xyz(observer),b=xyz(point),d=b.map((v,i)=>v-a[i]);const dd=d.reduce((s,v)=>s+v*v,0);if(dd===0)return false;const u=Math.max(0,Math.min(1,-a.reduce((s,v,i)=>s+v*d[i],0)/dd));return a.reduce((s,v,i)=>s+(v+u*d[i])**2,0)<1-1e-12;}
export function observe(f,observer){const rows=f.parcels.map(p=>({p,elevation:elevationAt(observer,p),blocked:earthBlocked(observer,p)}));const sunAltitude=altitudeAt(f.sun,observer.latitude,observer.longitude);const eligible=rows.filter(r=>!r.blocked&&r.p.sunlit&&r.elevation>=5&&sunAltitude<=-1);const best=[...rows].sort((a,b)=>(Number(eligible.includes(b))-Number(eligible.includes(a)))||b.elevation-a.elevation)[0];return {sunAltitude,eligible,best};}

// Evaluate the whole available trajectory + parcel lifetime, independent of slider.
// One-second sampling plus exact emission/expiry boundaries; not a weather probability.
export function observationWindow(s,observer){
 const start=s.profile.full[0]?.seconds||0,end=s.end,times=new Set([start,end]);
 for(let t=Math.ceil(start);t<end;t++)times.add(t);
 for(const p of s.profile.full)for(const t of [p.seconds,p.seconds+300])if(t>=start&&t<=end)times.add(t);
 const windows=[];let open=null,maxElevation=null;
 for(const t of [...times].sort((a,b)=>a-b)){
  const f=frame(s,t);let best=-Infinity;
  if(altitudeAt(f.sun,observer.latitude,observer.longitude)<=-1)for(const p of f.parcels)if(p.sunlit){const e=elevationAt(observer,p);if(e>=5&&!earthBlocked(observer,p))best=Math.max(best,e);}
  if(best>-Infinity){if(!open)open={start:t,end:t};else open.end=t;maxElevation=Math.max(maxElevation??-Infinity,best);}
  else if(open){windows.push(open);open=null;}
 }
 if(open)windows.push(open);
 return {possible:windows.length>0,windows,maxElevation,start,end,stepSeconds:1};
}

// Earth radius is 1 in scene units. Keep the near clipping plane clear of terrain.
export function safeCameraPosition({x,y,z},radius=1.015){
 const length=Math.hypot(x,y,z);
 if(length>=radius)return {x,y,z};
 if(length<1e-9)return {x:0,y:0,z:radius};
 const scale=radius/length;return {x:x*scale,y:y*scale,z:z*scale};
}
