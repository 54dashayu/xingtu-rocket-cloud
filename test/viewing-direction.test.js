import test from 'node:test';
import assert from 'node:assert/strict';
import {viewingElongation,visibilityFootprint,observerVisibility} from '../public/map/visibility.js';
import {directionTone,areaFill,groundLightTone,AREA_OPACITY} from '../public/map/area-colors.js';
import {simulationProfile} from '../public/map/prediction.js';
test('view direction reverses with the Sun, not fixed east/west or launch heading',()=>{
 const o={latitude:0,longitude:0},east={latitude:0,longitude:5,height:150},west={...east,longitude:-5};
 const sunrise={latitude:0,longitude:90},sunset={latitude:0,longitude:-90};
 assert.ok(viewingElongation(o,east,sunrise)<50);
 assert.ok(viewingElongation(o,west,sunrise)>130);
 assert.ok(viewingElongation(o,east,sunset)>130);
 assert.ok(viewingElongation(o,west,sunset)<50);
 assert.equal(viewingElongation(o,{...o,height:150},sunrise),90);
});
test('towards-Sun tint is modest and never erases a region',()=>{
 for(const band of ['jellyfish','higher','twilight','low']){
  const away=areaFill(band,directionTone(180)),towards=areaFill(band,directionTone(0));
  for(const start of [1,3,5])assert.ok(parseInt(towards.slice(start,start+2),16)>parseInt(away.slice(start,start+2),16));
  assert.notEqual(towards,'#ffffff');
 }
});
test('direction tones preserve eligibility and use only currently visible parcels',()=>{
 const launch={coordinates:{latitude:38.8583,longitude:111.5802},timing:{net:'2026-10-23T10:15:00Z'}};
 const profile=simulationProfile(launch,{target:150,azimuth:225}),r=visibilityFootprint(launch,{profile,atSeconds:180,persistenceSeconds:300,minElevation:1});
 const values=r.samples.flat();
 assert.ok(new Set(r.cells.map(p=>directionTone(p.sunSeparation))).size>1);
 for(const c of r.cells){
  assert.ok(observerVisibility(r.samples,c,1).possible);
  const matches=values.filter(p=>observerVisibility([[p]],c,c.band==='low'?1:5,c.band==='higher'?-6:-1).possible);
  const expected=Math.max(...matches.map(p=>viewingElongation(c,p,p.sun)));
  assert.ok(Math.abs(expected-c.sunSeparation)<1e-7);
 }
});

// Color semantics follow ground light, not whether the viewer looks west or east.
test('dusk has darker eastern ground; dawn has darker western ground',async()=>{
 const {solarAltitude}=await import('../public/map/solar.js');
 const tone=(date,lat,lon)=>groundLightTone(solarAltitude(date,lat,lon));
 assert.ok(tone('2026-10-23T10:18:00Z',38,120)<tone('2026-10-23T10:18:00Z',38,105));
 assert.ok(tone('2026-10-28T11:00:00Z',28,-85)<tone('2026-10-28T11:00:00Z',28,-75));
 assert.ok(AREA_OPACITY>0&&AREA_OPACITY<1);
 assert.equal(groundLightTone(-12),0);assert.equal(groundLightTone(-1),8);
});
