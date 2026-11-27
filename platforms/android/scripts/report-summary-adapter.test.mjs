import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {adaptReportSummary} from './report-summary-adapter.mjs';
const old='  if(generation!==catalogueGeneration)return;\n  missionRows=feeds.map(l=>{const row=prepareMission(l,records);return row;});';
test('legacy snapshot gets one adapter and repeat application is stable',()=>{
 const result=adaptReportSummary(old);assert.match(result,/observationReportCount:Number.isSafeInteger/);assert.equal(adaptReportSummary(result),result);
});
test('actual shared 0021 source remains byte-for-byte unchanged',async()=>{
 const shared=await readFile(new URL('../../../public/3d/app.js',import.meta.url),'utf8');
 assert.match(shared,/readReportSummary/);assert.equal(adaptReportSummary(shared),shared);
});
test('partial integration and changed legacy call fail closed',()=>{
 assert.throws(()=>adaptReportSummary('readReportSummary()\n'+old));assert.throws(()=>adaptReportSummary(old.replace('prepareMission(l,records)','prepareMission(l)')));
});
