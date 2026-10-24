import test from 'node:test';
import assert from 'node:assert/strict';
import {weatherRoute,weatherVerdict,weatherAt} from '../src/weather.js';
import {assessCloud,sampleCells} from '../src/cloud-assessment.js';
const now=Date.parse('2026-10-24T12:00:00Z');
test('weather routing separates archive, recent estimates, forecast, horizon',()=>{
 assert.equal(weatherRoute('2026-10-10T10:00Z',now).kind,'reanalysis');
 assert.equal(weatherRoute('2026-10-23T10:00Z',now).kind,'recent_model');
 assert.equal(weatherRoute('2026-10-25T10:00Z',now).kind,'forecast');
 assert.equal(weatherRoute('2026-11-09T00:00Z',now).status,'outside_horizon');
});
test('missing cloud is never clear, rain and visibility obstruct',()=>{
 assert.equal(weatherVerdict({cloud_cover:null,precipitation:0}).code,'missing');
 assert.equal(weatherVerdict({cloud_cover:10,precipitation:2}).code,'obstructed');
 assert.equal(weatherVerdict({cloud_cover:10,precipitation:0,visibility:1000}).code,'obstructed');
 assert.equal(weatherVerdict({cloud_cover:10,precipitation:0,visibility:15000}).code,'clearer');
});
test('weather binds each coordinate to UTC hour and preserves null',async()=>{
 const points=[{latitude:30,longitude:110},{latitude:31,longitude:111}];
 const result=await weatherAt(points,'2026-10-11T10:15Z',{now,fetcher:async url=>{
  assert.equal(url.searchParams.get('latitude'),'30,31');assert.equal(url.searchParams.get('timezone'),'UTC');
  return {ok:true,json:async()=>points.map((p,i)=>({...p,hourly:{time:[Date.parse('2026-10-11T10:00Z')/1000],cloud_cover:[i?null:20],precipitation:[0]}}))};
 }});
 assert.equal(result.points[0].code,'clearer');assert.equal(result.points[1].code,'missing');
 assert.equal(result.points[0].time,'2026-10-11T10:00:00.000Z');
});
test('horizon and absent time never request invented weather',async()=>{
 for(const time of ['2026-12-01T10:00Z',null]){
  let calls=0;const result=await weatherAt([{latitude:30,longitude:110}],time,{now,fetcher:()=>{calls++;}});
  assert.equal(calls,0);assert.equal(result.points.length,0);
 }
});
test('failed weather stays unknown and retryable',async()=>{
 const result=await weatherAt([{latitude:20,longitude:100}],'2026-10-25T10:00Z',{now,fetcher:async()=>({ok:false,status:429})});
 assert.equal(result.status,'unavailable');assert.deepEqual(result.points,[]);
});
test('evidence does not create a geometric or weather result',async()=>{
 const launch={id:'test',timing:{net:'2026-10-23T10:15:00Z',precision:'秒'},scheduleStatus:{code:'net'},result:{code:'success'},pad:{latitude:38,longitude:111},cloudEvidence:{observation:{status:'confirmed'}}};
 let calls=0;const result=await assessCloud(launch,{now,weatherProvider:()=>{calls++;}});
 assert.equal(result.model.code,'preliminary');assert.equal(result.weather.status,'not_requested');assert.equal(calls,0);
 assert.equal('cloudEvidence' in result,false);
});
test('spatial sampling is bounded and distinct',()=>{
 const cells=Array.from({length:100},(_,i)=>({latitude:20+i%10,longitude:100+Math.floor(i/10)}));
 const sample=sampleCells(cells);assert.equal(sample.length,9);assert.equal(new Set(sample.map(p=>`${p.latitude},${p.longitude}`)).size,9);
});
test('forecast source returns weather for future coordinates',async()=>{
 let urlUsed;const result=await weatherAt([{latitude:28,longitude:-80}],'2026-10-28T10:00Z',{now,fetcher:async url=>{urlUsed=url;return {ok:true,json:async()=>({hourly:{time:[Date.parse('2026-10-28T10:00Z')/1000],cloud_cover:[25],precipitation:[0],visibility:[20000]}})};}});
 assert.equal(urlUsed.hostname,'api.open-meteo.com');assert.equal(result.kind,'forecast');assert.equal(result.points[0].code,'clearer');
});
test('time outside returned hourly coverage is missing',async()=>{
 const r=await weatherAt([{latitude:1,longitude:2}],'2026-10-12T10:00Z',{now,fetcher:async()=>({ok:true,json:async()=>({hourly:{time:[Date.parse('2026-10-12T06:00Z')/1000],cloud_cover:[0],precipitation:[0]}})})});
 assert.equal(r.points[0].code,'missing');assert.equal(r.points[0].time,null);
});
test('manual scenario changes only evaluation time, not published task',async()=>{
 const {assessmentScenario}=await import('../src/assessment-scenario.js');
 const raw={id:'manual',timing:{net:null,precision:'仅确定日期'},scheduleStatus:{code:'tbd'},result:{code:'pending'},pad:{latitude:28,longitude:-80,timezone:'America/New_York'},cloudEvidence:{observation:{status:'confirmed'}}};
 const {launch,options}=assessmentScenario(raw,{time:'2026-10-28T11:00:00.000Z',azimuth:'90'});
 assert.equal(raw.timing.net,null);assert.equal(launch.timing.net,'2026-10-28T11:00:00.000Z');assert.equal(launch.cloudEvidence,null);assert.equal(options.azimuth,90);
 const {modelAssessment}=await import('../src/cloud-assessment.js');
 const model=modelAssessment(launch,{...options,now});
 assert.notEqual(model.code,'pending');assert.notEqual(model.code,'preliminary');
 assert.throws(()=>assessmentScenario(raw,{time:'bad'}),/无效/);
 assert.throws(()=>assessmentScenario(raw,{time:'2026-10-28T11:00:00Z',historical:true}),/历史/);
});
