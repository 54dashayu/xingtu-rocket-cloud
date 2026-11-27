import {propulsionInfo,PROPULSION_VERSION} from './propulsion.js?v=0.03-0035';

// Recommendation policy, not a plume-shape simulation or a physical exclusion rule.
export const MORPHOLOGY_VERSION='morphology-0035-1';
export const ASSESSMENT_VERSION='geometry-0032:'+PROPULSION_VERSION+':'+MORPHOLOGY_VERSION;
const cold=new Set(['kerolox','hydrolox','methalox']);
const https=url=>{try{return new URL(url).protocol==='https:';}catch{return false;}};

export function morphologyAssessment(launch={}){
 const p=propulsionInfo(launch);
 const components=[...p.stages.map((c,i)=>({...c,role:i===0?'core':'upper'})),...p.boosters.map(c=>({...c,role:'strap_on'}))];
 const upper=components.filter(c=>c.role==='upper'&&cold.has(c.fuel));
 const evidence=launch.propulsionEvents;
 const matched=p.known&&evidence?.launchId===launch.id&&evidence?.net===launch.timing?.net&&
  evidence?.configurationId===p.configuration&&https(evidence?.sourceUrl)&&Number.isFinite(Date.parse(evidence?.publishedAt));
 const events=matched&&Array.isArray(evidence.events)?evidence.events.filter(e=>e.type==='strap_on_separation'&&
  Number.isFinite(e.seconds)&&e.seconds>=0&&Array.isArray(e.componentIds)&&e.componentIds.length>0&&
  e.componentIds.every(id=>p.boosters.some(c=>c.id===id))):[];
 const unknown=!p.known||!p.fuelComplete||p.boostersKnown===false||Boolean(p.boosters.length&&!events.length);
 const status=upper.length||events.length?'candidate':unknown?'unknown':'not_recommended';
 const label=upper.length?'水母形态：上面级低温构型候选':events.length?'水母形态：有来源的助推器分离线索':status==='unknown'?'水母形态：资料待核实':'水母形态：当前构型不主动推荐';
 return {schemaVersion:1,version:MORPHOLOGY_VERSION,launchId:launch.id||null,net:launch.timing?.net||null,
  configurationId:p.configuration||null,status,label,basis:events.length?(upper.length?'model_and_mission':'mission_event'):'model_reference',coverage:unknown?'partial':'model_configuration',
  candidateComponentIds:upper.map(c=>c.id),eventCandidateIds:events.flatMap(e=>e.componentIds),
  components:components.map(({id,role,fuel,count})=>({id,role,fuel,...(count?{count}:{} )})),
  sourceRefs:p.sources,configurationScope:p.configurationScope||null,
  separationEvidence:events.length?{sourceUrl:evidence.sourceUrl,publishedAt:evidence.publishedAt,events}:null,
  // This release deliberately has no component-resolved plume geometry engine.
  renderable:false,geometryMask:null,
  limits:'构型与分离线索不保证水母形态；缺少任务级喷气时序和组件位置资料，不绘制专属区域。普通火箭云几何分析不受此形态提示限制。'};
}

export function morphologySignature(launch){
 return JSON.stringify([ASSESSMENT_VERSION,morphologyAssessment(launch),launch.propulsionTimeline||null,launch.flightProfile||null]);
}
