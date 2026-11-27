import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {compilePropulsionDatabase} from '../scripts/build-propulsion-db.mjs';
import {PROPULSION_RECORDS} from '../public/map/propulsion-data.js';
import {propulsionInfo,fuelRange} from '../public/map/propulsion.js';
const mini=null; // Mini Program is excluded.
const db=JSON.parse(readFileSync(new URL('../data/propulsion/commercial.json',import.meta.url)));
const p=rocket=>propulsionInfo({rocket});
test('all flown commercial records and exact aliases are shared offline by web and mini',()=>{
 const rows=compilePropulsionDatabase(db);
 for(const row of rows){assert.deepEqual(PROPULSION_RECORDS.find(r=>r.id===row.id),row);for(const rocket of row.aliases){assert.equal(p(rocket).configuration,row.id,rocket);if(mini)assert.deepEqual(p(rocket),mini.propulsionInfo({rocket}),rocket);}}
 assert.equal(new Set(rows.map(r=>r.provider)).size,7);
});
test('Falcon Heavy side cores are counted once and Super Heavy is a serial first stage',()=>{
 const h=p('Falcon Heavy');assert.equal(h.stages[0].engines[0].count,9);assert.equal(h.boosters[0].count,2);assert.equal(h.boosters[0].engines[0].count,9);
 assert.equal(h.stages[0].engines[0].count+h.boosters[0].count*h.boosters[0].engines[0].count,27);
 const star=p('Starship');assert.equal(star.boosters.length,0);assert.equal(star.stages[0].engines[0].count,33);assert.equal(star.stages[1].engines.reduce((n,e)=>n+e.count,0),6);
 assert.ok(star.stages.every(s=>s.fuel==='methalox'));
});
test('flown variant engines and mixed solid/liquid stages are not collapsed',()=>{
 assert.match(p('Zhuque-2').stages[1].engines[0].model,/12/);
 assert.match(p('Zhuque-2E').stages[1].engines[0].model,/15A/);
 assert.match(p('Zhuque-2E Y1').stages[0].engines[0].model,/TQ-12\)/);
 assert.match(p('Zhuque-2E').stages[0].engines[0].model,/TQ-12A/);
 assert.equal(p('Kinetica-2').boosters[0].count,2);assert.equal(p('Kinetica-2').boosters[0].engines[0].count,3);
 assert.equal(p('Gravity-1').boosters[0].count,4);
 assert.deepEqual(p('Ceres-1').stages.map(x=>x.fuel),['solid','solid','solid','liquid_unspecified']);
 assert.equal(p('Hyperbola-1').stages[3].fuel,'solid');assert.equal(p('Hyperbola-1 Y1').stages[3].fuel,'liquid_unspecified');
 assert.equal(p('Tianlong-2').stages[2].fuel,'hypergolic_mmh');
});
test('partial unknown fuel is explicit, retained with neutral weight rather than invented chemistry',()=>{
 const l={rocket:'Ceres-1',id:'demo',timing:{net:'2026-11-23T00:00:00Z'}};
 assert.equal(p(l.rocket).fuelComplete,false);
 l.propulsionTimeline={launchId:l.id,net:l.timing.net,sourceUrl:'https://example.org/test-fixture',intervals:[1,2,3,4].map(i=>({component:'stage'+i,start:(i-1)*100,end:i*100}))};
 assert.deepEqual(fuelRange(l,{seconds:350}),{min:1,max:1,known:false,basis:'按有来源的级段喷气时段'});
 assert.equal(fuelRange({rocket:'Falcon 9 Block 5'},{seconds:50}).min,.75);
 assert.equal(fuelRange({rocket:'Zhuque-3'},{seconds:50}).min,.8);
 assert.equal(fuelRange({rocket:'Gravity-1'},{seconds:50}).min,.85);
});
test('unflown upgrades and standalone hop prototypes do not acquire orbital configurations',()=>{
 for(const rocket of ['Zhuque-3 VTVL-1','Zhuque-3 upgraded','Starship SN15','Falcon 1e','Tianlong-3H','Hyperbola-3','Kinetica-1A'])assert.equal(p(rocket).known,false,rocket);
 const copy=structuredClone(db);copy.models[0].flightEvidence.status='planned';assert.throws(()=>compilePropulsionDatabase(copy),/已飞证据/);
});
test('official engine value prevails over the supplementary name for the same configuration',()=>{
 const copy=structuredClone(db);copy.models.find(r=>r.id==='zq3').components[0].engines=[{model:'未核对升级名',count:9,unit:'台',scope:'test'}];
 const row=compilePropulsionDatabase(copy).find(r=>r.id==='zq3');assert.match(row.stages[0].engines[0].model,/TQ-12A/);assert.equal(row.stages[0].fieldSources.engines,'landspace:zq3-y1');
});

test('feed Starship V3 retains known methane fuel without assuming engine counts',()=>{
 const launch={rocket:'星舰 V3',originalRocket:'Starship V3'};
 const info=propulsionInfo(launch);
 assert.equal(info.configuration,'starship-v3');assert.equal(info.fuelComplete,true);
 assert.ok(info.stages.every(s=>s.fuel==='methalox'&&s.engines.length===0));
 assert.equal(fuelRange(launch,{seconds:100}).min,.8);
 if(mini)assert.deepEqual(info,mini.propulsionInfo(launch));
});
