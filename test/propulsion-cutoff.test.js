import test from 'node:test';
import assert from 'node:assert/strict';
import {simulationProfile} from '../public/map/prediction.js';
import {validPropulsionData} from '../public/map/flight-path.js';
import {visibilitySamples} from '../public/map/visibility.js';
import {testProfile} from './fixtures/flight-profile.js';
const launch={id:'cutoff-test',coordinates:{latitude:38.85,longitude:111.58},timing:{net:'2026-10-23T10:15:00Z'},direction:{kind:'reported_sector',azimuth:225}};
const data={...testProfile(launch),kind:'measured',propulsion:{sourceUrl:'https://example.test/engine-events',publishedAt:'2026-10-24T00:00:00Z',burns:[{start:0,end:90},{start:180,end:360}],finalCutoff:{seconds:360,height:200}}};
const task={...launch,flightProfile:data};
test('completed trajectory ends at sourced final cutoff instead of arbitrary 150km',()=>{
 const p=simulationProfile(task,{historical:true,target:150});
 assert.equal(p.duration,360);assert.equal(p.target,200);assert.equal(p.endpointKind,'published-final-cutoff');
 assert.equal(p.full.at(-1).emitting,false);
 assert.equal(p.full.find(p=>p.seconds===90).emitting,false);
 assert.equal(p.full.find(p=>p.seconds===180).emitting,true);
 assert.equal(simulationProfile(task,{target:150}).target,150);
 const plan={...task,flightProfile:{...data,kind:'planned'}};
 assert.equal(simulationProfile(plan,{historical:true,target:150}).endpointKind,undefined);
});
test('incomplete conflicting or unreferenced cutoff cannot override the recorded flight',()=>{
 for(const delta of [{sourceUrl:''},{publishedAt:'?'},{burns:[{start:0,end:90},{start:80,end:360}]},{finalCutoff:{seconds:360,height:600}},{burns:[{start:0,end:400}],finalCutoff:{seconds:400,height:220}},{finalCutoff:{seconds:350,height:194}}]){
  const bad={...task,flightProfile:{...data,propulsion:{...data.propulsion,...delta}}};
  assert.equal(validPropulsionData(bad),null);
  assert.equal(simulationProfile(bad,{historical:true,target:150}).target,150);
 }
});
test('coasting emits no new plume, retained exhaust remains and restart resumes emission',()=>{
 const p=simulationProfile(task,{historical:true,target:150});
 const coast=visibilitySamples(task,{profile:p,atSeconds:120,persistenceSeconds:300})[0];
 assert.ok(coast.length>0);assert.ok(coast.every(p=>p.seconds<90));
 const restart=visibilitySamples(task,{profile:p,atSeconds:190,persistenceSeconds:300})[0];
 assert.ok(restart.some(p=>p.seconds>=180));assert.ok(restart.every(p=>p.seconds<90||p.seconds>=180));
 const after=visibilitySamples(task,{profile:p,atSeconds:400,persistenceSeconds:300})[0];
 assert.ok(after.length>0);assert.ok(after.every(p=>p.seconds<360));
});
test('reference model coast is flagged but never described as this launch cutoff',()=>{
 const p=simulationProfile(launch,{historical:true,target:150,elapsed:145});
 assert.equal(p.endpointKind,undefined);assert.equal(p.points.at(-1).emitting,false);
 const samples=visibilitySamples(launch,{profile:p,atSeconds:146,persistenceSeconds:300})[0];
 assert.ok(samples.length>0);assert.ok(samples.every(p=>p.seconds<143.014));
});
