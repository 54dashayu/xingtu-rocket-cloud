import test from 'node:test';
import assert from 'node:assert/strict';
import {createMissionCache,reconcileMissions} from '../public/map/mission-cache.js';
import {cloudStatus} from '../public/cloud-status.js';
const data=(meta={},name='one')=>({results:[{id:'1',name}],meta:{fetchedAt:'2026-11-26T01:00:00Z',...meta}});
const response=d=>({ok:true,json:async()=>d});
test('one document stays stable after minutes and concurrent manual calls share one request',async()=>{
 let count=0,now=0;const read=createMissionCache(async()=>{count++;return response(data());},()=>now);
 assert.equal(read('/feed'),read('/feed',{force:true}));await read('/feed');now+=3600000;await read('/feed');assert.equal(count,1);
 const a=read('/feed',{force:true}),b=read('/feed',{force:true});assert.equal(a,b);await a;assert.equal(count,2);
});
test('SWR displays initial data then completes bounded stale to fresh update',async()=>{
 let count=0,shown=0;const waits=[];
 const read=createMissionCache(async()=>response(++count<3?data({refreshing:true,stale:true}):data({},'new')),Date.now,{sleep:async ms=>waits.push(ms)});
 const result=await read('/feed',{onSnapshot:d=>{shown++;assert.equal(d.results[0].name,'one');}});
 assert.equal(result.results[0].name,'new');assert.equal(shown,1);assert.deepEqual(waits,[3000,6000]);await read('/feed');assert.equal(count,3);
});
test('persistent stale cache stops after four requests; server backoff stops immediately',async()=>{
 let n=0;const read=createMissionCache(async()=>{n++;return response(data({stale:true}));},()=>0,{sleep:async()=>{}});
 assert.equal((await read('/feed')).meta.clientUpdate,'pending');await read('/feed');assert.equal(n,4);
 let b=0;const backoff=createMissionCache(async()=>{b++;return response(data({stale:true,retryAt:'2026-12-01'}));},()=>0,{sleep:async()=>assert.fail()});
 await backoff('/feed');assert.equal(b,1);
});
test('followup failure preserves last usable snapshot; initial failure permits explicit retry',async()=>{
 let n=0;const read=createMissionCache(async()=>{if(++n>1)throw Error('offline');return response(data({refreshing:true}));},Date.now,{sleep:async()=>{}});
 const result=await read('/feed');assert.equal(result.results.length,1);assert.equal(result.meta.clientUpdate,'failed');
 const retry=createMissionCache(async()=>{if(++n===3)throw Error('offline');return response(data());});await assert.rejects(retry('/feed'));assert.equal((await retry('/feed',{force:true})).results.length,1);
});
test('old quiet replacement reproduces disappearing indicator; unchanged data retains assessment and actual changed inputs invalidate it',()=>{
 const raw={id:'x',timing:{net:'2099-11-26T09:00:00Z',precision:'秒'},scheduleStatus:{code:'confirmed'},rocketCloud:{code:'unlikely'}};
 const assessed={...raw,cloudAssessment:{net:raw.timing.net,model:{code:'possible'},weather:{status:'unavailable'}}};
 assert.equal(cloudStatus(assessed).code,'reminder');assert.equal(cloudStatus({...raw}).code,'none');
 assert.equal(reconcileMissions([assessed],[structuredClone(raw)])[0],assessed);
 for(const patch of [{trajectory:{azimuth:180}},{timing:{...raw.timing,net:'2099-11-27T09:00:00Z'}},{propulsion:{upper:'methane'}}]){
  const changed=reconcileMissions([assessed],[{...raw,...patch}])[0];assert.equal(changed.cloudAssessment,undefined);
 }
 assessed.cloudAssessment={...assessed.cloudAssessment,model:{code:'no_geometry'}};
 assert.equal(cloudStatus(reconcileMissions([assessed],[structuredClone(raw)])[0]).code,'none');
});
