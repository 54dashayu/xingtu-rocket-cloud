import { simulationLaunch } from '../public/map/manual-time.js';
export function assessmentScenario(launch,{time=null,azimuth=null,historical=false}={}){
 if(time===null&&azimuth===null)return {launch,options:{}};
 if(historical)throw new RangeError('历史任务不接受手动参数');
 if(time!==null&&(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(time)||!Number.isFinite(Date.parse(time))))throw new RangeError('模拟时间无效');
 const bearing=azimuth===null?undefined:Number(azimuth);
 if(azimuth!==null&&(!String(azimuth).trim()||!Number.isFinite(bearing)||bearing<0||bearing>=360))throw new RangeError('模拟航向无效');
 const result=time===null?{...launch,manualScenario:true}: {...simulationLaunch(launch,time),manualScenario:true};
 return {launch:result,options:{azimuth:bearing}};
}
