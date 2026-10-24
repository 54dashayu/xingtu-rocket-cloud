import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { testProfile } from './fixtures/flight-profile.js';
import { flightProfile, validFlightData } from '../public/map/flight-path.js';
import { attachFlightProfile } from '../src/flight-profiles.js';
import { attachCloudEvidence } from '../src/cloud-evidence.js';
import { cloudStatus } from '../public/cloud-status.js';
import { pastLaunches, siteMarkerRadius, geometryRating } from '../public/map/model.js';
import { elevationAt, visibilitySamples, observerVisibility, visibilityFootprint } from '../public/map/visibility.js';
const now=Date.parse('2026-10-24T12:00:00Z');
const l={id:'fixture',timing:{net:'2026-10-23T10:15:00Z',precision:'精确到分钟'},coordinates:{latitude:38.86,longitude:111.58},direction:{kind:'unconfirmed',azimuth:90},scheduleStatus:{code:'confirmed'},result:{code:'success'}};
const withProfile={...l,flightProfile:testProfile(l)};
test('mission trajectory requires source, frame, exact mission/time match and ordered finite points',()=>{
 assert.ok(validFlightData(withProfile));
 for(const delta of [{launchId:'other'},{net:'2026-10-23T10:16:00Z'},{sourceUrl:'javascript:alert(1)'},{publishedAt:'unknown'},{kind:'assumed'},{frame:'ECI'}, {points:[]},{points:[{...withProfile.flightProfile.points[0],longitude:181},withProfile.flightProfile.points[1]]},{points:[withProfile.flightProfile.points[1],withProfile.flightProfile.points[0]]}])assert.equal(validFlightData({...l,flightProfile:{...withProfile.flightProfile,...delta}}),null);
 assert.equal(attachFlightProfile(l,[withProfile.flightProfile]).flightProfile.launchId,l.id);
 assert.equal(attachFlightProfile({...l,id:'other'},[withProfile.flightProfile]).flightProfile,undefined);
});
test('no task samples means no invented 120/1000 km curve, map footprint or stars',()=>{
 for(const target of [100,200]){const p=flightProfile(l,{target});assert.equal(p.range,null);assert.deepEqual(p.full,[]);assert.deepEqual(visibilitySamples(l,{target}),[]);assert.deepEqual(visibilityFootprint(l,{target}).cells,[]);assert.equal(geometryRating(l,{target}).stars,null);}
});
test('flight data interpolates first ascending height crossing and never extrapolates 200 km',()=>{
 const points=[{seconds:0,height:0,downrange:0,latitude:0,longitude:179},{seconds:100,height:80,downrange:100,latitude:1,longitude:179.5},{seconds:140,height:120,downrange:160,latitude:2,longitude:-179.5},{seconds:190,height:180,downrange:240,latitude:3,longitude:-178}];
 const task={...withProfile,flightProfile:{...withProfile.flightProfile,points}};
 const p=flightProfile(task,{target:100,elapsed:110});assert.equal(p.duration,120);assert.equal(p.range,130);assert.equal(p.full.at(-1).height,100);assert.ok(Math.abs(p.full.at(-1).longitude)===180);assert.equal(p.points.at(-1).height,90);assert.equal(p.elapsed,110);
 const q=flightProfile(task,{target:200});assert.equal(q.reached,false);assert.equal(q.full.at(-1).height,180);assert.equal(q.range,240);assert.equal(q.duration,190);
});
test('source geodetic samples preserve a dogleg rather than forcing one azimuth',()=>{
 const p=withProfile.flightProfile.points.map((p,i)=>({...p,latitude:38+i*.3,longitude:i<2?111:110}));const task={...withProfile,flightProfile:{...withProfile.flightProfile,points:p}};
 assert.deepEqual(flightProfile(task,{target:200}).full,p);
});
test('watching geometry uses local darkness, elevation, and per-point time, not only launch-site sunset',()=>{
 const sample={latitude:0,longitude:90,height:100,time:now,sun:{latitude:0,longitude:0},sunlit:true};
 assert.ok(elevationAt({latitude:0,longitude:90},sample)>89);
 assert.equal(observerVisibility([[sample]],{latitude:0,longitude:90}).possible,false); // ground still daylight boundary
 assert.equal(observerVisibility([[sample]],{latitude:0,longitude:92}).possible,true);
 assert.equal(observerVisibility([[{...sample,sunlit:false}]],{latitude:0,longitude:92}).possible,false);
 assert.equal(observerVisibility([[sample]],{latitude:0,longitude:120}).possible,false);
 const samples=visibilitySamples(withProfile,{target:100})[0];assert.equal(samples[0].time,Date.parse(l.timing.net)+90e3);
});
test('observation confirmation requires a completed matching flight and cited report',()=>{
 const records=JSON.parse(readFileSync(new URL('../data/rocket-cloud-evidence.json',import.meta.url))).records,record=records[0];const task={...l,id:record.launchId,timing:{...l.timing,net:record.net},rocketCloud:{code:'possible'}};
 const attached=attachCloudEvidence(task,records,now);assert.equal(cloudStatus(attached,now).code,'observed');assert.equal(attached.cloudEvidence.observation.locations.length,5);
 for(const bad of [{...task,id:'another'},{...task,timing:{...task.timing,net:'2026-10-23T10:16:00Z'}},{...task,result:{code:'pending'}}])assert.equal(attachCloudEvidence(bad,records,now).cloudEvidence,undefined);
 assert.equal(attachCloudEvidence(task,records,Date.parse(record.net)-1).cloudEvidence,undefined);
 assert.equal(cloudStatus(task,now).code,'retrospective');
 const future={...task,result:{code:'pending'},timing:{...task.timing,net:'2026-10-25T10:15:00Z'}};assert.equal(cloudStatus(future,now).code,'reminder');assert.notEqual(cloudStatus({...future,scheduleStatus:{code:'tbd'}},now).code,'reminder');
});
test('history uses completed past 30 days, excludes future and unconfirmed overdue plans',()=>{
 const at=days=>({...l,id:String(days),timing:{...l.timing,net:new Date(now-days*864e5).toISOString()}});
 assert.deepEqual(pastLaunches([at(31),at(30),at(-1),at(0),at(1),{...at(2),result:{code:'pending'}}],now).map(x=>x.id),['0','1','30']);
});
test('larger markers preserve area relation for ordinary mission counts',()=>{
 assert.equal(siteMarkerRadius(0),1.5);assert.equal(siteMarkerRadius(1),1.5*Math.sqrt(2.5));assert.ok(siteMarkerRadius(10)>siteMarkerRadius(4));assert.equal(siteMarkerRadius(100),6.6);
});
