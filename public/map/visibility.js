import { flightProfile } from './flight-path.js?v=20261024ad';
import { distanceKm, horizonKm, isSunlit } from './model.js?v=20261024ad';
import { solarPosition, altitudeAt, rad, deg, wrap } from './solar.js?v=20261024ad';
const R=6371;
// Highlight onset follows the simulated separation altitude when available.
// A sourced path without staging information uses the generic separation-height reference,
// not an asserted separation event for that mission. Neither predicts cloud morphology.
export function jellyfishReferenceHeight(profile){
 return Number.isFinite(profile.plumeStartHeight)&&profile.plumeStartHeight>0?profile.plumeStartHeight:70;
}
export function elevationAt(observer,point){
 const angle=distanceKm(observer,point)/R;
 return deg(Math.atan2((R+point.height)*Math.cos(angle)-R,(R+point.height)*Math.sin(angle)));
}
// Persistence is a configurable scenario, not an observed plume lifetime.
// Static Earth-fixed parcels: no wind, expansion, brightness or engine on/off inference.
export function visibilitySamples(launch,options={}){
 const profile=options.profile||flightProfile(launch,options);
 const minimumHeight=options.minEmissionHeight??0;
 if(!Number.isFinite(minimumHeight)||minimumHeight<0)throw new RangeError('Invalid emission height');
 if(!profile.full.length)return [];
 const lifetime=options.persistenceSeconds??0,at=options.atSeconds,until=options.untilSeconds??Infinity,step=options.timeStepSeconds??30;
 if(!Number.isFinite(lifetime)||lifetime<0||lifetime>1800||!Number.isFinite(step)||step<=0)throw new RangeError('Invalid plume sampling options');
 if(at!==undefined&&!Number.isFinite(at))throw new RangeError('Invalid plume time');
 if(until!==Infinity&&(!Number.isFinite(until)||until<0))throw new RangeError('Invalid plume cutoff');
 const points=[],suns=new Map(),start=Date.parse(launch.timing.net);
 if(!Number.isFinite(start))return [];
 for(const p of profile.full){
  if(p.emitting===false||p.height<=0||p.height<minimumHeight||p.seconds>until)continue;
  const times=[];
  if(at!==undefined){if(at>=p.seconds&&at<=Math.min(p.seconds+lifetime,until))times.push(at);}
  else {const ageLimit=Math.min(lifetime,until-p.seconds);for(let age=0;age<ageLimit;age+=step)times.push(p.seconds+age);times.push(p.seconds+ageLimit);}
  for(const seconds of times){
   const time=start+seconds*1000;
   if(!suns.has(time))suns.set(time,solarPosition(time));const sun=suns.get(time);
   points.push({...p,time,emittedAt:start+p.seconds*1000,age:seconds-p.seconds,sun,sunlit:isSunlit(sun,p,p.height)});
  }
 }
 return [points];
}
export function observerVisibility(samples,observer,minElevation=5,maxSunAltitude=-1){
 const variants=samples.map(points=>points.filter(p=>p.sunlit&&altitudeAt(p.sun,observer.latitude,observer.longitude)<=maxSunAltitude&&elevationAt(observer,p)>=minElevation));
 const hits=variants.filter(v=>v.length),all=hits.flat();
 return {possible:hits.length>0,consistent:hits.length===samples.length&&samples.length>0,variants:hits.length,total:samples.length,
  firstTime:all.length?Math.min(...all.map(p=>p.time)):null,lastTime:all.length?Math.max(...all.map(p=>p.time)):null,
  maxElevation:all.length?Math.max(...all.map(p=>elevationAt(observer,p))):null};
}
// Elevation threshold expressed as a geocentric dot product, avoiding per-cell
// distance/atan2 calls for every retained parcel and observation time.
function cosineLimit(height,elevation){const e=rad(elevation);return Math.cos(Math.acos(R/(R+height)*Math.cos(e))-e);}
const unit=p=>{const lat=rad(p.latitude),lon=rad(p.longitude),c=Math.cos(lat);return [c*Math.cos(lon),c*Math.sin(lon),Math.sin(lat)];};
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
// Angular separation between observer->plume and observer->Sun (Sun at infinity).
// For display direction only; not a particle scattering/brightness model.
function elongation(angle,observerSun,pointSun,height){
 const radius=R+height,range=Math.sqrt(Math.max(0,radius*radius+R*R-2*radius*R*angle));
 return range>0?deg(Math.acos(Math.max(-1,Math.min(1,(radius*pointSun-R*observerSun)/range)))):90;
}
export function viewingElongation(observer,point,sun){
 const o=unit(observer),p=unit(point),s=unit(sun);
 return elongation(dot(o,p),dot(o,s),dot(p,s),point.height);
}

export function visibilityFootprint(launch,options={}){
 const samples=visibilitySamples(launch,options),minElevation=options.minElevation??5,coreElevation=options.coreElevation??5;
 const parcels=samples.flat(),maxHeight=Math.max(0,...parcels.map(p=>p.height));
 const radius=Math.max(0,...parcels.map(p=>p.downrange))+horizonKm(maxHeight);
 const latSpan=deg(radius/R),origin=launch.coordinates,cells=[],coreCells=[],twilightCells=[];
 if(!origin||!parcels.length)return {samples,cells,coreCells,twilightCells,minElevation,coreElevation};
 const prepared=parcels.filter(p=>p.sunlit).map(p=>({point:unit(p),sun:unit(p.sun),height:p.height,pointSun:dot(unit(p),unit(p.sun)),edge:cosineLimit(p.height,minElevation),core:cosineLimit(p.height,coreElevation)}));
 // Civil twilight ends at -6 degrees. This is a sky-darkness classification,
 // not a calibrated plume brightness or detection probability.
 const darkLimit=Math.sin(rad(-1)),coreDarkLimit=Math.sin(rad(-6));
 for(let latitude=-89.5;latitude<90;latitude++){
  if(Math.abs(latitude-origin.latitude)>latSpan+1)continue;
  for(let longitude=-179.5;longitude<180;longitude++){
   const cell={latitude,longitude};if(distanceKm(origin,cell)>radius+160)continue;
   const observer=unit(cell);let possible=false,core=false,higher=false,chosenRank=-1,sunSeparation=0;
   for(const p of prepared){
    const angle=dot(observer,p.point),sunHeight=dot(observer,p.sun);if(angle<p.edge||sunHeight>darkLimit)continue;
    possible=true;
    const rank=angle>=p.core?(sunHeight<=coreDarkLimit?2:1):0;
    if(rank>=1)higher=true;if(rank===2)core=true;
    // Pick the most sun-separated visible parcel within the cell's displayed class.
    const separation=elongation(angle,sunHeight,p.pointSun,p.height);
    if(rank>chosenRank){chosenRank=rank;sunSeparation=separation;}else if(rank===chosenRank)sunSeparation=Math.max(sunSeparation,separation);
   }
   if(possible){const value={...cell,consistent:true,sunSeparation,band:core?'higher':higher?'twilight':'low'};cells.push(value);if(core)coreCells.push(value);else if(higher)twilightCells.push(value);}
  }
 }
 return {samples,cells,coreCells,twilightCells,minElevation,coreElevation};
}
