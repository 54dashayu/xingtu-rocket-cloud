import {flightEvents,eventPoint} from './events.js';
import {mapLaunch,preciseTime} from '../../public/map/model.js';
import {simulationProfile} from '../../public/map/prediction.js';
import {headingEstimate} from '../../public/map/heading-estimate.js';
import {cloudStatus} from '../../public/cloud-status.js';
import {attachArchiveEvidence} from '../../public/map/archive-evidence.js';
import {localizeLaunch} from '../../public/launch-localization.js';
export function prepareMission(raw,records=[]){return mapLaunch(localizeLaunch(attachArchiveEvidence(raw,records)));}
export function missionMode(l,now=Date.now()){
 const historical=Date.parse(l.timing?.net)<=now;
 return {historical,confirmed:cloudStatus(l,now).code==='observed',candidate:!historical&&cloudStatus(l,now).code==='reminder'};
}
export function missionScenario(l){
 if(!l.coordinates)throw Error('该任务缺少发射场坐标，暂不能绘制。');
 if(!preciseTime(l))throw Error('该任务发射时刻待定或计划已变更，暂不能生成任务预测；可切换手动实验。');
 const mode=missionMode(l),heading=headingEstimate(l);
 const profile=simulationProfile(l,{target:150,azimuth:heading.azimuth,historical:mode.historical});
 if(!profile.full.length)throw Error(profile.reason||'该任务轨迹资料不足。');
 const sourced=profile.kind!=='predicted';
 return {launch:l,profile,end:profile.duration+300,heading,mode,sourced};
}
export function missionEvents(s){
 const list=flightEvents(s.profile).filter(e=>e.id!=='liftoff');
 const p=s.profile.propulsion;
 if(p){const e=list.find(e=>e.id==='cutoff'),point=eventPoint(s.profile,p.finalCutoff.seconds);Object.assign(e,{seconds:p.finalCutoff.seconds,point,origin:'source',status:point?'任务资料':'任务资料 · 段外',reason:'采用与该任务匹配的推进资料末次关机时刻'});
 const payload=list.find(e=>e.id==='payload');payload.seconds=p.finalCutoff.seconds+60;payload.point=eventPoint(s.profile,payload.seconds);payload.reason='教学假设：已知末次关机后60秒分离；不是任务公布时序';payload.status=payload.point?'示意估计':'示意估计 · 段外';}
 return list;
}
export const beijingInput=net=>new Date(Date.parse(net)+8*3600000).toISOString().slice(0,19);
