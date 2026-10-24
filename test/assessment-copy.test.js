import test from 'node:test';
import assert from 'node:assert/strict';
import { assessmentCopy } from '../public/map/assessment-copy.js';
const result=(counts,status='available',code='possible')=>({model:{code},weather:{status,counts}});
test('mixed locations are described as reference places, never a region-wide chance',()=>{
 const c=assessmentCopy(result({clearer:2,mixed:0,obstructed:7,missing:0}),{scenario:true});
 assert.equal(c.title,'部分地点天气较好，可以留意');assert.equal(c.total,9);
 assert.match(c.weather,/2 个天气较好/);assert.match(c.weather,/7 个可能受云雨或低能见度影响/);
 assert.doesNotMatch(c.weather,/0 个|概率|采样|几何/);assert.match(c.context,/你设置/);
});
test('missing and out-of-range weather are never described as favorable',()=>{
 for(const status of ['available','unavailable','outside_horizon']){
  const c=assessmentCopy(result({clearer:0,mixed:0,obstructed:0,missing:9},status));
  assert.doesNotMatch(c.title,/天气较好/);assert.match(c.weather,status==='outside_horizon'?/临近日期/:/未齐全/);
 }
 const partial=assessmentCopy(result({obstructed:2,missing:7}));
 assert.match(partial.title,/已查到的地点/);assert.match(partial.weather,/7 个暂时没有/);
});
test('historical wording and model gaps remain distinct from weather',()=>{
 const past=assessmentCopy(result({clearer:2,obstructed:7}),{historical:true});assert.equal(past.title,'当时部分地点天气较好');
 for(const code of ['pending','preliminary','no_geometry'])assert.doesNotMatch(assessmentCopy(result({},'not_requested',code)).title,/天气较好|有观看机会/);
});
