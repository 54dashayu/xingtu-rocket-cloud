import test from 'node:test';
import assert from 'node:assert/strict';
import {morphologyAssessment,morphologySignature,ASSESSMENT_VERSION} from '../public/map/morphology.js';
import {assessCloud} from '../src/cloud-assessment.js';
import {areaLegend,AREA_COLORS} from '../public/map/area-colors.js';
const mission=rocket=>({id:'shape-test',rocket,timing:{net:'2026-12-01T10:00:00Z',precision:'精确到分钟'},scheduleStatus:{code:'confirmed'}});
test('only subsequent cold stages are candidates; no generic altitude or core-fuel shortcut',()=>{
 for(const [rocket,status,ids] of [
  ['Long March 2D','not_recommended',[]],['Long March 3B','candidate',['stage3']],
  ['Long March 5B','unknown',[]],['Long March 6','candidate',['stage2']],
  ['Long March 8','candidate',['stage2']],['Falcon 9 Block 5','candidate',['stage2']],
  ['Starship','candidate',['stage2']],['Ceres-1','unknown',[]],['Unknown','unknown',[]]
 ]){
  const r=morphologyAssessment({...mission(rocket),plumeStartHeight:72.6});
  assert.equal(r.status,status,rocket);assert.deepEqual(r.candidateComponentIds,ids,rocket);
  assert.equal(r.renderable,false);assert.equal(r.geometryMask,null);
 }
 assert.ok(!morphologyAssessment(mission('Starship')).components.some(c=>c.role==='strap_on'));
});
test('strap-on separation requires mission, configuration, type, components and dated source',()=>{
 const l=mission('Long March 2F');
 const evidence={launchId:l.id,net:l.timing.net,configurationId:'cz2f',sourceUrl:'https://example.org/mission',publishedAt:'2026-11-23T00:00:00Z',events:[{type:'strap_on_separation',componentIds:['booster'],seconds:140}]};
 assert.equal(morphologyAssessment({...l,propulsionEvents:evidence}).status,'candidate');
 for(const patch of [{net:'old'},{launchId:'other'},{configurationId:'cz5b'},{sourceUrl:'javascript:1'},{publishedAt:'?'},
 {events:[{type:'stage_separation',componentIds:['booster'],seconds:140}]},
 {events:[{type:'strap_on_separation',componentIds:['stage1'],seconds:140}]},
 {events:[{type:'strap_on_separation',componentIds:['booster'],seconds:-1}]}]){
  assert.equal(morphologyAssessment({...l,propulsionEvents:{...evidence,...patch}}).status,'unknown');
 }
});
test('same mission and time with new configuration or evidence changes cache signature',()=>{
 const l=mission('Long March 2D'),before=morphologySignature(l);
 assert.notEqual(before,morphologySignature({...l,rocket:'Long March 3B'}));
 assert.notEqual(before,morphologySignature({...l,propulsionTimeline:{revision:2}}));
 assert.equal(morphologyAssessment({...l,propulsionInfo:{summary:'上面级液氧煤油'}}).status,'not_recommended');
});
test('ordinary geometry legend makes no unconditional jellyfish claim',()=>{
 assert.ok(!('jellyfish' in AREA_COLORS));assert.doesNotMatch(areaLegend(),/水母|分离阶段/);
});
test('API contract is additive, keeps legacy geometry/index/weather fields and separates morphology',async()=>{
 const l=mission('Long March 3B');const r=await assessCloud(l,{weatherEnabled:false});
 assert.equal(r.assessmentVersion,ASSESSMENT_VERSION);assert.equal(r.launchId,l.id);
 assert.equal(r.morphology.status,'candidate');assert.equal(r.morphology.renderable,false);
 assert.ok(r.model);assert.ok(r.index);assert.equal(r.weather.status,'disabled');
});
test('observed cloud evidence is retained independently of model recommendation',()=>{
 const l={...mission('Long March 2D'),cloudEvidence:{observation:{status:'confirmed',source:{url:'https://example.org/photo'}}}};
 const before=JSON.stringify(l.cloudEvidence);morphologyAssessment(l);
 assert.equal(JSON.stringify(l.cloudEvidence),before);
 assert.equal(morphologyAssessment(l).status,'not_recommended');
});
