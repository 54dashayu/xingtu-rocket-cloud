import test from 'node:test';
import assert from 'node:assert/strict';
import {simulationProfile} from '../public/map/prediction.js';
import {poweredFlight,stageSchedule} from '../public/map/ascent-dynamics.js';
import {visibilitySamples,visibilityFootprint} from '../public/map/visibility.js';
import {playbackWindow} from '../public/map/timeline.js';
import {createScenario,frame,footprint} from '../prototypes/rocket-cloud-3d/geometry.js';
import {testProfile} from './fixtures/flight-profile.js';
const launch={id:'extended',coordinates:{latitude:38.85,longitude:111.61},timing:{net:'2026-11-18T22:47:30Z'},direction:{kind:'reported_sector',azimuth:188.8}};
test('default flight follows propulsion beyond 150km; independent cutoff convergence',()=>{
 const p=simulationProfile(launch),short=simulationProfile(launch,{target:150});
 assert.equal(p.endpointKind,'reference-final-cutoff');assert.equal(p.duration,stageSchedule().cutoff);
 assert.ok(p.duration>short.duration&&p.range>short.range*3);
 assert.ok(p.full.some(p=>p.height>150));assert.equal(p.full.at(-1).emitting,false);
 const fine=poweredFlight(launch.coordinates,188.8,{step:.25});
 assert.ok(Math.abs(p.range-fine.range)<.1);assert.ok(Math.abs(p.target-fine.full.at(-1).height)<.1);
 const coast=p.full.filter(p=>p.seconds>=stageSchedule().separation&&p.seconds<stageSchedule().ignition);
 assert.ok(coast.length>0&&coast.every(p=>p.emitting===false));
});
test('current footprint uses only live emitted parcels and expires after cutoff',()=>{
 const profile=simulationProfile(launch),end=playbackWindow(profile).end;
 const parcels=visibilitySamples(launch,{profile,atSeconds:400,persistenceSeconds:300,untilSeconds:end}).flat();
 assert.ok(parcels.some(p=>p.height>150));assert.ok(parcels.every(p=>p.seconds<=400&&p.age<=300));
 assert.ok(visibilityFootprint(launch,{profile,atSeconds:400,persistenceSeconds:300,minElevation:1}).cells.length>0);
 assert.equal(visibilitySamples(launch,{profile,atSeconds:end+.01,persistenceSeconds:300}).flat().length,0);
});
test('published coast and restart above 150km govern plume generation and retain after final cutoff',()=>{
 const flightProfile={...testProfile(launch),kind:'measured',propulsion:{sourceUrl:'https://example.test/events',publishedAt:'2026-11-12T00:00:00Z',burns:[{start:0,end:90},{start:180,end:360}],finalCutoff:{seconds:360,height:200}}};
 const l={...launch,flightProfile},p=simulationProfile(l,{historical:true});
 assert.equal(p.duration,360);assert.equal(p.endpointKind,'published-final-cutoff');assert.equal(playbackWindow(p).end,660);
 const samples=visibilitySamples(l,{profile:p,atSeconds:400,persistenceSeconds:300}).flat();
 assert.ok(samples.some(p=>p.height>150));assert.ok(samples.every(p=>p.seconds>=180&&p.seconds<360));
 const noEngine=simulationProfile({...l,flightProfile:{...flightProfile,propulsion:null}},{historical:true});
 assert.equal(noEngine.duration,flightProfile.points.at(-1).seconds);assert.equal(noEngine.endpointKind,'data-end');
});
test('2D and 3D use identical dynamics, timeline and instantaneous footprint',()=>{
 const s=createScenario({latitude:38.85,longitude:111.61},launch.timing.net,188.8);
 const p=simulationProfile(s.launch,{azimuth:188.8});
 assert.deepEqual(s.profile.full,p.full);assert.equal(s.end,playbackWindow(p).end);
 const options={profile:p,persistenceSeconds:300,atSeconds:400,untilSeconds:s.end,minElevation:1,coreElevation:5};
 assert.deepEqual(frame(s,400).parcels,visibilitySamples(s.launch,options).flat());
 assert.deepEqual(footprint(s,400).cells,visibilityFootprint(s.launch,options).cells);
});
