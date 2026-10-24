import { heightPreset } from './height-presets.js?v=20261024am';
import { headingEstimate } from './heading-estimate.js?v=20261024ad';
import { flightProfile } from './flight-path.js?v=20261024ay';
import { ascentToHeight, interpolateState, stageSchedule, engineState } from './ascent-dynamics.js?v=20261024am';
import { destination } from './model.js?v=20261024al';
export function simulationProfile(launch,{target=100,elapsed=Infinity,azimuth=headingEstimate(launch).azimuth,rangeFactor=1,historical=false}={}){
 heightPreset(target);
 const sourced=flightProfile(launch,{target,elapsed,preferFinalCutoff:historical});
 if(sourced.full.length||!launch.coordinates)return sourced;
 if(historical){
  const direction=headingEstimate(launch);
  if(!['sourced_heading','reported_sector'].includes(direction.kind))return {...sourced,reason:'历史任务航向待核实，不使用任务类型猜测实际方向'};
  azimuth=direction.azimuth;
 }
 if(!Number.isFinite(azimuth)||azimuth<0||azimuth>=360||!Number.isFinite(rangeFactor)||rangeFactor<=0||rangeFactor>10)throw new RangeError('Invalid prediction parameters');
 const solution=ascentToHeight(launch.coordinates,azimuth,target);
 if(!solution.reached)return {...sourced,reason:'参考动力学未到达所选高度，不延伸轨迹'};
 // Non-unit scaling is an offline sensitivity scenario, not a physics integration result.
 const full=solution.full.map(p=>({...p,emitting:engineState(p.seconds).thrust>0})).map(p=>rangeFactor===1?{...p}:{...p,...destination(launch.coordinates,azimuth,p.downrange*rangeFactor),downrange:p.downrange*rangeFactor});
 // The reference vehicle's first stage separation supplies a display onset only.
 // It is not a recovered vehicle-specific separation altitude or cloud morphology threshold.
 const separation=solution.raw.find(p=>p.seconds>=stageSchedule().separation);
 const plumeStartHeight=separation?.height??null;
 const duration=solution.duration,t=Math.min(duration,Math.max(0,elapsed)),points=full.filter(p=>p.seconds<=t);
 if(points.at(-1)?.seconds!==t){const b=full.find(p=>p.seconds>t),a=points.at(-1);if(a&&b)points.push({...interpolateState(a,b,t),emitting:engineState(t).thrust>0});}
 return {full,points,duration,elapsed:t,range:full.at(-1).downrange,target,reached:true,kind:'predicted',label:'上升段动力学模拟',azimuth,source:null,method:'reference-ecef-rk4',parameters:'generic-two-stage',plumeStartHeight,rangeScaled:rangeFactor!==1};
}
