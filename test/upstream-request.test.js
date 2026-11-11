import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequestBudget,withDeadline} from '../src/upstream-request.js';
import {fetchLaunchPages} from '../src/store.js';

test('request deadline bounds both ignored aborts and a stuck response body',async()=>{
 for(const body of [false,true]){
  let signal;
  await assert.rejects(fetchLaunchPages('https://example.test/',async(_url,opts)=>{
   signal=opts.signal;return body?{ok:true,json:()=>new Promise(()=>{})}:new Promise(()=>{});
  },{timeoutMs:15}),{code:'UPSTREAM_TIMEOUT'});
  assert.equal(signal.aborted,true);
 }
});
test('partial pages survive a stuck body, and head-only refresh sends one request',async()=>{
 let calls=0;const fetcher=async()=>({ok:true,json:async()=>++calls===1?{results:[{id:'latest'}],next:'https://example.test/2'}:new Promise(()=>{})});
 const partial=await fetchLaunchPages('https://example.test/1',fetcher,{partial:true,timeoutMs:15});
 assert.equal(partial.results[0].id,'latest');assert.equal(partial.error.code,'UPSTREAM_TIMEOUT');
 calls=0;const head=await fetchLaunchPages('https://example.test/1',fetcher,{maxPages:1});assert.equal(calls,1);assert.equal(head.error,undefined);
});
test('persistent rolling request budget survives restart, concurrency and expiry',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'ll2-budget-'));t.after(()=>rm(dir,{recursive:true,force:true}));let now=10000000;
 const options={file:join(dir,'budget.json'),clock:()=>now};const reserve=createRequestBudget(options);
 const results=await Promise.allSettled(Array.from({length:16},()=>reserve()));assert.equal(results.filter(x=>x.status==='fulfilled').length,14);
 await assert.rejects(createRequestBudget(options)(),e=>e.status===429&&Number(e.retryAfter)===3600);
 now+=3600001;await createRequestBudget(options)();
});
test('parent cancellation prevents a late task from starting',async()=>{
 const controller=new AbortController();controller.abort(Error('stop'));let called=false;
 await assert.rejects(withDeadline(()=>{called=true;},{signal:controller.signal}),/stop/);assert.equal(called,false);
});
