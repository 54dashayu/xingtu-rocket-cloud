import {ASSESSMENT_VERSION,morphologySignature} from './morphology.js?v=0.03-0035';
import { fuelRange, propulsionInfo, PROPULSION_VERSION, FUEL_LIMIT } from './propulsion.js?v=0.03-0035';
import { preciseTime } from './model.js?v=0.03-0035';
import { solarPosition, altitudeAt } from './solar.js?v=0.03-0035';
import { simulationProfile } from './prediction.js?v=0.03-0035';
import { visibilitySamples, parcelVisibility } from './visibility.js?v=0.03-0035';
const clamp=x=>Math.max(0,Math.min(1,x));
const cache=new WeakMap();
export const INDEX_LIMIT='0–100 分为实验性关注指数（几何＋推进剂情景），不是可见概率或水母形态概率。取采样区域较优地点，不代表你所在地；天气、人口和报告数量不计分。按可用动力段或任务资料计算，并跟踪留存尾迹5分钟，未预测实际尾迹亮度、形态或扩散。';
// Score each observation time jointly: darkness cannot compensate an unlit plume.
export function scoreObserver(parcels,observer,factor=()=>1){
 const times=new Map();
 for(const p of parcels){
  if(!Number.isFinite(p.time))continue;
  if(!times.has(p.time))times.set(p.time,0);
  if(!p.sunlit)continue;
  const view=parcelVisibility(observer,p,1),sun=view.sunAltitude,elevation=view.elevation;
  if(!view.possible)continue;
  const darkness=clamp((view.sunAltitudeLimit-sun)/5),height=clamp((elevation-1)/14);
  const quality=darkness*(0.35+0.65*height)*clamp(factor(p));
  times.set(p.time,Math.max(times.get(p.time),quality));
 }
 const ordered=[...times].sort((a,b)=>a[0]-b[0]);
 let weighted=0,window=0;
 for(let i=1;i<ordered.length;i++){
  // Cap quadrature gaps; missing samples do not imply a continuous visible window.
  const dt=Math.min(30,(ordered[i][0]-ordered[i-1][0])/1000);
  weighted+=dt*(ordered[i][1]+ordered[i-1][1])/2;
  if(ordered[i][1]>0&&ordered[i-1][1]>0)window+=dt;
 }
 const peak=Math.max(0,...times.values());
 const score=Math.round(100*(0.7*peak+0.3*clamp(weighted/120)));
 const first=ordered[0]?.[0],last=ordered.at(-1)?.[0];
 const delta=first!==undefined?altitudeAt(solarPosition(last),observer.latitude,observer.longitude)-altitudeAt(solarPosition(first),observer.latitude,observer.longitude):0;
 return {score,windowSeconds:Math.round(window),trend:delta<-.05?'天色渐暗':delta>.05?'天色渐亮':'天色变化较小',...observer};
}
export function cloudIndex(launch,assessment=launch.cloudAssessment){
 const pending=reason=>({score:null,label:'火箭云指数 · 待评估',reason,limits:INDEX_LIMIT});
 if(launch.timing?.basis==='notice_window'&&assessment?.net===launch.timing.net&&assessment?.windowIndex){return assessment.windowIndex.modelVersion===PROPULSION_VERSION?assessment.windowIndex:pending('航警指数需按新推进剂模型重新评估');}
 if(!preciseTime(launch))return pending('发射时刻未精确到小时，暂不评分');
 if(!assessment||assessment.net!==launch.timing?.net)return pending('等待本次计划时刻的几何计算');
 const old=cache.get(launch);if(old?.assessment===assessment&&old.signature===morphologySignature(launch))return old.value;
 const model=assessment.model;
 if(!model||![0,150].includes(model.target)||model.observer)return pending('等待标准区域评估');
 if(!['possible','no_geometry'].includes(model.code))return pending('场址或轨迹资料待补充');
 const profile=simulationProfile(launch,{target:model.target,...(Number.isFinite(model.heading)?{azimuth:model.heading}:{})});
 if(!profile.full.length)return pending('轨迹资料待补充');
 const parcels=visibilitySamples(launch,{profile,untilSeconds:profile.duration+300,persistenceSeconds:300,timeStepSeconds:30}).flat();
 const points=(model.points||[]).filter(p=>Number.isFinite(p.latitude)&&Number.isFinite(p.longitude));
 if(model.code==='possible'&&!points.length)return pending('缺少可复核的观测采样点');
 const best=points.map(p=>scoreObserver(parcels,{latitude:p.latitude,longitude:p.longitude})).sort((a,b)=>b.score-a.score)[0];
 const geometryScore=best?.score??0;
 const weights=new Map(parcels.map(p=>[p,fuelRange(launch,p)]));
 const low=points.map(p=>scoreObserver(parcels,p,q=>weights.get(q).min)).sort((a,b)=>b.score-a.score)[0]?.score??0;
 const high=points.map(p=>scoreObserver(parcels,p,q=>weights.get(q).max)).sort((a,b)=>b.score-a.score)[0]?.score??0;
 const info=propulsionInfo(launch),score=high;
 const fuelNote=info.known?fuelRange(launch,parcels[0]||{seconds:0}).basis+'；'+FUEL_LIMIT:'推进剂待核实，当前仅几何评估';
 const reason=best?`${best.latitude.toFixed(1)}°，${best.longitude.toFixed(1)}°采样点 · ${best.trend} · 采样可观测约${best.windowSeconds}秒`:'本参考上升段未找到符合条件的采样区域';
 const value={score,min:low,max:high,geometryScore,modelVersion:PROPULSION_VERSION,assessmentVersion:ASSESSMENT_VERSION,propulsionKnown:info.known,propulsionComplete:info.fuelComplete===true,label:`火箭云指数 ${low===high?high:low+'–'+high}`,reason:reason+' · '+fuelNote,limits:INDEX_LIMIT,reference:profile.kind==='predicted',best};
 cache.set(launch,{assessment,value,signature:morphologySignature(launch)});return value;
}
export function indexBadge(launch){
 const index=cloudIndex(launch);
 // All strings are generated internally; no upstream HTML is interpolated.
 return `<span class="cloud-index ${index.score===null?'pending':index.score>=65?'high':index.score>=35?'medium':'low'}" tabindex="0" title="${index.reason}。${index.reference?'参考轨迹推演；航向和动力学仍有不确定性。':''}${index.limits}">${index.label}</span>`;
}
