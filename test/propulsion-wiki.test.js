import test from 'node:test';import assert from 'node:assert/strict';
import {wikiCandidate,fetchWikiReview} from '../scripts/review-propulsion-wiki.mjs';
import {propulsionInfo} from '../public/map/propulsion.js';
test('wiki import retains exact revision and stays a supplementary review artifact',()=>{
 const row=wikiCandidate({pageid:1,title:'测试型号',revisions:[{revid:2,timestamp:'2026-11-23T00:00:00Z',slots:{main:{content:'推进剂为液氧煤油\n[https://www.cnsa.gov.cn/example 官方]\n[https://cnsa.gov.cn.evil.test/ 非官方]'}}}]});
 assert.equal(row.revision,2);assert.equal(row.role,'supplementary');assert.equal(row.status,'review_only');assert.deepEqual(row.officialLinks,['https://www.cnsa.gov.cn/example']);
 const info=propulsionInfo({rocket:'Long March 2F/G'});assert.equal(info.sources[0].role,'primary');assert.equal(info.sources[1].role,'supplementary');assert.equal(info.stages[0].fuel,'hypergolic');
});
test('wiki lookup is read-only and fails explicitly on unavailable API',async()=>{
 await assert.rejects(fetchWikiReview([],{}));
 await assert.rejects(fetchWikiReview(['测试'],{fetcher:async url=>{assert.equal(url.searchParams.get('action'),'query');assert.equal(url.searchParams.get('maxlag'),'5');return {ok:false,status:403};}}),/403/);
 const x=await fetchWikiReview(['不存在'],{fetcher:async()=>({ok:true,text:async()=>JSON.stringify({query:{pages:[{title:'不存在',missing:true}]}})})});
 assert.equal(x.pages[0].status,'unavailable');
});
