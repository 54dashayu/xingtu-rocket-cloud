import { mapLaunch, preciseTime } from '../public/map/model.js';
import { simulationProfile } from '../public/map/prediction.js';
import { visibilityFootprint, visibilitySamples, observerVisibility } from '../public/map/visibility.js';
import { weatherAt } from './weather.js';
const memo=new Map();
// Spatially spread sample points. These are not a weather raster or population coverage estimate.
export function sampleCells(cells,count=9){
 if(cells.length<=count)return cells;
 const selected=[cells[Math.floor(cells.length/2)]],distance=(a,b)=>(a.latitude-b.latitude)**2+((a.longitude-b.longitude+540)%360-180)**2*Math.cos(a.latitude*Math.PI/180)**2;
 while(selected.length<count){let best=null,score=-1;for(const p of cells){const d=Math.min(...selected.map(q=>distance(p,q)));if(d>score){score=d;best=p;}}if(score<=0)break;selected.push(best);}
 return selected;
}
export function modelAssessment(raw,{target=150,observer=null,azimuth,now=Date.now()}={}){
 const l=mapLaunch(raw),history=!raw.manualScenario&&Date.parse(l.timing?.net)<=now,base={time:l.timing?.net,target,observer,siteSolarAltitude:l.rocketCloud.solarAltitude};
 if(!preciseTime(l)||!l.coordinates)return {...base,code:'pending',label:'发射时刻或场址待补充',points:[]};
 const key=JSON.stringify([raw,target,observer,azimuth,history]),cached=memo.get(key);if(cached)return cached;
 const profile=simulationProfile(l,{target,historical:history,...(azimuth===undefined?{}:{azimuth})});
 let result;
 if(!profile.full.length)result={...base,code:'preliminary',label:'晨昏初筛 · 轨迹参数待补',candidate:['possible','favorable'].includes(l.rocketCloud.code),reason:profile.reason,points:[]};
 else {
  const options={profile,untilSeconds:profile.duration,persistenceSeconds:300,minElevation:1};
  let points;
  if(observer){const hit=observerVisibility(visibilitySamples(l,options),observer,1);points=hit.possible?[{...observer,...hit}]:[];}
  else points=sampleCells(visibilityFootprint(l,options).cells).map(p=>({...p,...observerVisibility(visibilitySamples(l,options),p,1)})).filter(p=>p.possible&&Number.isFinite(p.firstTime));
  result={...base,code:points.length?'possible':'no_geometry',label:points.length?'符合几何观测条件':'本分析段未找到符合条件的区域',points,profileKind:profile.kind,reference:profile.kind==='predicted',duration:profile.duration,heading:profile.azimuth??null,source:profile.source||null};
 }
 if(memo.size>100)memo.delete(memo.keys().next().value);memo.set(key,result);return result;
}
export async function assessCloud(launch,options={}){
 const model=modelAssessment(launch,options);
 // Query each observation point at its first eligible time, not weather at the launch pad.
 const groups=new Map();for(const p of model.points){const hour=Math.round(p.firstTime/3600000)*3600000;const group=groups.get(hour)||[];group.push(p);groups.set(hour,group);}
 const batches=[];for(const [hour,points]of groups)batches.push(await (options.weatherProvider||weatherAt)(points,new Date(hour).toISOString(),options));
 const evaluated=batches.flatMap(b=>b.points||[]),available=evaluated.filter(p=>p.code!=='missing');
 const weather={status:!model.points.length?'not_requested':batches.some(b=>b.status==='available')?'available':batches[0]?.status||'unavailable',
 label:!model.points.length?'待确定观测区域':batches[0]?.label||'天气暂不可用',samples:evaluated,sources:batches.map(({points,...b})=>b),counts:{clearer:available.filter(p=>p.code==='clearer').length,mixed:available.filter(p=>p.code==='mixed').length,obstructed:available.filter(p=>p.code==='obstructed').length,missing:model.points.length-available.length}};
 const conclusion=model.code!=='possible'?model.label:!available.length?'几何条件符合 · 天气待更新':weather.counts.clearer?'存在遮挡较少的观测采样点':weather.counts.mixed?'几何条件符合 · 天气条件一般':'采样点遮挡风险较高';
 return {version:'geometry-weather-1',launchId:launch.id,net:launch.timing?.net,generatedAt:new Date(options.now??Date.now()).toISOString(),launchSource:launch.sources||[],model,weather,conclusion,
 limits:'天气只评估观测点遮挡；不代表尾迹一定形成或可见。未计算高层大气扩散、散射亮度和视线沿途云层。区域采用最多9个采样点，不是整片区域天气结论。'};
}
