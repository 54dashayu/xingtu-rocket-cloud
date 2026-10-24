import { testProfile } from './fixtures/flight-profile.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { solarPosition, solarAltitude } from '../public/map/solar.js';
import { launchCoordinates, rocketCloudForecast } from '../src/rocket-cloud.js';
import { rocketCloudForecast as clientForecast } from '../public/map/rocket-cloud.js';
import { mapLaunch, countdown, upcoming, groupSites, horizonKm, destination, distanceKm, isSunlit, preciseTime, scenarioGeometry, splitLine } from '../public/map/model.js';
import { readFileSync } from 'node:fs';
const DEMO_LAUNCHES=JSON.parse(readFileSync(new URL('./fixtures/map-launches.json',import.meta.url),'utf8'));
const launch=mapLaunch(DEMO_LAUNCHES[0]);
test('missing/empty/out-of-range coordinates never become a false Gulf of Guinea pad',()=>{
 for(const pad of [{},{latitude:null,longitude:null},{latitude:'',longitude:''},{latitude:100,longitude:12},{latitude:45,longitude:181}])assert.equal(launchCoordinates(pad),null);
 assert.equal(launchCoordinates({location:'文昌',latitude:null,longitude:null}).latitude,19.61);
 assert.equal(launchCoordinates({latitude:0,longitude:0}).latitude,0);
});
test('solar declination and equation of time have physical seasonal reference values',()=>{
 const june=solarPosition('2026-06-21T12:00:00Z'),dec=solarPosition('2026-12-21T12:00:00Z');
 assert.ok(Math.abs(june.latitude-23.44)<.15);assert.ok(Math.abs(dec.latitude+23.44)<.15);
 const nov=solarPosition('2026-11-03T12:00:00Z');assert.ok(nov.equationMinutes>15&&nov.equationMinutes<18);
 assert.ok(Math.abs(solarAltitude('2026-06-21T12:00:00Z',june.latitude,june.longitude)-90)<1e-5);
 assert.ok(solarAltitude('2026-06-21T00:00:00Z',89,0)>0);assert.ok(solarAltitude('2026-12-21T12:00:00Z',89,0)<0);
 assert.throws(()=>solarPosition('bad'),RangeError);
});
test('API and browser use the identical rocket cloud calculation',()=>assert.deepEqual(rocketCloudForecast(launch),clientForecast(launch)));
test('sphere horizon, Earth shadow, distance and dateline are bounded',()=>{
 assert.equal(horizonKm(0),0);assert.ok(horizonKm(100)>1100&&horizonKm(100)<1150);assert.throws(()=>horizonKm(-1));
 const a={latitude:0,longitude:179},b=destination(a,90,500);assert.ok(b.longitude<0);assert.ok(Math.abs(distanceKm(a,b)-500)<1e-6);
 assert.equal(isSunlit({latitude:0,longitude:0},{latitude:0,longitude:95},100),true);
 assert.equal(isSunlit({latitude:0,longitude:0},{latitude:0,longitude:110},100),false);
 assert.equal(splitLine([{longitude:170,latitude:0},{longitude:179,latitude:0},{longitude:-179,latitude:0},{longitude:-170,latitude:0}]).length,2);
});
test('coarse or unstable timing suppresses countdown and observation sectors',()=>{
 for(const overrides of [{timing:{...launch.timing,precision:'仅确定日期'}},{scheduleStatus:{code:'cancelled'}},{scheduleStatus:{code:'postponed'}},{timing:{net:null}}]){
 const l={...launch,...overrides};assert.equal(preciseTime(l),false);assert.match(countdown(l),/不倒计时/);assert.equal(scenarioGeometry(l,launch.timing.net).cells.length,0);
 }
 assert.match(countdown(launch,Date.parse(launch.timing.net)+1),/计划时刻已过/);
});
test('candidate cells must be dark and within horizon of a sunlit hypothetical point',()=>{
 const g=scenarioGeometry(launch,launch.timing.net);
 assert.ok(g.cells.length>0);
 for(const cell of g.cells){assert.ok(solarAltitude(launch.timing.net,cell.latitude,cell.longitude)<=-1);assert.ok(g.points.some(p=>p.sunlit&&distanceKm(cell,p)<g.radius));}
 const earlier=scenarioGeometry(launch,Date.parse(launch.timing.net)-7200000);
 assert.notEqual(earlier.sun.longitude,g.sun.longitude);
 assert.deepEqual(earlier.points.map(({sunlit,...p})=>p),g.points.map(({sunlit,...p})=>p));
});
test('missing coordinates and data stay explicit; API metadata cannot invent an official trajectory',()=>{
 const l=mapLaunch({...DEMO_LAUNCHES[0],pad:{location:'unknown'},trajectory:{official:true}});
 assert.equal(l.coordinates,null);assert.equal(l.direction.kind,'unconfirmed');assert.equal(l.direction.officialTrajectory,null);assert.equal(l.weather.status,'not_connected');
 assert.equal(scenarioGeometry(l,launch.timing.net).points.length,0);
});
test('upcoming view excludes old cache entries and groups shared launch sites',()=>{
 const now=Date.parse(launch.timing.net);
 const entries=DEMO_LAUNCHES.map(mapLaunch);
 assert.equal(upcoming(entries,now+1000).length,4);
 assert.equal(upcoming(entries,now,0).length,1);
 assert.equal(groupSites([entries[0],{...entries[0],id:'second'}])[0].launches.length,2);
});

import { sunEvents, localSunContext, padTimezone } from '../public/map/sun-events.js';
test('local sunrise and sunset use site civil date and standard apparent horizon',()=>{
 const c={latitude:19.61,longitude:110.95},s=sunEvents('2026-10-24T10:00:00Z',c,'Asia/Shanghai');
 assert.equal(s.date,'2026-10-24');assert.ok(s.sunrise);assert.ok(s.sunset);
 for(const e of [s.sunrise,s.sunset])assert.ok(Math.abs(solarAltitude(e,c.latitude,c.longitude)+.833)<.001);
 const context=localSunContext('2026-10-24T10:00:00Z',c,{location:'文昌'});
 assert.equal(context.nearest.kind,'sunset');assert.ok(context.nearest.minutes<0);assert.ok(context.nearest.minutes>-20);
 assert.equal(padTimezone({location:'unknown'}).source,'当地时区缺失，暂以 UTC 标注');
});
test('site date crosses UTC midnight correctly and polar day/night do not invent sunsets',()=>{
 const c={latitude:34.73,longitude:-120.57};
 assert.equal(sunEvents('2026-10-24T01:00:00Z',c,'America/Los_Angeles').date,'2026-10-23');
 assert.equal(sunEvents('2026-10-24T20:00:00Z',{latitude:19.61,longitude:110.95},'Asia/Shanghai').date,'2026-10-25');
 assert.equal(sunEvents('2026-06-21T12:00:00Z',{latitude:89,longitude:0},'UTC').polar,'polar_day');
 assert.equal(sunEvents('2026-12-21T12:00:00Z',{latitude:89,longitude:0},'UTC').polar,'polar_night');
});

import { MAJOR_SITES } from '../public/map/sites.js';
import { timePair, launchTimePair } from '../public/map/time-display.js';
import { siteInventory, cloudCandidate } from '../public/map/model.js';
test('major spaceports remain present without launches, independent of task filtering',()=>{
 const inventory=siteInventory([]);assert.ok(inventory.sites.length>=20);assert.equal(inventory.unknown.length,0);
 for(const s of inventory.sites){assert.equal(s.launches.length,0);assert.ok(Math.abs(s.latitude)<=90);assert.ok(Math.abs(s.longitude)<=180);assert.doesNotThrow(()=>new Intl.DateTimeFormat('en',{timeZone:s.timezone}));}
 assert.equal(new Set(MAJOR_SITES.map(s=>s.id)).size,MAJOR_SITES.length);
});
test('different pads at a named site aggregate all missions; unknown sites are never dropped',()=>{
 const a=mapLaunch({...DEMO_LAUNCHES[0],id:'pad-a',pad:{location:'文昌',latitude:19.61,longitude:110.95}});
 const b=mapLaunch({...DEMO_LAUNCHES[0],id:'pad-b',pad:{location:'Wenchang',latitude:19.59,longitude:110.93}});
 const unknown=mapLaunch({...DEMO_LAUNCHES[0],id:'unknown',pad:{location:'unknown'}});
 const sea=mapLaunch({...DEMO_LAUNCHES[0],id:'sea',pad:{location:'Sea Launch',latitude:32,longitude:122}});
 const inv=siteInventory([a,b,unknown,sea]);
 assert.deepEqual(inv.sites.find(s=>s.id==='wenchang').launches.map(l=>l.id),['pad-a','pad-b']);
 assert.equal(inv.unknown[0].id,'unknown');assert.ok(inv.sites.some(s=>s.launches.some(l=>l.id==='sea')));
 assert.equal(inv.sites.flatMap(s=>s.launches).length+inv.unknown.length,4);
});
test('parallel local and Beijing dates handle midnight, daylight saving and missing zones',()=>{
 const p=timePair('2026-10-24T01:00:00Z',{timezone:'America/Los_Angeles'});assert.equal(p.local,'10/23 18:00');assert.equal(p.beijing,'10/24 09:00');
 assert.equal(timePair('2026-12-24T01:00:00Z',{timezone:'America/Los_Angeles'}).local,'12/23 17:00');
 const missing=timePair('2026-10-24T01:00:00Z',{location:'unknown'});assert.equal(missing.known,false);assert.equal(missing.local,'时区待补充');
 const coarse=launchTimePair({...launch,timing:{net:'2026-10-24T00:00:00Z',precision:'仅确定日期'},scheduleStatus:{code:'tbd'}});assert.ok(!coarse.local.includes(':'));assert.ok(!coarse.beijing.includes(':'));
 assert.equal(launchTimePair({...launch,timing:{net:null,precision:'仅确定月份'}}).beijing,'待定');
});
test('future list keeps an open window or date-only plan without inventing an exact time',()=>{
 const now=Date.parse('2026-10-24T12:00:00Z');
 const precise={...launch,id:'passed',timing:{net:'2026-10-24T10:00:00Z',precision:'精确到分钟'}};
 const window={...precise,id:'window',timing:{...precise.timing,windowEnd:'2026-10-24T14:00:00Z'}};
 const date={...precise,id:'day',timing:{net:'2026-10-24T00:00:00Z',precision:'仅确定日期'}};
 const done={...window,id:'done',result:{code:'success'}};
 assert.deepEqual(upcoming([precise,window,date,done],now).map(l=>l.id),['day','window']);
});

import { geometryRating } from '../public/map/model.js';
test('Beijing-zone clocks collapse while genuinely different zones remain parallel',()=>{
 assert.equal(timePair('2026-10-24T01:00:00Z',{location:'文昌'}).sameBeijing,true);
 assert.equal(timePair('2026-10-24T01:00:00Z',{timezone:'Asia/Singapore'}).sameBeijing,true);
 assert.equal(timePair('2026-10-24T01:00:00Z',{timezone:'America/Los_Angeles'}).sameBeijing,false);
 assert.equal(timePair(null,{timezone:'Asia/Shanghai'}).sameBeijing,true);
});
test('recommendation is ordinal geometry only; missing inputs never receive fabricated stars',()=>{
 const missing=geometryRating({...launch,timing:{net:null}});assert.equal(missing.stars,null);assert.equal(missing.weather,'未评估');
 const night=mapLaunch({...DEMO_LAUNCHES[0],timing:{net:'2026-10-24T16:00:00Z',precision:'精确到分钟'}});
 const day=mapLaunch({...DEMO_LAUNCHES[0],timing:{net:'2026-10-24T04:00:00Z',precision:'精确到分钟'}});
 const twilight=mapLaunch({...DEMO_LAUNCHES[0],timing:{net:'2026-10-24T10:20:00Z',precision:'精确到分钟'}});
 for(const task of [night,day,twilight])task.flightProfile=testProfile(task);
 assert.equal(geometryRating(night).stars,1);assert.equal(geometryRating(day).stars,1);
 const r=geometryRating(twilight);assert.ok(r.stars>geometryRating(day).stars);assert.ok(r.stars<=5);assert.equal(r.trajectory,'估算');assert.match(r.basis,/不代表可见概率/);assert.ok(r.sunlit<=r.samples);
});

import { directionScenario, siteMarkerRadius } from '../public/map/model.js';
test('direction needs a mission-matched dated source, never orbit-class alone',()=>{
 const base={...DEMO_LAUNCHES[0],mission:{orbit:'Sun-synchronous'}};
 assert.equal(directionScenario(base).kind,'unconfirmed');
 const evidence={launchId:base.id,net:base.timing.net,azimuth:135,sourceUrl:'https://example.test/mission',publishedAt:'2026-10-20T00:00:00Z'};
 assert.equal(directionScenario({...base,trajectory:evidence}).azimuth,135);
 for(const invalid of [{launchId:'another'},{net:'2027-01-01T00:00:00Z'},{azimuth:null},{azimuth:360},{sourceUrl:'javascript:void(0)'},{publishedAt:null}])assert.equal(directionScenario({...base,trajectory:{...evidence,...invalid}}).kind,'unconfirmed');
 assert.equal(geometryRating(launch).stars,null);
 assert.equal(geometryRating({...launch,direction:{...launch.direction,kind:'sourced_heading'}},{manual:true}).stars,null);
});
test('east and west trajectories differ in position and sunlight, not just arrow rotation',()=>{
 const origin={latitude:0,longitude:100},sun={latitude:0,longitude:0};
 const east=destination(origin,90,1000),west=destination(origin,270,1000);
 assert.equal(isSunlit(sun,east,100),false);assert.equal(isSunlit(sun,west,100),true);
});
test('dateline route reaches both seam edges without a gap or trans-world chord',()=>{
 const segs=splitLine([{longitude:179,latitude:1},{longitude:-179,latitude:3}]);
 assert.deepEqual(segs,[[{longitude:179,latitude:1},{longitude:180,latitude:2}],[{longitude:-180,latitude:2},{longitude:-179,latitude:3}]]);
});
test('site symbols grow with mission volume and remain bounded',()=>{
 assert.ok(siteMarkerRadius(0)<siteMarkerRadius(1));assert.ok(siteMarkerRadius(1)<siteMarkerRadius(4));assert.ok(siteMarkerRadius(100)<=6.6);
});
