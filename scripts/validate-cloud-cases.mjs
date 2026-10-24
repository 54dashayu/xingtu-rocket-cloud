// Offline, reproducible evidence audit. No fitting and no claims of forecast accuracy.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {solarAltitude,solarPosition,wrap} from '../public/map/solar.js';
import {sunEvents} from '../public/map/sun-events.js';
import {mapLaunch,cloudCandidate,isSunlit} from '../public/map/model.js';
import {simulationProfile} from '../public/map/prediction.js';
import {visibilitySamples} from '../public/map/visibility.js';

export const corpus=JSON.parse(readFileSync(new URL('../data/rocket-cloud-validation-cases.json',import.meta.url)));
// Independent NOAA fractional-year approximation, used only as a cross-check.
// https://gml.noaa.gov/grad/solcalc/solareqns.PDF
export function noaaAltitude(ms,latitude,longitude){
 const d=new Date(ms),year=d.getUTCFullYear(),days=(Date.UTC(year+1,0,1)-Date.UTC(year,0,1))/864e5;
 const day=(ms-Date.UTC(year,0,1))/864e5,g=2*Math.PI/days*(day-.5),r=Math.PI/180;
 const eq=229.18*(.000075+.001868*Math.cos(g)-.032077*Math.sin(g)-.014615*Math.cos(2*g)-.040849*Math.sin(2*g));
 const decl=.006918-.399912*Math.cos(g)+.070257*Math.sin(g)-.006758*Math.cos(2*g)+.000907*Math.sin(2*g)-.002697*Math.cos(3*g)+.00148*Math.sin(3*g);
 const mins=d.getUTCHours()*60+d.getUTCMinutes()+d.getUTCSeconds()/60;
 return Math.asin(Math.sin(latitude*r)*Math.sin(decl)+Math.cos(latitude*r)*Math.cos(decl)*Math.cos((mins+eq+4*longitude-720)/4*r))/r;
}
const clock=(time,zone)=>new Date(Math.round(Date.parse(time)/60000)*60000).toLocaleTimeString('en-GB',{timeZone:zone,hour:'2-digit',minute:'2-digit'});
export function auditCase(c){
 const t=Date.parse(c.utc),site=c.site,sun=sunEvents(c.utc,site,site.timeZone),alt=solarAltitude(t,site.latitude,site.longitude);
 const launch=mapLaunch({id:c.id,timing:{net:c.utc,precision:'精确到分钟'},pad:{...site,timezone:site.timeZone},mission:{},scheduleStatus:{code:'confirmed'}});
 const nearest=['sunrise','sunset'].map(kind=>({kind,minutes:(t-Date.parse(sun[kind]))/60000})).sort((a,b)=>Math.abs(a.minutes)-Math.abs(b.minutes))[0];
 const directions=[];
 // Exhaustive coarse heading sensitivity, NOT a recovered mission direction.
 for(let azimuth=0;azimuth<360;azimuth+=15){
  const heights=[];
  for(const target of [100,150,200]){
   const profile=simulationProfile(launch,{azimuth,target,historical:false});
   const samples=visibilitySamples(launch,{profile,persistenceSeconds:300})[0]||[];
   const lit=samples.filter(p=>p.sunlit);
   const at=c.observation?(Date.parse(c.observation.nominalUtc)-t)/1000:null;
   heights.push({target,reached:profile.reached===true,modelFlightSeconds:profile.full.length?profile.duration:null,modelWindowEndSeconds:profile.full.length?profile.duration+300:null,
    firstSunlitSeconds:lit.length?(Math.min(...lit.map(p=>p.time))-t)/1000:null,
    sunlitParcelsExist:lit.length>0,
    observationTimeStatus:!profile.full.length?'profile_unavailable':at===null?'not_reported':at<0||at>profile.duration+300?'outside_model_time_window':'inside_time_window_only'});
  }
  directions.push({azimuth,kind:'parameter_sweep_not_actual_heading',heights});
 }
 const delta=site.sensitivityDegrees||0,positionSensitivity=[];
 if(delta)for(const dy of [-delta,0,delta])for(const dx of [-delta,0,delta]){
  const p={latitude:site.latitude+dy,longitude:site.longitude+dx},s=sunEvents(c.utc,p,site.timeZone);
  positionSensitivity.push({offsetLatitude:dy,offsetLongitude:dx,solarAltitude:solarAltitude(t,p.latitude,p.longitude),minutesAfterSunset:(t-Date.parse(s.sunset))/60000});
 }
 return {id:c.id,name:c.name,utc:c.utc,localDate:new Intl.DateTimeFormat('en-CA',{timeZone:site.timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(t)),local:clock(c.utc,site.timeZone),beijing:clock(c.utc,'Asia/Shanghai'),site,
  sunrise:clock(sun.sunrise,site.timeZone),sunset:clock(sun.sunset,site.timeZone),sunriseUtc:sun.sunrise,sunsetUtc:sun.sunset,
  nearest,solarAltitude:alt,solarAltitude10MinutesLater:solarAltitude(t+600e3,site.latitude,site.longitude),
  terminatorWestwardDegrees10Minutes:-wrap(solarPosition(t+600e3).longitude-solarPosition(t).longitude),
  noaaDifferenceDegrees:alt-noaaAltitude(t,site.latitude,site.longitude),
  nasaSunriseCheckMinutes:c.expectedMinutesBeforeSunrise===undefined?null:{reported:c.expectedMinutesBeforeSunrise,calculated:(Date.parse(sun.sunrise)-t)/60000},
  fixedSiteSunlitAtLaunch:[100,150,200].map(height=>({height,sunlit:isSunlit(solarPosition(t),site,height)})),
  currentCandidate:cloudCandidate(launch),currentScreeningLabel:launch.rocketCloud.label,
  observation:c.observation?{...c.observation,secondsAfterLaunch:(Date.parse(c.observation.nominalUtc)-t)/1000}:null,
  spatialValidation:'not_scored_missing_geolocated_timed_observations_and_verified_trajectory',
  sourceRegions:c.publicReportRegions||[],videoRegions:c.videoRegions,positionSensitivity,directions,sources:c.sources};
}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createReport(){
 const results=corpus.cases.map(auditCase),out=new URL('../output/model-audit/',import.meta.url);mkdirSync(out,{recursive:true});
 const summary={cases:results.length,candidateScreenMatches:results.filter(r=>r.currentCandidate).length,
  maximumSolarCrossCheckDifferenceDegrees:Math.max(...results.map(r=>Math.abs(r.noaaDifferenceDegrees))),
  spatiallyValidatedCases:0,notes:corpus.limitations};
 writeFileSync(new URL('seven-case-audit.json',out),JSON.stringify({summary,results},null,2)+'\n');
 const rows=results.map(r=>`<tr><td>${esc(r.name)}<br><small>${r.localDate}</small></td><td>${r.local}<br><small>${esc(r.site.timeZone)}<br>北京 ${r.beijing}</small></td><td>${r.sunrise} / ${r.sunset}</td><td>${r.solarAltitude.toFixed(1)}°<br><small>${r.nearest.kind==='sunrise'?'日出':'日落'}${r.nearest.minutes<0?'前':'后'} ${Math.abs(r.nearest.minutes).toFixed(0)} 分钟</small></td><td>${esc(r.currentScreeningLabel)}</td><td>${r.sources.map((s,i)=>`<a href="${esc(s.url)}">${i+1}. ${esc(s.title)}</a>`).join('<br>')}</td></tr>`).join('');
 const regions=corpus.cases.map(c=>`<li><b>${esc(c.name)}</b>：${esc(c.videoRegions.join('、')||'逐字稿未指定区域')}。${c.publicReportRegions?`公开报道另记：${esc(c.publicReportRegions.join('、'))}。`:''}${c.observation?`观测时间：${esc(c.observation.nominalUtc)}（${esc(c.observation.precision)}）。`:''} ${esc(c.notes.join(' '))}</li>`).join('');
 const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>星途 · 七次火箭云历史案例核验</title><style>body{font:16px/1.7 system-ui,sans-serif;color:#213a56;background:#edf3fb;margin:0}main{max-width:1200px;margin:32px auto;padding:32px;background:white;border-radius:18px}h1{color:#164d89}table{border-collapse:collapse;width:100%;font-size:14px}td,th{padding:12px;border-bottom:1px solid #d9e5f2;text-align:left;vertical-align:top}th{background:#e9f2ff}small{color:#667d96}a{color:#2864a9}li{margin-bottom:14px}.finding{padding:18px;background:#fff4dd;border-left:4px solid #d49124}.scroll{overflow:auto}@media(max-width:700px){main{padding:16px;margin:0}}</style><main><h1>星途 · 七次火箭云历史案例核验</h1><p>核对日期：2026-10-24。发射时刻来自公开通告；日出、日落与太阳高度为现有模型计算值。太阳高度为几何中心；日出日落使用 −0.833°标准，不含地形与实际大气。</p><div class="scroll"><table><thead><tr><th>任务 / 当地日期</th><th>实际发射时间</th><th>当地日出 / 日落</th><th>发射场太阳高度</th><th>当前宽筛选</th><th>核对来源</th></tr></thead><tbody>${rows}</tbody></table></div><p><b>跨日说明：</b>2025-06-06 04:45 北京时间对应 UTC 06-05；2025-07-15 05:34 对应 UTC 07-14。美国两例分别使用 EST 和 EDT。海上发射仅以 21.5°N、112°E 假设点回算，并对经纬各 ±1° 做敏感性检查；不是核实的发射船位置。</p><h2>本轮验证得到什么</h2><div class="finding"><b>主要缺口是飞行时段覆盖，不是简单加宽晨昏带。</b><p>6月4日太原起飞时太阳仍约 +1.9°，约在日落前16分钟。PhilSA 报告菲律宾约20:00出现光云，即 T+21分钟，关联措辞为“极有可能”。当前参考动力学按各航向积分，加假设尾迹留存5分钟；有些情景未达到200公里，有些虽然达到，但仍不能覆盖T+21分钟。缺少轨迹的情景记为不可计算，超出时段的观测不能记为“预测不可见”。</p></div><ul><li>NASA 3月4日案例的“日出前52分钟”回算为 ${results.find(r=>r.id==='f9-sl1040-20260304').nasaSunriseCheckMinutes.calculated.toFixed(2)} 分钟；没有按此结果拟合算法。</li><li>七例太阳高度与独立 NOAA 近似公式的最大差值 ${summary.maximumSolarCrossCheckDifferenceDegrees.toFixed(3)}°。这是数值交叉核对，不是气象或空间覆盖验证。</li><li>当前宽筛选（原晨昏候选加日出日落前后90分钟）保留 ${summary.candidateScreenMatches}/7 个正例；并非准确率。不能只保留“值得留意”，否则本组6月4日及3月4日会被排除。</li><li>每例用24个航向、3档高度作诊断，共504种通用情景。它们仅用于检查方向敏感性及时间覆盖，不是恢复出的真实航向；没有选取某条路线去拟合报道区域。</li><li>100/150公里是界面截点，200公里仅供离线扩展分析，不等于完整火箭云产生过程。需有后续轨迹或明确情景才能延长时段；不能凭这些正例把尾迹寿命强行改长。</li></ul><h2>区域证据与限制</h2><ul>${regions}</ul><p>区域名称保留在验证资料中，不添加地图城市标记。没有把省份、国家中心点伪装成相机位置；因此本轮不输出区域命中率或“已验证观看边界”。缺少带时标影像、真实飞行序列及未观测到火箭云的对照任务，完整空间准确率尚不能计算。</p><p>复现：<code>node scripts/validate-cloud-cases.mjs</code>。原始核验记录：<code>data/rocket-cloud-validation-cases.json</code>；完整数值和504种情景：<code>output/model-audit/seven-case-audit.json</code>。</p></main></html>`;
 writeFileSync(new URL('seven-case-report.html',out),html);
 return {summary,results};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {summary,results}=createReport();console.log(JSON.stringify({summary,solar:results.map(r=>({id:r.id,altitude:r.solarAltitude,nearest:r.nearest,observation:r.observation}))},null,2));
}
