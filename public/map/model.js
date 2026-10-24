import { cloudOpportunity } from '../cloud-status.js?v=20261024al';
import { flightProfile } from './flight-path.js?v=20261024ad';
import { MAJOR_SITES, findSite } from './sites.js?v=20261024ad';
import { rad, deg, clamp, wrap, solarPosition, altitudeAt } from './solar.js?v=20261024ad';
import { launchCoordinates, rocketCloudForecast } from './rocket-cloud.js?v=20261024ad';
export const EARTH_KM = 6371;
export const DISCLAIMER = '几何初判，不保证可见。不含天气、能见度、高空风和实际飞行轨迹。';
export function destination(origin, bearing, km) {
  const p = rad(origin.latitude), l = rad(origin.longitude), b = rad(bearing), d = km / EARTH_KM;
  const lat = Math.asin(clamp(Math.sin(p) * Math.cos(d) + Math.cos(p) * Math.sin(d) * Math.cos(b)));
  return { latitude: deg(lat), longitude: wrap(deg(l + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p), Math.cos(d) - Math.sin(p) * Math.sin(lat)))) };
}
export function distanceKm(a, b) {
  const dp = rad(b.latitude - a.latitude), dl = rad(wrap(b.longitude - a.longitude));
  const h = Math.sin(dp / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dl / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(Math.max(0, Math.min(1, h))));
}
export function horizonKm(height) {
  if (!Number.isFinite(height) || height < 0) throw new RangeError('Invalid height');
  return EARTH_KM * Math.acos(EARTH_KM / (EARTH_KM + height));
}
export function isSunlit(sun, point, height) {
  return altitudeAt(sun, point.latitude, point.longitude) > -deg(horizonKm(height) / EARTH_KM);
}
export function preciseTime(launch) {
  return Number.isFinite(Date.parse(launch.timing?.net)) && /分钟|秒|小时|minute|second|hour/i.test(launch.timing?.precision || '') && !['cancelled','postponed','tbd','approximate'].includes(launch.scheduleStatus?.code);
}
export function countdown(launch, now = Date.now()) {
  if (['success','failure','partial'].includes(launch.result?.code)&&Date.parse(launch.timing?.net)<=now) return `${launch.result.label||'已发射'} · 历史记录`;
  if (!preciseTime(launch)) return '时间待定 / 不倒计时';
  const sec = Math.floor((Date.parse(launch.timing.net) - now) / 1000);
  if (sec <= 0) return '计划时刻已过 · 结果请核对';
  return `T− ${Math.floor(sec / 86400)}天 ${String(Math.floor(sec / 3600) % 24).padStart(2,'0')}:${String(Math.floor(sec / 60) % 60).padStart(2,'0')}:${String(sec % 60).padStart(2,'0')}（计划）`;
}
// Only a mission-matched, dated source may supply a heading. An orbit class
// cannot establish the launch corridor, doglegs or the actual ascent profile.
export function directionScenario(launch) {
  const report=launch.cloudEvidence?.direction;
  if(report?.kind==='reported_sector'&&Number.isFinite(report.center)&&Number.isFinite(report.halfWidth)&&report.source?.url?.startsWith('https://'))return {kind:'reported_sector',azimuth:report.center,halfWidth:report.halfWidth,label:report.label,basis:report.note,sources:[report.source],officialTrajectory:null};
  const t=launch.trajectory;
  let sourceOK=false;try{sourceOK=new URL(t?.sourceUrl).protocol==='https:';}catch{}
  if(t?.launchId===launch.id && t?.net===launch.timing?.net && Number.isFinite(t.azimuth) && t.azimuth>=0 && t.azimuth<360 && sourceOK && Number.isFinite(Date.parse(t.publishedAt))){
    return {kind:'sourced_heading',azimuth:t.azimuth,label:'有来源的任务方向',basis:`方向来源：${t.sourceName||t.sourceUrl}，${t.publishedAt}；单独的航向不能确定高度、时序和地面距离`,sources:[{url:t.sourceUrl,name:t.sourceName||'方向资料'}],officialTrajectory:null};
  }
  return {kind:'unconfirmed',azimuth:90,label:'方向待确认',basis:'尚无该任务匹配的发射方位资料；不凭轨道类型或发射场填入默认航向',sources:[],officialTrajectory:null};
}
export function mapLaunch(launch) {
  const site=findSite(launch.pad);
  const enriched={...launch,pad:{...launch.pad,...(!launch.pad?.timezone && site?{timezone:site.timezone}: {})}};
  return { ...enriched, siteId: site?.id || null, coordinates: launchCoordinates(launch.pad) || (site?{latitude:site.latitude,longitude:site.longitude,source:site.coordinateSource}:null), direction: directionScenario(launch), rocketCloud: rocketCloudForecast(enriched), observer: null, weather: { status: 'not_connected', source: null } };
}
export function upcoming(launches, now = Date.now(), days = 30) {
  const until=now+days*86400000;
  return launches.filter(l=>{
    if(!l.timing?.net)return true; // Separately labelled undated plans, not confirmed in-window events.
    if(l.result?.code && !['pending','cancelled'].includes(l.result.code))return false;
    const net=Date.parse(l.timing.net);if(!Number.isFinite(net)||net>until)return false;
    const end=Date.parse(l.timing.windowEnd);
    // A nominal midnight on a date-only plan is not a passed launch time.
    const coarse=/日期|到日|^day$/i.test(l.timing.precision || '');
    const latest=Math.max(net,Number.isFinite(end)?end:net,coarse?net+86400000:net);
    return latest>=now;
  }).sort((a,b) => (Date.parse(a.timing?.net) || Infinity) - (Date.parse(b.timing?.net) || Infinity));
}
export function groupSites(launches) {
  const groups = new Map();
  for (const launch of launches) {
    const c = launch.coordinates;
    if (!c) continue;
    const key = `${c.latitude.toFixed(2)},${c.longitude.toFixed(2)}`;
    if (!groups.has(key)) groups.set(key, { ...c, key, launches: [] });
    groups.get(key).launches.push(launch);
  }
  return [...groups.values()];
}
export function scenarioGeometry(launch, date, { azimuth = launch.direction.azimuth, height = 100, trailPoints = null } = {}) {
  const sun = solarPosition(date);
  if (!launch.coordinates) return { sun, points: [], cells: [], reason: '发射场坐标待补充' };
  // Fixed hypothetical trail, NOT altitude/distance as a function of mission elapsed time.
  const points = trailPoints ? trailPoints.map(p=>({...p})) : Array.from({ length: 9 }, (_,i) => ({ ...destination(launch.coordinates, azimuth, i * 100), height }));
  for (const p of points) p.sunlit = isSunlit(sun, p, p.height);
  const lit = points.filter(p => p.sunlit), cells = [], radius = Math.max(0,...points.map(p=>horizonKm(p.height)));
  if (preciseTime(launch)) {
    // 2-degree grid; cell centre only. No refraction, terrain, weather or brightness model.
    for (let lat = -89; lat < 90; lat += 2) for (let lon = -179; lon < 180; lon += 2) {
      if (altitudeAt(sun, lat, lon) <= -1 && lit.some(p => distanceKm({ latitude: lat, longitude: lon }, p) < horizonKm(p.height))) cells.push({ latitude: lat, longitude: lon });
    }
  }
  return { sun, points, cells, radius, reason: preciseTime(launch) ? null : '时间精度不足或计划不稳定，仅演示太阳与假设尾迹；不生成观测扇区' };
}
// Shared SVG/Canvas coordinate adapter. Tianditu must supply its own matching projection.
export const project = ({ latitude, longitude }) => [longitude + 180, 90 - latitude];
export function splitLine(points) {
  const segments=[[]];
  for(const p of points){
    const last=segments.at(-1).at(-1);
    if(last&&Math.abs(p.longitude-last.longitude)>180){
      const east=last.longitude>p.longitude,seam=east?180:-180;
      const lon=p.longitude+(east?360:-360),u=(seam-last.longitude)/(lon-last.longitude);
      const latitude=last.latitude+(p.latitude-last.latitude)*u;
      segments.at(-1).push({longitude:seam,latitude});
      segments.push([{longitude:-seam,latitude}]);
    }
    segments.at(-1).push(p);
  }
  return segments.filter(s=>s.length>1);
}



export function cloudCandidate(launch){return cloudOpportunity(launch)==='possible';}
export function siteInventory(launches){
  const sites=MAJOR_SITES.map(s=>({...s,launches:[]})),unknown=[];
  for(const launch of launches){
    const site=findSite(launch.pad);
    if(site){sites.find(s=>s.id===site.id).launches.push(launch);continue;}
    if(!launch.coordinates){unknown.push(launch);continue;}
    const key=`additional:${launch.pad?.originalLocation || launch.pad?.location || 'unknown'}:${launch.coordinates.latitude.toFixed(2)},${launch.coordinates.longitude.toFixed(2)}`;
    let extra=sites.find(s=>s.id===key);
    if(!extra){extra={id:key,...launch.coordinates,name:launch.pad?.location || '公开任务发射点',short:launch.pad?.location || '任务点',region:'任务数据源',timezone:launch.pad?.timezone,description:'由本期公开任务坐标补充；移动发射点不等于固定航天港。',source:launch.sources?.[0]?.url,launches:[]};sites.push(extra);}
    extra.launches.push(launch);
  }
  return {sites,unknown};
}
// Ordinal geometry-only recommendation, NOT a probability or a weather forecast.
export function geometryRating(launch,{target=100,azimuth=launch.direction?.azimuth ?? 90,manual=false}={}){
  if(!preciseTime(launch)||!launch.coordinates)return {stars:null,label:'暂不评级',reason:'发射时刻或场址坐标未确定',weather:'未评估',trajectory:'估算'};
  if(manual)return {stars:null,label:'手动假设不可评级',reason:'需要本次任务位置序列',weather:'未评估',trajectory:'资料不足'};
  const altitude=altitudeAt(solarPosition(launch.timing.net),launch.coordinates.latitude,launch.coordinates.longitude);
  const profile=flightProfile(launch,{target});
  if(!profile.full.length||!profile.reached)return {stars:null,label:'轨迹资料待补充',reason:profile.reason||'飞行记录未覆盖所选高度，暂不计算完整观测推荐',weather:'未评估',trajectory:'资料不足'};
  const high=profile.full.filter(p=>p.height>=50);
  const lit=high.filter(p=>isSunlit(solarPosition(Date.parse(launch.timing.net)+p.seconds*1000),p,p.height));
  const fraction=high.length?lit.length/high.length:0;
  let stars=1,reason='发射场不在典型晨昏段';
  if(altitude>=-18&&altitude<=4){
    if(fraction===0){stars=1;reason='高空尾迹采样点均在地影中';}
    else if(altitude> -1){stars=2;reason='高空可能受光，但发射场地面尚偏亮';}
    else if(altitude< -12){stars=2;reason='夜色较深，受光窗口受任务方向和高度影响较大';}
    else{stars=fraction>=.8?(altitude>=-8&&altitude<=-2?5:4):fraction>=.4?3:2;reason='地面接近晨昏暗区，部分高空尾迹仍受光';}
  }
  const labels=['','条件一般','有限关注','可以留意','较值得关注','优先关注'];
  return {stars,label:labels[stars],reason,solarAltitude:Number(altitude.toFixed(1)),sunlit:lit.length,samples:high.length,target,weather:'未评估',trajectory:'估算',basis:'计划时刻太阳高度 + 沿任务方向逐点逐时刻受光；发射场附近几何参考，不代表可见概率'};
}

// Radius grows with task count, with a cap to keep busy regions selectable.
export function siteMarkerRadius(count){return count>0?Math.min(6.6,1.5*Math.sqrt(1+1.5*count)):1.5;}

export function pastLaunches(launches,now=Date.now(),days=30){
 return launches.filter(l=>['success','failure','partial'].includes(l.result?.code)&&Date.parse(l.timing?.net)<=now&&Date.parse(l.timing?.net)>=now-days*86400000).sort((a,b)=>Date.parse(b.timing.net)-Date.parse(a.timing.net));
}
