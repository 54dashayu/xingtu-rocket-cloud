import { preciseTime } from './model.js';
import { solarPosition, altitudeAt } from './solar.js';
import { simulationProfile } from './prediction.js';
import { visibilitySamples, parcelVisibility } from './visibility.js?v=0.03-0015';
const clamp=x=>Math.max(0,Math.min(1,x));
const cache=new WeakMap();
export const INDEX_LIMIT='0–100 分为实验性几何关注指数，不是可见概率。取采样区域较优地点，不代表你所在地；天气、人口和报告数量不计分。参考上升段至150公里并跟踪留存尾迹5分钟，未预测实际尾迹亮度、形态或扩散。';
// Score each observation time jointly: darkness cannot compensate an unlit plume.
export function scoreObserver(parcels,observer){
 const times=new Map();
 for(const p of parcels){
  if(!Number.isFinite(p.time))continue;
  if(!times.has(p.time))times.set(p.time,0);
  if(!p.sunlit)continue;
  const view=parcelVisibility(observer,p,1),sun=view.sunAltitude,elevation=view.elevation;
  if(!view.possible)continue;
  const darkness=clamp((view.sunAltitudeLimit-sun)/5),height=clamp((elevation-1)/14);
  const quality=darkness*(0.35+0.65*height);
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
 if(!preciseTime(launch))return pending('发射时刻未精确到小时，暂不评分');
 if(!assessment||assessment.net!==launch.timing?.net)return pending('等待本次计划时刻的几何计算');
 const old=cache.get(launch);if(old?.assessment===assessment)return old.value;
 const model=assessment.model;
 if(!model||model.target!==150||model.observer)return pending('等待标准区域评估');
 if(!['possible','no_geometry'].includes(model.code))return pending('场址或轨迹资料待补充');
 const profile=simulationProfile(launch,{target:150,...(Number.isFinite(model.heading)?{azimuth:model.heading}:{})});
 if(!profile.full.length)return pending('轨迹资料待补充');
 const parcels=visibilitySamples(launch,{profile,untilSeconds:profile.duration+300,persistenceSeconds:300,timeStepSeconds:30}).flat();
 const points=(model.points||[]).filter(p=>Number.isFinite(p.latitude)&&Number.isFinite(p.longitude));
 if(model.code==='possible'&&!points.length)return pending('缺少可复核的观测采样点');
 const best=points.map(p=>scoreObserver(parcels,{latitude:p.latitude,longitude:p.longitude})).sort((a,b)=>b.score-a.score)[0];
 const score=best?.score??0;
 const reason=best?`${best.latitude.toFixed(1)}°，${best.longitude.toFixed(1)}°采样点 · ${best.trend} · 采样可观测约${best.windowSeconds}秒`:'本参考上升段未找到符合条件的采样区域';
 const value={score,label:`火箭云指数 ${score}`,reason,limits:INDEX_LIMIT,reference:profile.kind==='predicted',best};
 cache.set(launch,{assessment,value});return value;
}
export function indexBadge(launch){
 const index=cloudIndex(launch);
 // All strings are generated internally; no upstream HTML is interpolated.
 return `<span class="cloud-index ${index.score===null?'pending':index.score>=65?'high':index.score>=35?'medium':'low'}" tabindex="0" title="${index.reason}。${index.reference?'参考轨迹推演；航向和动力学仍有不确定性。':''}${index.limits}">${index.label}${index.reference?'（参考）':''}</span>`;
}
