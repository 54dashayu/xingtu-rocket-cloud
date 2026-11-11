import {stageSchedule,interpolateState} from '../map/ascent-dynamics.js?v=0.03-0031';
export function eventPoint(profile,seconds){if(!Number.isFinite(seconds))return null;const a=profile.full.findLast(p=>p.seconds<=seconds),b=profile.full.find(p=>p.seconds>=seconds);return a&&b?(a.seconds===b.seconds?{...a}:interpolateState(a,b,seconds)):null;}
// Explicit teaching heuristics, not vehicle-specific statistical predictions.
// Fairing: first 100 km crossing; payload: 60 s after assumed final cutoff.
export function flightEvents(profile){
 const schedule=stageSchedule(),cross=profile.full.findIndex(p=>p.height>=100);let fairing=null;
 if(cross>=0){const b=profile.full[cross],a=profile.full[cross-1];fairing=a&&a.height<100?a.seconds+(b.seconds-a.seconds)*(100-a.height)/(b.height-a.height):b.seconds;}
 const definitions=[
  {id:'liftoff',name:'起飞',seconds:0,symbol:'●',color:0xffffff,reason:'相对时间起点'},
  {id:'stage1',name:'一级分离',seconds:schedule.separation,symbol:'◆',color:0xff9a70,reason:'通用双级参考模型：一级燃料耗尽时关机与分离合并；非本型号实测时序'},
  {id:'stage2',name:'二级点火',seconds:schedule.ignition,symbol:'▲',color:0x8eeaf3,reason:'通用模型：一级分离后4秒点火；非本型号实测时序'},
  {id:'fairing',name:'抛整流罩',seconds:fairing,symbol:'◇',color:0x93e5ac,reason:'教学假设：轨迹首次达到100 km时抛罩；并非各型号通用标准'},
  {id:'cutoff',name:'末次关机',seconds:schedule.cutoff,symbol:'■',color:0xd3b4ff,reason:'通用双级参考模型的二级燃料耗尽时刻；不代表实际入轨时刻'},
  {id:'payload',name:'载荷分离',seconds:schedule.cutoff+60,symbol:'○',color:0xf1b5d0,reason:'教学假设：参考末次关机后60秒分离；实际任务可能滑行更久或多次点火'}
 ];
 return definitions.map((e,index)=>({...e,index:index+1,point:eventPoint(profile,e.seconds),origin:'estimate',status:e.seconds===null?'条件不足':eventPoint(profile,e.seconds)?'示意估计':'示意估计 · 段外'}));
}
