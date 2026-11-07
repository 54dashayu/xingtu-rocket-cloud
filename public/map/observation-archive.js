import { loadArchiveRecords } from './archive-evidence.js?v=0.02';
import { cloudStatus } from '../cloud-status.js?v=20261024ba';
import { appendArchiveMedia } from './archive-media.js?v=0.03-0018';
export function archivePeriod(time, now = Date.now()) {
  const age = now - Date.parse(time);
  return !Number.isFinite(age) || age < 0 ? 'future' : age <= 365 * 86400000 ? 'year' : 'older';
}
export function archiveTasks(launches, records) {
  const items=new Map();
  for(const record of records){
    if(record.evidence?.status!=='confirmed'||!record.evidence.sources?.some(s=>s.url?.startsWith('https://'))||archivePeriod(record.time)==='future')continue;
    items.set(record.launchId||record.id,{id:record.launchId,name:record.name,time:record.time,place:record.reportedRegions?.join('、')||'未公开',confirmed:true,reports:0,sources:record.evidence.sources});
  }
  for(const launch of launches){
    const confirmed=cloudStatus(launch).code==='observed',reports=launch.observationReportCount||0;
    const time=launch.timing?.net||launch.net;
    if((!confirmed&&!reports)||archivePeriod(time)==='future')continue;
    const old=items.get(launch.id);
    items.set(launch.id,{...old,id:launch.id,name:launch.name,time,place:old?.place||'未公开',site:launch.pad?.location,confirmed:confirmed||old?.confirmed||false,reports,sources:old?.sources||launch.cloudEvidence?.observation?.sources||[]});
  }
  return [...items.values()].sort((a,b)=>Date.parse(b.time)-Date.parse(a.time));
}
export async function mountObservationArchive(container,{onReplay,loadTasks=async()=>[]}={}) {
 const node=(tag,text,cls)=>{const el=document.createElement(tag);el.textContent=text;if(cls)el.className=cls;return el;};
 container.className='observation-archive';
 container.replaceChildren(node('h2','火箭云任务档案'));
 const status=node('p','正在读取…','archive-intro'),refresh=node('button','刷新档案'),list=node('div','');refresh.type='button';container.append(status,refresh,list);
 async function load(){
  refresh.disabled=true;status.textContent='正在读取…';
  try{
   const [records,tasks]=await Promise.allSettled([loadArchiveRecords(),loadTasks()]);
   if(records.status==='rejected'&&tasks.status==='rejected')throw Error();
   const items=archiveTasks(tasks.status==='fulfilled'?tasks.value:[],records.status==='fulfilled'?records.value:[]);
   list.replaceChildren();
   status.textContent=`${items.length} 项 · 媒体证实或有用户报告`+(tasks.status==='rejected'?' · 用户报告任务暂未加载，请重试':'');
   for(const item of items){
    const card=node('article','','archive-source-card');
    card.append(node('h3',item.name),node('p',`${item.confirmed?'媒体证实':''}${item.confirmed&&item.reports?' · ':''}${item.reports?'有用户报告 '+item.reports+' 条（含待核对关联）':''}`,'archive-evidence-label'));
    card.append(node('p',new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(item.time))+' 北京时间','archive-source-time'));
    if(item.site)card.append(node('p','发射地点：'+item.site));
    card.append(node('p','观测地点：'+item.place));
    appendArchiveMedia(card,item);
    if(item.sources.length){const details=node('details','');details.append(node('summary','查看报道来源'));for(const source of item.sources){let url;try{url=new URL(source.url);}catch{continue;}if(url.protocol!=='https:')continue;const link=node('a',source.title||'报道');link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';details.append(link);}card.append(details);}
    if(item.id&&archivePeriod(item.time)==='year'){
     const actions=node('div','','archive-actions');
     if(onReplay){const replay=node('button','回放模拟','archive-replay');replay.type='button';replay.onclick=async()=>{replay.disabled=true;try{await onReplay(item.id);}finally{replay.disabled=false;}};actions.append(replay);}
     const link=node('a','火箭云3D模型','mission-3d');link.href='./3d/index.html?launch='+encodeURIComponent(item.id)+'&range=history';actions.append(link);card.append(actions);
    }
    list.append(card);
   }
   if(!items.length)list.append(node('p','暂无已收录任务。'));
  }catch{status.textContent='档案暂时无法读取，请稍后刷新。';}
  finally{refresh.disabled=false;}
 }
 refresh.onclick=load;void load();
}
