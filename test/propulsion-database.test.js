import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {compilePropulsionDatabase} from '../scripts/build-propulsion-db.mjs';
import {LONG_MARCH_RECORDS} from '../public/map/long-march-data.js';
import {propulsionInfo,fuelRange} from '../public/map/propulsion.js';
const mini=null; // Mini Program is excluded.
const db=JSON.parse(readFileSync(new URL('../data/propulsion/long-march.json',import.meta.url)));
test('local database generated output and every exact alias agree across web and mini',()=>{
 assert.deepEqual(compilePropulsionDatabase(db),LONG_MARCH_RECORDS);
 for(const r of LONG_MARCH_RECORDS)for(const rocket of r.aliases){
  const web=propulsionInfo({rocket});assert.equal(web.configuration,r.id,rocket);if(mini)assert.deepEqual(mini.propulsionInfo({rocket}),web,rocket);
 }
});
test('official field evidence wins; supplementary fetches cannot silently replace it',()=>{
 const copy=structuredClone(db),r=copy.models.find(r=>r.id==='cz2f');
 r.components[0].fuel='solid';
 const result=compilePropulsionDatabase(copy).find(r=>r.id==='cz2f');
 assert.equal(result.stages[0].fuel,'hypergolic');assert.equal(result.stages[0].fieldSources.fuel,'cnsa:2f');
 r.officialOverrides[0].sourceRef='wiki:长征二号F';assert.throws(()=>compilePropulsionDatabase(copy),/官方/);
});
test('different Long March configurations preserve distinct stages and side boosters',()=>{
 const p=rocket=>propulsionInfo({rocket});
 assert.equal(p('Long March 5').stages.length,2);assert.equal(p('Long March 5B').stages.length,1);
 assert.equal(p('Long March 5B').boosters[0].count,4);assert.equal(p('Long March 5B').boosters[0].engines[0].count,2);
 assert.deepEqual(p('Long March 6').stages.map(s=>s.fuel),['kerolox','kerolox','hypergolic']);
 assert.equal(p('Long March 6A').boosters[0].fuel,'solid');assert.equal(p('Long March 6C').boosters.length,0);
 assert.equal(p('Long March 12').stages[0].fuel,'kerolox');assert.equal(p('Long March 12A').stages[0].fuel,'methalox');
 assert.equal(p('Long March 8').boostersKnown,false);
 assert.equal(p('Long March 8 (Core Only)').boostersKnown,true);assert.equal(p('Long March 8 (Core Only)').boosters.length,0);
 assert.equal(p('Long March 8 (2 boosters)').boosters[0].count,2);
 for(const rocket of ['Long March','Long March 12B','Long March 5B/YZ-2','Long March 7A future','Long March 8R'])assert.equal(p(rocket).known,false,rocket);
});
test('new database fuels affect sensitivity but never invent an engine cutoff from model specs',()=>{
 const a=fuelRange({rocket:'Long March 11'},{seconds:800});assert.deepEqual([a.min,a.max],[.85,1]);
 assert.match(a.basis,/未提供/);
 assert.equal(fuelRange({rocket:'Long March 12A'},{seconds:80}).min,.8);
 assert.equal(fuelRange({rocket:'Long March 12'},{seconds:80}).min,.75);
});
test('ambiguous aliases and unsupported fuel records are rejected before generating assets',()=>{
 const a=structuredClone(db);a.models[1].aliases.push(a.models[0].aliases[0]);assert.throws(()=>compilePropulsionDatabase(a),/别名重复/);
 const b=structuredClone(db);b.models.find(r=>r.id==='cz12').components[0].fuel='unverified';assert.throws(()=>compilePropulsionDatabase(b),/未知推进剂/);
});
