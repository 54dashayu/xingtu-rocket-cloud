import { heightPreset } from './height-presets.js?v=20261024am';
// Mission-specific geodetic samples. No default range, heading, or ballistic curve.
const wrap=x=>((x+180)%360+360)%360-180;
export function validFlightData(launch){
 const f=launch.flightProfile;
 if(!f||f.launchId!==launch.id||f.net!==launch.timing?.net||f.frame!=='WGS84-geodetic'||!['planned','measured','reconstructed'].includes(f.kind)||!Number.isFinite(Date.parse(f.publishedAt))||!/^https:\/\//.test(f.sourceUrl||''))return null;
 if(!Array.isArray(f.points)||f.points.length<2)return null;
 for(let i=0;i<f.points.length;i++){
  const p=f.points[i];
  if(!['seconds','height','downrange','latitude','longitude'].every(k=>Number.isFinite(p[k]))||p.seconds<0||p.height<0||p.downrange<0||Math.abs(p.latitude)>90||Math.abs(p.longitude)>180||(i&&p.seconds<=f.points[i-1].seconds))return null;
 }
 return f;
}
function mix(a,b,u){return {seconds:a.seconds+(b.seconds-a.seconds)*u,height:a.height+(b.height-a.height)*u,downrange:a.downrange+(b.downrange-a.downrange)*u,latitude:a.latitude+(b.latitude-a.latitude)*u,longitude:wrap(a.longitude+wrap(b.longitude-a.longitude)*u)};}
// Propulsion data must be tied to the same mission trajectory, with its own public source.
export function validPropulsionData(launch){
 const data=validFlightData(launch),p=data?.propulsion;
 if(!p||!/^https:\/\//.test(p.sourceUrl||'')||!Number.isFinite(Date.parse(p.publishedAt))||!Array.isArray(p.burns)||!p.burns.length)return null;
 const c=p.finalCutoff;
 if(!c||!Number.isFinite(c.seconds)||!Number.isFinite(c.height)||c.height<0)return null;
 for(let i=0;i<p.burns.length;i++){
  const b=p.burns[i];
  if(!Number.isFinite(b.start)||!Number.isFinite(b.end)||b.start<0||b.end<=b.start||(i&&b.start<p.burns[i-1].end))return null;
 }
 if(p.burns.at(-1).end!==c.seconds)return null;
 const a=data.points.findLast(q=>q.seconds<=c.seconds),b=data.points.find(q=>q.seconds>=c.seconds);
 if(!a||!b)return null;
 const point=a.seconds===b.seconds?{...a}:mix(a,b,(c.seconds-a.seconds)/(b.seconds-a.seconds));
 if(Math.abs(point.height-c.height)>1)return null; // Allow rounded published km, not conflicting telemetry.
 return {...p,point};
}
export function flightProfile(launch,{target=100,elapsed=Infinity,preferFinalCutoff=false}={}){
 heightPreset(target);
 const data=validFlightData(launch),propulsion=validPropulsionData(launch);
 const cutoff=preferFinalCutoff&&data?.kind!=='planned'?propulsion?.point:null;
 const empty={full:[],points:[],duration:0,range:null,target,kind:'unavailable',reason:'缺少与本次任务匹配的时间、高度及地面位置资料'};
 if(!data)return empty;
 let full=[],reached=false;
 if(cutoff){full=data.points.filter(p=>p.seconds<cutoff.seconds).map(p=>({...p}));full.push({...cutoff});reached=true;target=cutoff.height;}
 else for(let i=0;i<data.points.length;i++){
  const p=data.points[i],a=data.points[i-1];
  if(a&&a.height<target&&p.height>=target){full.push(mix(a,p,(target-a.height)/(p.height-a.height)));reached=true;break;}
  if(!i&&p.height>=target)return {...empty,reason:'资料起点已超过目标高度，无法回推此前航迹'};
  full.push({...p});
 }
 // Include burn boundaries and intermediate samples so coast/restart gaps remain explicit.
 if(propulsion){
  const first=full[0].seconds,last=full.at(-1).seconds,times=new Set(full.map(p=>p.seconds));
  for(const burn of propulsion.burns)for(const t of [burn.start,burn.end])if(t>=first&&t<=last)times.add(t);
  for(let t=first;t<last;t+=Math.max(2,(last-first)/600))times.add(t);
  const original=full;
  full=[...times].sort((a,b)=>a-b).map(t=>{
   const a=original.findLast(p=>p.seconds<=t),b=original.find(p=>p.seconds>=t);
   const point=a.seconds===b.seconds?{...a}:mix(a,b,(t-a.seconds)/(b.seconds-a.seconds));
   return {...point,emitting:propulsion.burns.some(b=>t>=b.start&&t<b.end)};
  });
 }
 const end=full.at(-1),t=Math.min(end.seconds,Math.max(full[0].seconds,elapsed)),points=full.filter(p=>p.seconds<=t);
 const b=full.find(p=>p.seconds>t),a=points.at(-1);if(b&&a&&a.seconds<t)points.push({...mix(a,b,(t-a.seconds)/(b.seconds-a.seconds)),...(propulsion?{emitting:propulsion.burns.some(b=>t>=b.start&&t<b.end)}:{})});
 return {full,points,duration:end.seconds,elapsed:t,range:Math.max(...full.map(p=>p.downrange)),target,reached,kind:data.kind,source:data,label:{planned:'公布的计划轨迹',measured:'任务飞行记录',reconstructed:'任务数据重建轨迹'}[data.kind],...(propulsion?{propulsion}:{}),...(cutoff?{endpointKind:'published-final-cutoff'}:{})};
}
