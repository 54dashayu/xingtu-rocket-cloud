import test from 'node:test';
import assert from 'node:assert/strict';
import {readReportSummary,withReportCount} from '../public/map/report-summary.js';
import {prepareMission,missionScenario} from '../prototypes/rocket-cloud-3d/missions.js';
const raw={id:'historical-report',name:'历史任务',pad:{latitude:38.8,longitude:111.5},timing:{net:'2026-10-23T10:15:00Z',precision:'精确到分钟'},result:{code:'success'},scheduleStatus:{code:'confirmed'}};
test('shared summary -> prepared historical task -> actual reference profile',async()=>{
 const result=await readReportSummary({fetcher:async(url,options)=>{
  assert.equal(url,'/xingtu-analytics/report-summary');assert.equal(options.cache,'no-store');assert.ok(options.signal);
  return {ok:true,json:async()=>({counts:{[raw.id]:1}})};
 }});
 const scenario=missionScenario(prepareMission(withReportCount(raw,result.counts)));
 assert.ok(scenario.profile.full.length>1);assert.equal(scenario.profile.kind,'predicted');assert.equal(scenario.sourced,false);assert.equal(scenario.mode.confirmed,false);
});
test('unavailable, malformed, failed or empty summary never unlocks historical replay',async()=>{
 const cases=[async()=>{throw Error('offline')},async()=>({ok:false}),async()=>({ok:true,json:async()=>{throw Error('bad JSON')}}),async()=>({ok:true,json:async()=>({counts:[]})}),async()=>({ok:true,json:async()=>({counts:{}})})];
 for(const fetcher of cases){const r=await readReportSummary({fetcher});assert.throws(()=>missionScenario(prepareMission(withReportCount({...raw,observationReportCount:5},r.counts))),/航向待核实/);}
 for(const value of [true,'1',-1,0,NaN,Infinity,0.5])assert.equal(withReportCount(raw,{[raw.id]:value}).observationReportCount,0);
});
test('a user report does not bypass missing coordinates or imprecise time',()=>{
 const launch=withReportCount(raw,{[raw.id]:1});
 assert.throws(()=>missionScenario(prepareMission({...launch,pad:{}})),/坐标/);
 assert.throws(()=>missionScenario(prepareMission({...launch,timing:{...launch.timing,precision:'日期待定'}})),/时刻待定/);
});
test('summary request aborts on timeout without inventing a report',async()=>{
 const r=await readReportSummary({timeoutMs:10,fetcher:async(_,options)=>new Promise((resolve,reject)=>{
  const keepAlive=setTimeout(()=>resolve({ok:false}),200);
  options.signal.addEventListener('abort',()=>{clearTimeout(keepAlive);reject(options.signal.reason)},{once:true});
 })});assert.equal(r.available,false);assert.deepEqual(r.counts,{});
});
