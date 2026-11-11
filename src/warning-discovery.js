// Notice corridors are clues, never confirmed launches or flight telemetry.
import {createHash} from 'node:crypto';
import {MAJOR_SITES} from '../public/map/sites.js';
import {distanceKm} from '../public/map/model.js';
import {initialBearing,bearingArc,fetchWarnings} from './navigation-warnings.js';
export {isWarningLaunch,warningMatches,reconcileWarningEntries} from './warning-state.js';
const EXCLUDE=/NOTAMC|NOTAMR|CANCEL|RE-?ENTRY|RECOVERY|RETURN|LANDING|EXERCISE|TRAINING|FIRING|PARACHUT|演习|训练|回收|再入|取消|\bD\)/i;
function notice(row,now){
 const start=Date.parse(row.from_utc),end=Date.parse(row.to_utc),raw=row.raw||'';
 if(!row.notam_id||!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end-start>2*3600000||end<=now||start>now+30*86400000||EXCLUDE.test(raw))return null;
 if(!/TEMPORARY DANGER AREA|ROCKET|SPACE\s*(LAUNCH|FLIGHT)|火箭|航天/i.test(raw))return null;
 let points;try{points=JSON.parse(row.polygon);}catch{return null;}
 if(!Array.isArray(points)||points.length<3||!points.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=90&&Math.abs(p[1])<=180))return null;
 const center={latitude:points.reduce((s,p)=>s+p[0],0)/points.length,longitude:points.reduce((s,p)=>s+p[1],0)/points.length};
 if(points.some(p=>distanceKm(center,{latitude:p[0],longitude:p[1]})>150))return null;
 return {row,start,end,center,points};
}
export function discoverWarningLaunches(rows,{now=Date.now(),sites=MAJOR_SITES}={}){
 // Initially support Chinese short-window corridor notices; other sources need their own rules.
 const withdrawn=new Set(rows.filter(r=>/NOTAMC|NOTAMR/i.test(r.raw||'')).flatMap(r=>(r.raw.match(/[A-Z]\d{4}\/\d{2}/g)||[]).filter(id=>id!==r.notam_id)));
 const notices=[...new Map(rows.filter(r=>r.country==='CHINA'&&!withdrawn.has(r.notam_id)).map(r=>[r.notam_id,r])).values()].map(r=>notice(r,now)).filter(Boolean).sort((a,b)=>a.start-b.start);
 const proposals=[];
 for(let i=0;i<notices.length;i++)for(let j=i+1;j<notices.length;j++){
  const a=notices[i],b=notices[j];if(b.start-a.start>20*60000||a.end<b.start||distanceKm(a.center,b.center)<150)continue;
  const fits=[];
  for(const site of sites.filter(s=>s.region?.startsWith('中国'))){
   const da=distanceKm(site,a.center),db=distanceKm(site,b.center);
   if(da<150||da>1500||db>2500||db<da+150)continue;
   const ba=initialBearing(site,a.center),bb=initialBearing(site,b.center),arc=bearingArc([ba,bb]);
   if(arc.width>5)continue;
   fits.push({site,arc,score:arc.width});
  }
  fits.sort((a,b)=>a.score-b.score);
  if(!fits.length||(fits[1]&&fits[1].score-fits[0].score<2))continue; // ambiguous launch-site alignment
  proposals.push({...fits[0],notices:[a,b]});
 }
 // A notice cannot independently create multiple missions. Prefer the strongest pair.
 proposals.sort((a,b)=>a.score-b.score);const used=new Set(),out=[];
 for(const p of proposals){
  if(p.notices.some(n=>used.has(n.row.notam_id)))continue;
  p.notices.forEach(n=>used.add(n.row.notam_id));
  const start=Math.min(...p.notices.map(n=>n.start)),end=Math.max(...p.notices.map(n=>n.end));
  const ids=p.notices.map(n=>n.row.notam_id).sort();
  const id='notice-'+createHash('sha256').update(p.site.id+'|'+ids.join('|')).digest('hex').slice(0,20);
  const name=`${p.site.short}发射（待核实）`,net=new Date(start).toISOString();
  out.push({id,uid:id+'@launch-calendar.local',name,originalName:null,rocket:'火箭型号待核实',originalRocket:null,
   timing:{net,windowStart:net,windowEnd:new Date(end).toISOString(),precision:'航警时间窗 · 非点火时间',basis:'notice_window'},
   scheduleStatus:{code:'unverified',label:'待核实任务',upstream:'航警线索'},result:{code:'pending',label:'是否发射待核实',verified:false},
   lastUpdated:new Date(now).toISOString(),country:{code:'CN',name:'中国',basis:'inferred_site'},region:'中国',
   agency:{id:null,name:'发射机构待核实',originalName:null,ownership:'unknown',type:'Unknown'},crewed:null,
   livestream:{available:false,live:false,urls:[]},resources:[],image:null,
   pad:{name:null,location:p.site.name+'（航警推断）',originalLocation:p.site.name,timezone:p.site.timezone,latitude:p.site.latitude,longitude:p.site.longitude},
   mission:{name,type:'待核实发射',description:'多个短时危险区在时间与方向上吻合。任务、发射场和点火时刻仍待确认；显示时间为航警生效窗口。',orbit:null},
   provenance:{kind:'navigation_warning_candidate',label:'航警发现 · 待核实',confidence:'多区域几何线索，非发射公告',confidenceRank:0,siteId:p.site.id},
   warningDiscovery:{noticeIds:ids,headingEstimate:Math.round(p.arc.center*10)/10,headingBasis:'通告区域中心连线估算，非实际航向',notices:p.notices.map(n=>({id:n.row.notam_id,from:n.row.from_utc,to:n.row.to_utc,polygon:n.points,raw:n.row.raw}))},
   sources:[{name:'NOTAM公开聚合 · '+ids.join('、'),url:'https://rocket.rainywhisper.com/notams.csv',role:'reference'}]});
 }
 return out;
}
export async function fetchWarningDiscovery(){
 const data=await fetchWarnings();const source=data.sources.find(s=>s.source==='NOTAM');
 if(!source||source.error)throw Error(source?.error||'NOTAM feed unavailable');
 return {launches:discoverWarningLaunches(data.rows),source:source.url,noticeCount:source.count};
}
