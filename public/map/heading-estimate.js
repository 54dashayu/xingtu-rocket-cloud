// Simulation initial values only. Never promote an estimate to a sourced trajectory.
// Ideal orbit-plane relation: cos(i) = cos(latitude) * sin(azimuth).
// https://orbital-mechanics.space/orbital-maneuvers/plane-change-maneuvers.html#launch-azimuth
const northBranch=new Set(['andoya','saxavord','esrange','plesetsk']);
const wrap=x=>(x%360+360)%360;
export function inclinationHeading(latitude,inclination,south=true){
 if(!Number.isFinite(latitude)||Math.abs(latitude)>=90||!Number.isFinite(inclination)||inclination<0||inclination>180)return null;
 const ratio=Math.cos(inclination*Math.PI/180)/Math.cos(latitude*Math.PI/180);
 if(Math.abs(ratio)>1+1e-10)return null;
 const a=Math.asin(Math.max(-1,Math.min(1,ratio)))*180/Math.PI;
 return Math.round(wrap(south?180-a:a))%360;
}
export function headingEstimate(launch={}){
 const d=launch.direction;
 if(['sourced_heading','reported_sector'].includes(d?.kind)&&Number.isFinite(d.azimuth)&&d.azimuth>=0&&d.azimuth<360)return {azimuth:d.azimuth,kind:d.kind,label:d.kind==='sourced_heading'?'资料航向':'报道方位',basis:d.kind==='sourced_heading'?'优先采用本次任务方位资料。':'采用报道方向的代表角度，非精确航向。'};
 const mission=launch.mission||{},orbit=String(typeof mission.orbit==='object'?mission.orbit?.name||'':mission.orbit||''),south=!northBranch.has(launch.siteId);
 const inclination=Number.isFinite(mission.inclination)?mission.inclination:/sun.synchronous|太阳同步|\bSSO\b/i.test(orbit)?98:/polar|极轨|\bPO\b/i.test(orbit)?90:null;
 if(inclination!==null){
  const heading=inclinationHeading(launch.coordinates?.latitude,inclination,south);
  if(heading!==null)return {azimuth:heading,kind:'estimated',label:'任务预估',basis:`${Number.isFinite(mission.inclination)?'任务倾角':inclination===98?'太阳同步参考倾角':'极轨参考倾角'} ${inclination}° · ${south?'向南':'向北'}分支假设；未计转弯与自转修正。`};
  return {azimuth:90,kind:'fallback',label:'待确认假设',basis:'倾角与场址不足以确定直达方向，暂设向东；请按任务资料调整。'};
 }
 if(/geostationary|geosynchronous|地球同步|静止|\bGTO\b|\bGEO\b/i.test(orbit))return {azimuth:90,kind:'estimated',label:'任务预估',basis:'同步／转移轨道：暂取向东出发，非最终入轨航向。'};
 if(/low earth|近地|低轨|\bLEO\b/i.test(orbit)){
  const heading=launch.siteId==='vandenberg'?180:90;
  return {azimuth:heading,kind:'estimated',label:'任务预估',basis:`低轨任务 · 倾角未知，暂取${heading===180?'范登堡向南':'向东'}参考方向；可手动调整。`};
 }
 return {azimuth:90,kind:'fallback',label:'待确认假设',basis:'任务轨道资料不足，暂设向东 90°，可手动调整。'};
}
