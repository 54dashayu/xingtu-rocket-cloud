import test from 'node:test';
import assert from 'node:assert/strict';
import {populationRequest,surroundingPopulation} from '../src/population.js';
test('population query preserves lat/lon and labels 2025 surrounding population scope',async()=>{
 assert.deepEqual(populationRequest(40.96,100.29).geometry.coordinates,[100.29,40.96]);
 assert.throws(()=>populationRequest(NaN,0));
 const result=await surroundingPopulation(1,2,{fetcher:async()=>({ok:true,json:async()=>({total:{population_within:0,rings:[]}})})});
 assert.equal(result.total,0);assert.equal(result.status,'available');assert.equal(result.radiusKm,100);
});
test('population source failure is unknown, never fabricated zero population',async()=>{
 const result=await surroundingPopulation(3,4,{fetcher:async()=>({ok:false,json:async()=>({error:'no_data'})})});
 assert.equal(result.status,'unavailable');assert.equal(result.total,undefined);
});
