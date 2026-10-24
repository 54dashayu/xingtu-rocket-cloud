// Independently implemented CSV adapter. External notices are reference data, not telemetry.
import { distanceKm } from '../public/map/model.js';
const FEEDS=[['NOTAM','https://rocket.rainywhisper.com/notams.csv'],['MSI','https://rocket.rainywhisper.com/msi.csv']];
let saved=null,pending=null;
export function parseWarningCSV(text){
 const rows=[];let row=[],field='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}else if(!quoted&&(c===','||c==='\n')){row.push(field.replace(/\r$/,''));field='';if(c==='\n'){rows.push(row);row=[];}}else field+=c;}
 if(quoted)throw Error('Unterminated CSV');if(field||row.length){row.push(field.replace(/\r$/,''));rows.push(row);}
 const keys=(rows.shift()||[]).map(s=>s.replace(/^\uFEFF/,''));if(!keys.includes('from_utc')||!keys.includes('polygon'))throw Error('Unsupported warning feed');
 return rows.filter(r=>r.length===keys.length).map(r=>Object.fromEntries(keys.map((k,i)=>[k,r[i]])));
}
const deg=r=>r*180/Math.PI,rad=d=>d*Math.PI/180;
export function initialBearing(a,b){const p=rad(a.latitude),q=rad(b.latitude),d=rad(b.longitude-a.longitude);return (deg(Math.atan2(Math.sin(d)*Math.cos(q),Math.cos(p)*Math.sin(q)-Math.sin(p)*Math.cos(q)*Math.cos(d)))+360)%360;}
export function bearingArc(values){
 if(!values.length)return null;const a=[...values].sort((a,b)=>a-b);let gap=-1,index=0;
 for(let i=0;i<a.length;i++){const g=(i===a.length-1?a[0]+360:a[i+1])-a[i];if(g>gap){gap=g;index=i;}}
 const start=a[(index+1)%a.length],width=360-gap;return {start,end:(start+width)%360,width,center:(start+width/2)%360};
}
function polygonPoints(text){let value;try{value=JSON.parse(text);}catch{return [];}
 const out=[];function walk(v){if(!Array.isArray(v))return;if(v.length===2&&v.every(Number.isFinite)){if(Math.abs(v[0])<=90&&Math.abs(v[1])<=180)out.push({latitude:v[0],longitude:v[1]});}else v.forEach(walk);}walk(value);return out;
}
export function warningCandidates(launch,rows){
 const t=Date.parse(launch.timing?.net),origin=launch.coordinates;if(!Number.isFinite(t)||!origin)return [];
 const out=[];
 for(const row of rows){
  const start=Date.parse(row.from_utc),end=Date.parse(row.to_utc),raw=row.raw||'';
  // Broad validity ranges, daily schedules, cancellation and recovery zones cannot
  // establish a launch corridor. Reject rather than silently treating them as active.
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end-start>12*3600000||t<start||t>end)continue;
  if(!/ROCKET|SPACE\s*(?:LAUNCH|FLIGHT)|AEROSPACE|火箭|航天/i.test(raw)||/NOTAMC|CANCELLED|CANCELED|RECOVERY|REENTRY|RE-ENTRY|RETURN TO|LANDING ZONE|回收|再入/i.test(raw)||/\bD\)\s*\S/.test(raw))continue;
  const points=polygonPoints(row.polygon);if(points.length<3)continue;
  const distances=points.map(p=>distanceKm(origin,p));if(Math.min(...distances)<80||Math.max(...distances)>2500)continue;
  const arc=bearingArc(points.map(p=>initialBearing(origin,p)));if(!arc||arc.width>45)continue;
  const known=launch.direction;if(['sourced_heading','reported_sector'].includes(known?.kind)&&Number.isFinite(known.azimuth)){const delta=Math.abs(((arc.center-known.azimuth+540)%360)-180);if(delta>45)continue;}
  out.push({id:row.notam_id||row.id,source:row.source||'NOTAM/MSI',sourceUrl:row.sourceUrl||'',from:row.from_utc,to:row.to_utc,...arc,points,minimumDistanceKm:Math.round(Math.min(...distances)),maximumDistanceKm:Math.round(Math.max(...distances)),kind:/DEBRIS|FALL|落区/i.test(raw)?'落区方向参考':'通告区域方向参考',match:'时段与场址几何匹配，尚未确认任务对应关系',summary:raw.slice(0,220)});
 }
 return out.sort((a,b)=>a.minimumDistanceKm-b.minimumDistanceKm).filter((v,i,a)=>a.findIndex(x=>x.id===v.id)===i).slice(0,5);
}
export async function fetchWarnings({fetcher=fetch,now=Date.now()}={}){
 if(saved&&now-saved.fetched<1800000)return saved.value;if(pending)return pending;
 pending=(async()=>{const batches=await Promise.all(FEEDS.map(async([source,url])=>{try{const r=await fetcher(url,{signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error(`HTTP ${r.status}`);const text=await r.text();if(text.length>5000000)throw Error('Feed too large');return {source,url,rows:parseWarningCSV(text).map(v=>({...v,source,sourceUrl:url}))};}catch(e){return {source,url,rows:[],error:e.message};}}));const value={fetchedAt:new Date(now).toISOString(),provider:'notam-whisper 公共通告聚合（非官方接口）',sources:batches.map(({rows,...b})=>({...b,count:rows.length})),rows:batches.flatMap(b=>b.rows)};saved={fetched:now,value};return value;})().finally(()=>{pending=null;});return pending;
}
