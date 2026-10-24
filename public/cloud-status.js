// A broad discovery filter, separate from the detailed geometry assessment.
// The 90-minute margin is a product shortlist setting, not a visibility threshold.
export function cloudOpportunity(launch){
 const status=launch.scheduleStatus?.code;
 if(['cancelled','postponed'].includes(status))return 'none';
 const precise=Number.isFinite(Date.parse(launch.timing?.net))&&/分钟|秒|小时|minute|second|hour/i.test(launch.timing?.precision||'');
 if(!precise||['tbd','approximate'].includes(status))return 'pending';
 const forecast=launch.rocketCloud;
 if(['favorable','possible'].includes(forecast?.code))return 'possible';
 const minutes=forecast?.localSun?.nearest?.minutes;
 return typeof minutes==='number'&&Number.isFinite(minutes)&&Math.abs(minutes)<=90?'possible':'none';
}

// Observation evidence and geometry reminders are distinct, shared by both UIs.
export function cloudStatus(launch,now=Date.now()){
 const ms=Date.parse(launch.timing?.net),past=Number.isFinite(ms)&&ms<=now;
 const observation=launch.cloudEvidence?.observation;
 if(past&&['success','failure','partial'].includes(launch.result?.code)&&observation?.status==='confirmed'&&observation.sources?.some(s=>/^https:\/\//.test(s.url||'')))return {code:'observed',label:'已证实火箭云',description:'有公开观测报道；点击查看证据',sources:observation.sources};
 const assessment=launch.cloudAssessment;
 if(assessment?.net===launch.timing?.net){
  const m=assessment.model;
  if(m?.code==='possible')return {code:past?'retrospective':'reminder',label:'模型符合 · '+(assessment.weather?.status==='available'?(assessment.weather.counts.clearer?'部分点天气较好':assessment.weather.counts.mixed?'天气一般':'遮挡较高'):'天气待更新'),description:assessment.conclusion,sources:[]};
  if(m?.code==='no_geometry')return {code:'none',label:'本段几何条件不足',description:assessment.conclusion,sources:[]};
 }
 const candidate=cloudOpportunity(launch)==='possible';
 if(past&&candidate)return {code:'retrospective',label:'可能出现火箭云',description:'符合宽松晨昏初筛',sources:[]};
 if(!past&&Number.isFinite(ms)&&candidate&&!['cancelled','postponed','tbd','approximate'].includes(launch.scheduleStatus?.code))return {code:'reminder',label:'可能出现火箭云',description:'符合宽松晨昏初筛，点击查看轨迹与观测条件',sources:[]};
 return {code:'none',label:past?'暂无火箭云证据':'无晨昏提醒',description:past?'未收录观测证据，不代表没有发生':'',sources:[]};
}
