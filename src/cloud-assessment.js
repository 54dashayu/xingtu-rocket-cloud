import {launchReliability} from './launch-reliability.js';
import { mapLaunch, preciseTime } from '../public/map/model.js';
import { simulationProfile } from '../public/map/prediction.js';
import { visibilityFootprint, visibilitySamples, observerVisibility } from '../public/map/visibility.js';
import { cloudIndex } from '../public/map/cloud-index.js';
import { simulationLaunch } from '../public/map/manual-time.js';
import { weatherAt } from './weather.js';
const memo=new Map();
// Spatially spread sample points. These are not a weather raster or population coverage estimate.
export function sampleCells(cells,count=9){
 if(cells.length<=count)return cells;
 const selected=[cells[Math.floor(cells.length/2)]],distance=(a,b)=>(a.latitude-b.latitude)**2+((a.longitude-b.longitude+540)%360-180)**2*Math.cos(a.latitude*Math.PI/180)**2;
 while(selected.length<count){let best=null,score=-1;for(const p of cells){const d=Math.min(...selected.map(q=>distance(p,q)));if(d>score){score=d;best=p;}}if(score<=0)break;selected.push(best);}
 return selected;
}
export function modelAssessment(raw,{target=0,observer=null,azimuth,now=Date.now()}={}){
 const l=mapLaunch(raw),history=!raw.manualScenario&&Date.parse(l.timing?.net)<=now,base={time:l.timing?.net,target,observer,siteSolarAltitude:l.rocketCloud.solarAltitude,reliability:launchReliability(raw)};
 if(!preciseTime(l)||!l.coordinates)return {...base,code:'pending',label:'发射时刻或场址待补充',points:[]};
 const key=JSON.stringify([raw,target,observer,azimuth,history]),cached=memo.get(key);if(cached)return cached;
 const profile=simulationProfile(l,{target,historical:history,...(azimuth===undefined?{}:{azimuth})});
 let result;
 if(!profile.full.length)result={...base,code:'preliminary',label:'晨昏初筛 · 轨迹参数待补',candidate:['possible','favorable'].includes(l.rocketCloud.code),reason:profile.reason,points:[]};
 else {
  const options={profile,untilSeconds:profile.duration+300,persistenceSeconds:300,minElevation:1};
  let points;
  if(observer){const hit=observerVisibility(visibilitySamples(l,options),observer,1);points=hit.possible?[{...observer,...hit}]:[];}
  else points=sampleCells(visibilityFootprint(l,options).cells).map(p=>({...p,...observerVisibility(visibilitySamples(l,options),p,1)})).filter(p=>p.possible&&Number.isFinite(p.firstTime));
  result={...base,code:points.length?'possible':'no_geometry',label:points.length?'符合几何观测条件':'本分析段未找到符合条件的区域',points,profileKind:profile.kind,reference:profile.kind==='predicted',duration:profile.duration,heading:profile.azimuth??null,source:profile.source||null};
 }
 if(memo.size>100)memo.delete(memo.keys().next().value);memo.set(key,result);return result;
}
export async function assessCloud(launch,options={}){
 if(launch.timing?.basis==='notice_window'&&!launch.manualScenario)return assessNoticeWindow(launch,options);
 const model=modelAssessment(launch,options);
 // First iOS release is geometry-only: return before any weather provider call.
 if(options.weatherEnabled===false)return {version:'geometry-only-1',launchId:launch.id,net:launch.timing?.net,generatedAt:new Date(options.now??Date.now()).toISOString(),launchSource:launch.sources||[],model,
 weather:{status:'disabled',label:'此版本未提供天气预测',samples:[],sources:[],counts:{}},conclusion:model.label,
 limits:'仅分析光照和几何可见性，不包含天气、尾迹亮度与扩散预测；不保证实际可见。'};
 // Query each observation point at its first eligible time, not weather at the launch pad.
 const groups=new Map();for(const p of model.points){const hour=Math.round(p.firstTime/3600000)*3600000;const group=groups.get(hour)||[];group.push(p);groups.set(hour,group);}
 const batches=[];for(const [hour,points]of groups)batches.push(await (options.weatherProvider||weatherAt)(points,new Date(hour).toISOString(),options));
 const evaluated=batches.flatMap(b=>b.points||[]),available=evaluated.filter(p=>p.code!=='missing');
 const weather={status:!model.points.length?'not_requested':batches.some(b=>b.status==='available')?'available':batches[0]?.status||'unavailable',
 label:!model.points.length?'待确定观测区域':batches[0]?.label||'天气暂不可用',samples:evaluated,sources:batches.map(({points,...b})=>b),counts:{clearer:available.filter(p=>p.code==='clearer').length,mixed:available.filter(p=>p.code==='mixed').length,obstructed:available.filter(p=>p.code==='obstructed').length,missing:model.points.length-available.length}};
 const conclusion=model.code!=='possible'?model.label:!available.length?'几何条件符合 · 天气待更新':weather.counts.clearer?'存在遮挡较少的观测采样点':weather.counts.mixed?'几何条件符合 · 天气条件一般':'采样点遮挡风险较高';
 return {version:'geometry-weather-2',launchId:launch.id,net:launch.timing?.net,generatedAt:new Date(options.now??Date.now()).toISOString(),launchSource:launch.sources||[],model,weather,conclusion,
 limits:'天气只评估观测点遮挡；不代表尾迹一定形成或可见。未计算高层大气扩散、散射亮度和视线沿途云层。区域采用最多9个采样点，不是整片区域天气结论。'};
}

const noticeMemo=new Map();
// Sample the notice interval, never promote its start to a published ignition time.
async function assessNoticeWindow(launch,options){
 const start=Date.parse(launch.timing.windowStart),end=Date.parse(launch.timing.windowEnd),heading=launch.warningDiscovery?.headingEstimate;
 if(!launchReliability(launch).assessment.eligible||!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end-start>7200000||!Number.isFinite(heading)||heading<0||heading>=360){
  return assessCloud({...launch,manualScenario:true},options);
 }
 const key=JSON.stringify([launch,options.target,options.observer,options.weatherEnabled]);
 const cached=noticeMemo.get(key);if(!options.weatherProvider&&cached&&Date.now()-cached.at<300000)return cached.result;
 const intervals=Math.ceil((end-start)/300000),samples=[];
 for(let i=0;i<=intervals;i++){
  const net=new Date(start+(end-start)*i/intervals).toISOString();
  const scenario={...simulationLaunch(launch,net),manualScenario:true};
  const assessment=await assessCloud(scenario,{...options,azimuth:heading,weatherEnabled:false});
  const index=cloudIndex(mapLaunch(scenario),assessment);
  samples.push({net,score:index.score,scenario,assessment});
 }
 const complete=samples.every(s=>Number.isFinite(s.score));
 const ranked=samples.filter(s=>Number.isFinite(s.score)).sort((a,b)=>b.score-a.score),best=ranked[0]||samples[0];
 const result=options.weatherEnabled===false?best.assessment:await assessCloud(best.scenario,{...options,azimuth:heading});
 const scores=ranked.map(s=>s.score),min=complete?Math.min(...scores):null,max=complete?Math.max(...scores):null;
 const reason=`按航警窗口采样 ${samples.length} 个时刻，航向参考 ${heading}°；时间窗与方向均非正式发射参数。天气仅对应采样指数最高的参考时刻。`;
 const windowIndex={score:max,min,max,label:complete?`火箭云指数 ${min===max?max:min+'–'+max}（航警预估）`:'火箭云指数 · 待评估',reason,reference:true,limits:'0–100 分是几何关注指数，不是可见概率。范围为所采样时刻的评分范围，非置信区间；未计天气和未知火箭型号的误差。'};
 const value={...result,model:{...result.model,reliability:launchReliability(launch)},net:launch.timing.net,windowIndex,noticeWindow:{start:launch.timing.windowStart,end:launch.timing.windowEnd,heading,referenceTime:best.net,samples:samples.map(({net,score})=>({net,score}))},limits:reason+' '+result.limits};
 if(noticeMemo.size>30)noticeMemo.delete(noticeMemo.keys().next().value);
 if(!options.weatherProvider)noticeMemo.set(key,{at:Date.now(),result:value});
 return value;
}
