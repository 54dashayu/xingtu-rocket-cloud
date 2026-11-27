import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {propulsionInfo,fuelRange} from '../public/map/propulsion.js';
import {scoreObserver} from '../public/map/cloud-index.js';
import {illuminatedSegments} from '../public/3d/illumination.js';
import {isSunlit} from '../public/map/model.js';
const mini=null; // Mini Program is excluded.
test('specific variants retain upper stages and boosters, unknown variants are not guessed',()=>{
 const l={originalRocket:'Long March 6A'},p=propulsionInfo(l);
 assert.equal(p.stages[0].fuel,'kerolox');assert.equal(p.boosters[0].fuel,'solid');assert.equal(p.boosters[0].count,4);
 assert.equal(propulsionInfo({rocket:'Long March 3B/E'}).stages[2].fuel,'hydrolox');
 for(const rocket of ['Long March','Long March 6 unknown variant','Zhuque-2 unknown variant','Ariane 6','待核实'])assert.equal(propulsionInfo({rocket}).known,false);
 assert.equal(propulsionInfo({rocket:'Falcon 9',originalRocket:'Falcon 9 unknown variant'}).known,false);
 assert.deepEqual(propulsionInfo({rocket:'Falcon 9'}).boosters,[]);
});
test('mini and web data and coefficients are identical',{skip:'Mini Program source excluded from public repository'},()=>{
 for(const rocket of ['Falcon 9','Falcon Heavy','Long March 6A','Long March 7A','Long March 3B/E','Ariane 62','Ariane 64','Zhuque-2','Smart Dragon 3','unknown']){
  const l={rocket};if(mini)assert.deepEqual(mini.propulsionInfo(l),propulsionInfo(l));if(mini)assert.deepEqual(mini.fuelRange(l,{seconds:90}),fuelRange(l,{seconds:90}));
 }
});
test('booster uses emission time, stops new emissions after burnout, retained parcels keep their fuel',()=>{
 const l={id:'mission',rocket:'Long March 6A',timing:{net:'2026-11-23T00:00:00Z'}};
 l.propulsionTimeline={launchId:l.id,net:l.timing.net,sourceUrl:'https://example.org/test-fixture',intervals:[{component:'stage1',start:0,end:150},{component:'booster',start:0,end:90},{component:'stage2',start:160,end:300}]};
 assert.equal(fuelRange(l,{seconds:80,age:200}).min,.85);
 assert.equal(fuelRange(l,{seconds:100,age:0}).min,.75);
 assert.equal(fuelRange(l,{seconds:155,age:0}).max,0);
 assert.equal(fuelRange(l,{seconds:305,age:0}).max,0);
 l.propulsionTimeline.launchId='another';assert.match(fuelRange(l,{seconds:305}).basis,/未提供/);
 assert.deepEqual([fuelRange({rocket:'unknown'},{}).min,fuelRange({rocket:'unknown'},{}).max],[1,1]);
});
test('fuel cannot overcome shadow or daylight; sensitivity is bounded by original geometry',()=>{
 const observer={latitude:0,longitude:0};
 const parcels=[0,30,60,90,120].map(seconds=>({latitude:0,longitude:0,height:150,seconds,time:seconds*1000,sun:{latitude:0,longitude:100},sunlit:true}));
 const base=scoreObserver(parcels,observer).score;
 const a=scoreObserver(parcels,observer,p=>fuelRange({rocket:'Long March 2C'},p).min).score;
 const b=scoreObserver(parcels,observer,p=>fuelRange({rocket:'Smart Dragon 3'},p).min).score;
 assert.ok(a<b&&b<=base);
 assert.equal(scoreObserver(parcels.map(p=>({...p,sunlit:false})),observer,()=>1).score,0);
 assert.equal(scoreObserver(parcels.map(p=>({...p,sun:{latitude:0,longitude:80}})),observer,()=>1).score,0);
});
test('3D crossing classification uses high altitude sunlight and splits at the shadow boundary',()=>{
 const sun={latitude:0,longitude:0};
 const darkGround={latitude:0,longitude:100,height:150};
 assert.equal(isSunlit(sun,darkGround,0),false);assert.equal(isSunlit(sun,darkGround,150),true);
 const r=illuminatedSegments([{latitude:0,longitude:95,height:150},{latitude:0,longitude:110,height:150}],sun);
 assert.ok(r.lit.length&&r.shadow.length);
 assert.ok(Math.abs(r.lit.at(-1).longitude-r.shadow[0].longitude)<1e-6);
 for(const [key,points]of Object.entries(r))for(let i=0;i<points.length;i+=2){const a=points[i],b=points[i+1];assert.equal(isSunlit(sun,{latitude:0,longitude:(a.longitude+b.longitude)/2},150),key==='lit');}
});
import {assessCloud} from '../src/cloud-assessment.js';
import {cloudIndex} from '../public/map/cloud-index.js';
import {mapLaunch} from '../public/map/model.js';
test('API and browser return the same propulsion range and retain the geometry baseline',async()=>{
 const l={id:'local-experiment',rocket:'Long March 6A',pad:{latitude:38.85,longitude:111.61},manualScenario:true,timing:{net:'2026-11-18T22:50:00Z',precision:'精确到秒'},scheduleStatus:{code:'confirmed'}};
 const result=await assessCloud(l,{weatherEnabled:false,azimuth:186.9});
 const browser=cloudIndex(mapLaunch(l),result);
 assert.deepEqual(result.index,browser);assert.ok(browser.min<browser.max);assert.equal(browser.max,browser.geometryScore);assert.ok(browser.propulsionKnown);
 const old={...result,windowIndex:{score:99},net:l.timing.net};
 assert.equal(cloudIndex({...l,timing:{...l.timing,basis:'notice_window'}},old).score,null);
});
