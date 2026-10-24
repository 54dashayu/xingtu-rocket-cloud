import test from 'node:test';
import assert from 'node:assert/strict';
import {visibilitySamples,visibilityFootprint,observerVisibility,jellyfishReferenceHeight} from '../public/map/visibility.js';
import {simulationProfile} from '../public/map/prediction.js';
import {solarPosition,wrap} from '../public/map/solar.js';
const l={coordinates:{latitude:38.8583,longitude:111.5802},direction:{kind:'reported_sector',azimuth:225},timing:{net:'2026-10-23T10:15:00Z'}};
test('retained parcels cannot appear before emission or beyond their assumed lifetime',()=>{
 const profile=simulationProfile(l,{target:100});
 assert.equal(visibilitySamples(l,{profile,atSeconds:-1,persistenceSeconds:300})[0].length,0);
 const now=visibilitySamples(l,{profile,atSeconds:200,persistenceSeconds:300})[0];
 assert.ok(now.length>0);assert.ok(now.every(p=>p.emittedAt<=p.time&&p.age<=300&&p.time===Date.parse(l.timing.net)+200e3));
 assert.equal(visibilitySamples(l,{profile,atSeconds:491,persistenceSeconds:300})[0].length,0);
 assert.throws(()=>visibilitySamples(l,{profile,persistenceSeconds:-1}),/Invalid/);
});
test('retained plume re-evaluates solar shadow as terminator progresses west',()=>{
 const profile={full:[{latitude:38.8583,longitude:111.5802,height:100,seconds:0,downrange:0}]};
 const points=visibilitySamples(l,{profile,persistenceSeconds:1800,timeStepSeconds:60})[0];
 assert.equal(points[0].sunlit,true);assert.equal(points.at(-1).sunlit,false);
 assert.ok(points[0].sun.longitude>points.at(-1).sun.longitude);
 const a=solarPosition(l.timing.net),b=solarPosition(Date.parse(l.timing.net)+600e3);
 assert.ok(Math.abs(wrap(b.longitude-a.longitude)+2.5)<.01);
});
test('dark-sky core, civil-twilight and low-elevation bands agree with direct geometry',()=>{
 const profile=simulationProfile(l,{target:150}),options={profile,persistenceSeconds:300,minElevation:1,coreElevation:5};
 const result=visibilityFootprint(l,options),keys=new Map(result.cells.map(p=>[`${p.latitude},${p.longitude}`,p]));
 assert.ok(result.cells.length>result.coreCells.length&&result.coreCells.length>0);
 assert.ok(result.twilightCells.length>0);
 for(let latitude=20.5;latitude<55;latitude+=2)for(let longitude=90.5;longitude<135;longitude+=2){
  const observer={latitude,longitude},cell=keys.get(`${latitude},${longitude}`);
  assert.equal(Boolean(cell),observerVisibility(result.samples,observer,1).possible);
  if(cell)assert.equal(cell.band==='higher',observerVisibility(result.samples,observer,5,-6).possible);
 }
});
test('time slices differ from cumulative footprint and daylit negative control is excluded',()=>{
 const profile=simulationProfile(l,{target:100}),options={profile,persistenceSeconds:300,minElevation:1,coreElevation:5};
 assert.ok(visibilityFootprint(l,options).cells.length>0);
 assert.equal(visibilityFootprint(l,{...options,atSeconds:0}).cells.length,0);
 assert.equal(visibilityFootprint(l,{...options,atSeconds:500}).cells.length,0);
 const daylight={...l,timing:{net:'2026-10-23T02:15:00Z'}};
 assert.equal(visibilityFootprint(daylight,options).cells.length,0);
});
test('dawn and dusk footprints use only emitted sunlit parcels and dark core at the same instant',()=>{
 const cases=[
  {...l,coordinates:{latitude:28.562,longitude:-80.577},direction:{kind:'unconfirmed',azimuth:90},timing:{net:'2026-10-28T11:00:00Z'}},
  l
 ];
 for(const launch of cases){
  const profile=simulationProfile(launch,{target:150,azimuth:launch.direction.azimuth}),atSeconds=119;
  const result=visibilityFootprint(launch,{profile,atSeconds,untilSeconds:profile.duration,persistenceSeconds:300,minElevation:1});
  assert.ok(result.cells.length>0);
  assert.ok(result.samples.flat().every(p=>p.seconds<=atSeconds&&p.time===Date.parse(launch.timing.net)+atSeconds*1000));
  const all=visibilityFootprint(launch,{profile,untilSeconds:profile.duration,persistenceSeconds:300,minElevation:1});
  assert.ok(all.cells.length>result.cells.length,'all-ascent area must not leak into this early time slice');
  for(const cell of result.coreCells)assert.equal(observerVisibility(result.samples,cell,5,-6).possible,true);
  for(const cell of result.twilightCells){assert.equal(observerVisibility(result.samples,cell,5).possible,true);assert.equal(observerVisibility(result.samples,cell,5,-6).possible,false);}
 }
});
test('low-altitude sunlit trails are eligible before 50 km and observation reports never gate display',()=>{
 const net='2026-10-23T10:15:00Z',sun=solarPosition(net);
 const point={latitude:0.5,longitude:wrap(sun.longitude+91.5),height:10,seconds:0,downrange:0};
 const launch={coordinates:point,timing:{net}},profile={full:[point]};
 const options={profile,atSeconds:0,minElevation:1};
 const result=visibilityFootprint(launch,options);
 assert.ok(result.cells.length>0,'10 km plume can be sunlit and viewed from a dark ground location');
 assert.ok(observerVisibility(result.samples,point,1).possible);
 const withReport={...launch,cloudEvidence:{observation:{reportedTime:'2026-10-23T10:20:00Z',locations:[{...point,reportedTime:'2026-10-23T10:20:00Z'}]}}};
 assert.deepEqual(visibilityFootprint(withReport,options),result);
 const shadowed={...point,height:0.1};
 assert.equal(visibilityFootprint(launch,{...options,profile:{full:[shadowed]}}).cells.length,0,'Earth shadow still excludes an unlit low trail');
});
test('high-altitude highlight cannot include future emissions and does not alter ordinary low-altitude visibility',()=>{
 const profile=simulationProfile(l,{target:150});
 const height=jellyfishReferenceHeight(profile);
 assert.ok(height>60&&height<80);
 const options={profile,persistenceSeconds:300,untilSeconds:profile.duration};
 assert.equal(visibilityFootprint(l,{...options,atSeconds:120,minEmissionHeight:height}).cells.length,0);
 assert.ok(visibilityFootprint(l,{...options,atSeconds:120,minElevation:1}).cells.length>0);
 const ordinary=visibilityFootprint(l,{...options,atSeconds:180,minElevation:1});
 const high=visibilityFootprint(l,{...options,atSeconds:180,minEmissionHeight:height,minElevation:5});
 assert.ok(high.cells.length>0);
 const keys=new Set(ordinary.cells.map(p=>`${p.latitude},${p.longitude}`));
 assert.ok(high.cells.every(p=>keys.has(`${p.latitude},${p.longitude}`)));
 assert.ok(high.samples.flat().every(p=>p.height>=height&&p.seconds<=180));
});
