import test from 'node:test';
import assert from 'node:assert/strict';
import { simulationProfile } from '../public/map/prediction.js';
import { flightProfile } from '../public/map/flight-path.js';
import { testProfile } from './fixtures/flight-profile.js';
import { distanceKm } from '../public/map/model.js';
import { visibilitySamples } from '../public/map/visibility.js';
const l={id:'test',coordinates:{latitude:38.8,longitude:111.5},direction:{kind:'reported_sector',azimuth:225},timing:{net:'2026-10-23T10:15:00Z',precision:'精确到分钟'}};
test('fallback is explicitly predicted, continuous across 100/200 km and stops at the chosen height',()=>{
 const a=simulationProfile(l,{target:100}),b=simulationProfile(l,{target:200});
 assert.equal(a.kind,'predicted');assert.equal(a.source,null);assert.equal(a.full.at(-1).height,100);assert.equal(b.full.at(-1).height,200);
 assert.deepEqual(a.full,b.full.filter(p=>p.seconds<=a.duration));assert.ok(a.range>0&&b.range>a.range);assert.equal(a.method,'reference-ecef-rk4');
 assert.equal(simulationProfile(l,{elapsed:-5}).elapsed,0);assert.equal(simulationProfile(l,{elapsed:9999}).elapsed,a.duration);
});
test('adjusting heading and range changes actual map positions; sourced trajectory has priority',()=>{
 const a=simulationProfile(l,{azimuth:90,rangeFactor:2}),b=simulationProfile(l,{azimuth:270});
 assert.ok(a.full.at(-1).longitude>l.coordinates.longitude);assert.ok(b.full.at(-1).longitude<l.coordinates.longitude);
 assert.ok(Math.abs(distanceKm(l.coordinates,a.full.at(-1))-2*simulationProfile(l,{azimuth:90}).range)<1e-6);
 const task={...l,flightProfile:testProfile(l)};assert.deepEqual(simulationProfile(task,{azimuth:90,rangeFactor:2}),flightProfile(task));
 for(const params of [{azimuth:360},{rangeFactor:0},{rangeFactor:NaN}])assert.throws(()=>simulationProfile(l,params));
});
test('prediction viewing samples use explicitly supplied prediction and do not masquerade as recorded data',()=>{
 const profile=simulationProfile(l);assert.equal(visibilitySamples(l).length,0);assert.ok(visibilitySamples(l,{profile})[0].length>0);
});
test('all height presets share a continuous scenario and recorded data never extrapolates to higher presets',()=>{
 let previous=null;
 for(const target of [100,150,200]){
  const p=simulationProfile(l,{target});assert.equal(p.full.at(-1).height,target);assert.equal(p.points.at(-1).seconds,p.duration);
  if(previous)assert.deepEqual(previous.full,p.full.filter(v=>v.seconds<=previous.duration));
  for(const v of p.full)assert.ok(Number.isFinite(v.longitude)&&Number.isFinite(v.latitude)&&v.height<=target);
  previous=p;
 }
 const record=testProfile(l);record.points=record.points.filter(p=>p.height<200);
 const sourced=simulationProfile({...l,flightProfile:record},{target:200});
 assert.notEqual(sourced.kind,'predicted');assert.equal(sourced.reached,false);assert.ok(sourced.full.at(-1).height<200);
 assert.throws(()=>simulationProfile(l,{target:300}),/Unsupported/);
});
test('historical heading is fixed to task evidence; unknown headings cannot become reconstructed history',()=>{
 const fixed=simulationProfile(l,{historical:true,azimuth:90,target:150});
 assert.equal(fixed.azimuth,225);assert.equal(fixed.kind,'predicted');assert.equal(fixed.full.at(-1).height,150);
 const unknown={...l,siteId:'vandenberg',mission:{orbit:'Low Earth Orbit'},direction:{kind:'unconfirmed',azimuth:90}};
 assert.equal(simulationProfile(unknown,{historical:true}).full.length,0);
 assert.equal(simulationProfile(unknown).azimuth,180);
 const sourced={...unknown,flightProfile:testProfile(unknown)};
 assert.equal(simulationProfile(sourced,{historical:true}).kind,'planned');
});
test('user-report candidate unlocks a reference scenario, never overrides sourced flight data',()=>{
 const unknown={...l,direction:{kind:'unconfirmed'},observationReportCount:1};
 const p=simulationProfile(unknown,{historical:true,azimuth:120});
 assert.equal(p.kind,'predicted');assert.equal(p.azimuth,120);assert.equal(p.source,null);assert.ok(p.full.length>0);
 assert.equal(simulationProfile({...unknown,observationReportCount:0},{historical:true}).full.length,0);
 const sourced={...unknown,flightProfile:testProfile(unknown)};assert.equal(simulationProfile(sourced,{historical:true}).kind,'planned');
});
