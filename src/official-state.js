// Conservative overlays applied again after each LL2 merge, shared by both services.
import {identity} from './official-announcements.js';
const ms=x=>Date.parse(x)||0;
const isOfficial=l=>l.provenance?.kind==='official_announcement';
const isNotice=l=>l.provenance?.kind==='navigation_warning_candidate';
const missionKeys=l=>[l.mission?.name,l.mission?.originalName,l.name?.split(/[|｜]/).at(-1),l.originalName?.split(/[|｜]/).at(-1)].filter(Boolean).map(identity);
function sameSite(l,r){const s=`${l.pad?.location||''} ${l.pad?.originalLocation||''}`;return s.includes(r.site.key)||({酒泉:/jiuquan/i,太原:/taiyuan/i,西昌:/xichang/i,文昌:/wenchang|hainan/i})[r.site.key]?.test(s);}
function dateNear(l,r){return !ms(l.timing?.net)||Math.abs(ms(l.timing.net)-ms(r.time))<7*86400000;}
function freshLaunch(r){const id=`official-${r.key}`;return {id,uid:`${id}@launch-calendar.local`,lastUpdated:r.publishedAt,
 country:{code:'CN',name:'中国',basis:'official_announcement'},region:'中国',agency:{id:null,name:'中国航天科技集团',originalName:'China Aerospace Science and Technology Corporation',ownership:'state',type:'Government'},
 rocket:r.rocket,originalRocket:r.rocket,crewed:r.crewed,livestream:{available:false,live:false,urls:[]},resources:[],mission:{name:r.mission,originalName:r.mission,type:null,description:null,orbit:null},
 pad:{name:null,location:r.site.name,originalLocation:r.site.name,timezone:'Asia/Shanghai',latitude:r.site.latitude,longitude:r.site.longitude,coordinateBasis:'场区代表点'},
 sources:[],image:null,provenance:{kind:'official_announcement'},timing:{},result:{code:'pending',label:'结果待更新',verified:false}};}
function overlay(l,r){
 const oldTime=ms(l.timing?.net),newTime=ms(r.time);
 // A minute-level statement corroborates, but does not erase upstream seconds in that minute.
 const keepSeconds=r.precision==='精确到分钟'&&/秒/.test(l.timing?.precision||'')&&Math.floor(oldTime/60000)===Math.floor(newTime/60000);
 const source={name:r.sourceName,url:r.url,role:'official'};
 const fields={name:r.mission,time:r.time,result:r.result,site:r.site.name};
 const sources=[...(l.sources||[]).filter(s=>s.url!==r.url),source];
 return {...l,name:`${l.rocket&&l.rocket!=='未知火箭'?l.rocket:r.rocket}｜${r.mission}`,rocket:l.rocket&&l.rocket!=='未知火箭'?l.rocket:r.rocket,
 mission:{...l.mission,name:r.mission},crewed:l.crewed??r.crewed,
 timing:{...l.timing,net:keepSeconds||oldTime===newTime?l.timing.net:r.time,windowStart:keepSeconds||oldTime===newTime?l.timing.net:r.time,windowEnd:keepSeconds||oldTime===newTime?l.timing.net:r.time,precision:keepSeconds?l.timing.precision:r.precision,basis:r.actual?'official_actual':'official_planned'},
 scheduleStatus:{code:'confirmed',label:'已确认',upstream:r.sourceName},
 result:r.result==='pending'?(l.result||{code:'pending',label:'结果待更新',verified:false}):{code:r.result,label:r.result==='success'?'发射成功':'发射失败',verified:true,upstream:r.sourceName},
 sources,officialVerification:{sourceId:r.sourceId,sourceName:r.sourceName,url:r.url,publishedAt:r.publishedAt,checkedAt:r.checkedAt,fields,retainedUpstreamSeconds:keepSeconds},dataPending:false};
}
export function reconcileOfficialEntries(entries,records,now=Date.now()){
 let rows=structuredClone(entries);const conflicts=[];let matched=0,added=0;
 const groups=new Map();for(const r of records||[]){if(ms(r.time)<now-370*86400000||ms(r.time)>now+45*86400000)continue;const list=groups.get(r.key)||[];list.push(r);groups.set(r.key,list);}
 for(const list of groups.values()){
  list.sort((a,b)=>Number(b.actual)-Number(a.actual)||ms(b.publishedAt)-ms(a.publishedAt));const r=list[0];
  const incompatible=list.some(x=>x.actual&&r.actual&&(Math.abs(ms(x.time)-ms(r.time))>=60000||x.result!==r.result));
  if(incompatible){conflicts.push({key:r.key,url:r.url,reason:'官方实际时间或结果相互冲突'});continue;}
  const allNamed=rows.filter(e=>!isNotice(e.launch)&&missionKeys(e.launch).includes(identity(r.mission)));
  const named=allNamed.filter(e=>dateNear(e.launch,r));
  if(!named.length&&allNamed.length){conflicts.push({key:r.key,url:r.url,reason:'同名任务日期相距过大，需核对改期或任务身份'});continue;}
  let matches=named.filter(e=>sameSite(e.launch,r));
  // Upstream may later supply an ID for an officially discovered mission. Prefer the stable LL2 ID.
  if(matches.some(e=>!isOfficial(e.launch))){rows=rows.filter(e=>!matches.includes(e)||!isOfficial(e.launch));matches=matches.filter(e=>!isOfficial(e.launch));}
  if(matches.length>1||(!matches.length&&named.length)){conflicts.push({key:r.key,url:r.url,reason:'任务关联不唯一或场址冲突'});continue;}
  if(!matches.length){
   // A placeholder on the same pad/date is not enough to establish an identity. Avoid duplicate insertion.
   const ambiguous=rows.some(e=>!isNotice(e.launch)&&sameSite(e.launch,r)&&Math.abs(ms(e.launch.timing?.net)-ms(r.time))<2*3600000);
   if(ambiguous){conflicts.push({key:r.key,url:r.url,reason:'同场同时存在其他名称任务，需核对关联'});continue;}
   const launch=overlay(freshLaunch(r),r);rows.push({range:r.actual?'history':'upcoming',launch});added++;
  }else{
   const e=matches[0];
   if(!r.actual&&(e.range==='history'||ms(e.launch.lastUpdated)>ms(r.publishedAt))){continue;}
   e.launch=overlay(e.launch,r);e.range=r.actual?'history':e.range;matched++;
  }
 }
 return {entries:rows,summary:{matched,added,conflicts}};
}
