import {simulationLaunch} from './manual-time.js';
// Reuse the canonical 150 km window assessment; never turn a window into an official ignition time.
export function noticeScenario(launch,assessment){
 const w=assessment?.noticeWindow,t=Date.parse(w?.referenceTime),start=Date.parse(launch.timing?.windowStart),end=Date.parse(launch.timing?.windowEnd);
 const heading=(launch.warningDiscovery||launch.warningReference)?.headingEstimate;
 if(launch.timing?.basis!=='notice_window'||assessment?.launchId!==launch.id||assessment.net!==launch.timing.net||!assessment.model?.reliability?.assessment?.eligible||['cancelled','postponed'].includes(launch.scheduleStatus?.code)||!Number.isFinite(t)||t<start||t>end||!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end-start>7200000||!Number.isFinite(heading)||heading<0||heading>=360||w.heading!==heading||Date.parse(w.start)!==start||Date.parse(w.end)!==end)return null;
 const scenario=simulationLaunch(launch,w.referenceTime);
 return {...scenario,noticeScenario:{...w},timing:{...scenario.timing,precision:'航警参考时刻 · 精确到秒'},scheduleStatus:{code:'estimated',label:'航警预估'}};
}
const pending=new Map();
export async function loadNoticeScenario(launch,base='./api/'){
 if(launch.timing?.basis!=='notice_window')return null;
 const url=`${base}launches/${encodeURIComponent(launch.id)}/cloud-assessment?target=150&weather=off&range=upcoming&net=${encodeURIComponent(launch.timing.net)}`;
 let entry=pending.get(url);
 if(!entry||Date.now()-entry.at>300000){entry={at:Date.now(),promise:fetch(url,{signal:AbortSignal.timeout(45000)}).then(async r=>{if(!r.ok)throw Error('航警参考时刻暂未取得，请重试');return r.json();})};pending.set(url,entry);entry.promise.catch(()=>pending.delete(url));}
 return noticeScenario(launch,await entry.promise);
}
