import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createLaunchFeed,retryDelay} from '../src/launch-feed.js';
import {fetchLaunchPages} from '../src/store.js';
import {upcoming,pastLaunches} from '../public/map/model.js';
const initial=Date.parse('2026-11-07T00:40:00Z');
const launch=(id='flight',stamp='2026-11-07T00:35:00Z')=>({id,uid:id,name:id,lastUpdated:stamp,
 timing:{net:'2026-11-07T00:48:42Z',windowEnd:'2026-11-07T00:48:42Z',precision:'精确到秒'},result:{code:'pending',label:'结果待更新'}});
async function setup(t, fetchRange, entries=[launch()]){
 const dir=await mkdtemp(join(tmpdir(),'launch-feed-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 let now=initial;const file=join(dir,'snapshot.json');
 const opts={file,nearTtl:300000,clock:()=>now,fetchRange,seed:async()=>({upcoming:{fetchedAt:new Date(now).toISOString(),launches:entries},history:{fetchedAt:new Date(now).toISOString(),launches:[]}})};
 const writer=createLaunchFeed(opts);await writer.get('upcoming');
 return {writer,opts,file,advance:n=>{now+=n;},now:()=>now};
}
test('history handover survives upcoming outage, keeps pending flight honest and readers synchronized',async t=>{
 const x=await setup(t,async range=>{if(range==='upcoming')throw Error('timeout');return {launches:[launch('flight','2026-11-07T00:49:00Z')]};});
 x.advance(10*60000);await x.writer.refresh();
 const history=await x.writer.get('history'),future=await x.writer.get('upcoming');
 assert.equal(history.launches[0].result.code,'pending');assert.equal(future.launches.length,0);
 assert.equal(pastLaunches(history.launches,x.now()).length,1);
 const reader=createLaunchFeed({...x.opts,readOnly:true,fetchRange:()=>{throw Error('reader must not fetch');}});
 const read=await reader.get('history');assert.deepEqual(read.launches,history.launches);assert.equal(read.revision,history.revision);
 const restarted=createLaunchFeed(x.opts);assert.deepEqual((await restarted.get('history')).launches,history.launches);
});
test('missing upcoming record remains visible as waiting, never inferred to have launched',async t=>{
 const x=await setup(t,async range=>{if(range==='history')throw Error('offline');return {launches:[]};});
 x.advance(12*60000);await x.writer.refresh();
 const data=await x.writer.get('upcoming');assert.equal(data.launches.length,1);assert.equal(data.launches[0].dataPending,true);
 assert.equal(upcoming(data.launches,x.now()).length,1);assert.equal((await x.writer.get('history')).launches.length,0);
});
test('later pagination error keeps first page updates, retains older tasks and does not claim full freshness',async t=>{
 const x=await setup(t,async range=>({launches:range==='history'?[launch('new','2026-11-07T00:50:00Z')]:[],error:Error('page 2 failed')}));
 x.advance(12*60000);await x.writer.refresh();
 const history=await x.writer.get('history');assert.equal(history.launches[0].id,'new');assert.equal(history.stale,true);
 assert.equal(history.fetchedAt,new Date(initial).toISOString());assert.ok(history.retryAt);
 assert.equal((await x.writer.get('upcoming')).launches[0].id,'flight');
});
test('429 cooldown is global, persisted across restart and not bypassed by forced refresh',async t=>{
 let calls=0;const x=await setup(t,async()=>{calls++;throw Object.assign(Error('429'),{status:429,retryAfter:'120'});});
 x.advance(6*60000);await x.writer.refresh();assert.equal(calls,1);
 await x.writer.refresh({force:true});assert.equal(calls,1);
 const restarted=createLaunchFeed(x.opts);await restarted.refresh({force:true});assert.equal(calls,1);
 x.advance(121000);await restarted.refresh();assert.equal(calls,2);
 assert.equal(retryDelay('Sat, 07 Nov 2026 01:00:00 GMT',initial),20*60000);
});
test('automatic refresh recovers after outage without user force and stale responses cannot regress a newer mission',async t=>{
 let failing=true;const x=await setup(t,async range=>{if(failing)throw Error('offline');return {launches:range==='history'?[launch('flight','2026-11-07T00:51:00Z')]:[launch()]};});
 x.advance(12*60000);await x.writer.refresh();assert.equal((await x.writer.get('history')).stale,true);
 failing=false;x.advance(61000);await x.writer.refresh();
 const data=await x.writer.get('history');assert.equal(data.stale,false);assert.equal(data.launches[0].lastUpdated,'2026-11-07T00:51:00Z');
 assert.equal((await x.writer.get('upcoming')).launches.length,0);
});
test('a real reschedule changes range/date instead of retaining a ghost history entry',async t=>{
 let moved=false;const x=await setup(t,async range=>({launches:range==='history'?[launch('flight','2026-11-07T00:49:00Z')]:moved?[{...launch('flight','2026-11-07T00:55:00Z'),timing:{net:'2026-11-08T00:48:42Z'}}]:[]}));
 x.advance(10*60000);await x.writer.refresh();moved=true;await x.writer.refresh({force:true});
 assert.equal((await x.writer.get('history')).launches.length,0);assert.equal((await x.writer.get('upcoming')).launches[0].timing.net,'2026-11-08T00:48:42Z');
});
test('partial page mode preserves earlier records after timeout or malformed later page',async()=>{
 for(const mode of ['timeout','invalid']){
  let calls=0;const result=await fetchLaunchPages('https://example.test/1',async()=>{
   if(++calls===1)return {ok:true,json:async()=>({results:[{id:'new'}],next:'https://example.test/2'})};
   if(mode==='timeout')throw Error('timeout');return {ok:true,json:async()=>({invalid:true})};
  },{partial:true});assert.equal(result.results[0].id,'new');assert.ok(result.error);
 }
});
test('simultaneous scheduled and request refreshes share one upstream cycle',async t=>{
 let calls=0;const x=await setup(t,async()=>{calls++;await new Promise(r=>setTimeout(r,5));return {launches:[]};});
 x.advance(6*60000);await Promise.all([x.writer.refresh(),x.writer.refresh(),x.writer.refresh()]);assert.equal(calls,2);
});

test('reader IO failure keeps its last snapshot and a cold reader fails instead of returning an empty success',async t=>{
 const x=await setup(t,async()=>({launches:[]}));
 const reader=createLaunchFeed({...x.opts,readOnly:true});const initial=await reader.get('upcoming');
 await writeFile(x.file,'invalid json');
 const retained=await reader.get('upcoming');assert.deepEqual(retained.launches,initial.launches);assert.equal(retained.stale,true);
 await assert.rejects(createLaunchFeed({...x.opts,readOnly:true}).get('upcoming'));
});


test('hung upstream cycle releases single-flight lock and recovers on next scheduled retry',async t=>{
 let hung=true;const x=await setup(t,async()=>hung?new Promise(()=>{}):{launches:[launch('recovered')]});
 const writer=createLaunchFeed({...x.opts,fetchTimeoutMs:15});
 x.advance(6*60000);await writer.refresh();
 const failed=await writer.get('upcoming');assert.equal(failed.refreshing,false);assert.equal(failed.stale,true);
 hung=false;x.advance(61000);await writer.refresh();
 assert.equal((await writer.get('upcoming')).stale,false);
 assert.ok((await writer.get('history')).launches.some(l=>l.id==='recovered'));
});

test('late upstream completion cannot overwrite successful retry',async t=>{
 let resolveLate;const x=await setup(t,async range=>range==='history'?new Promise(r=>resolveLate=r):{launches:[]});
 const writer=createLaunchFeed({...x.opts,fetchTimeoutMs:10});x.advance(6*60000);await writer.refresh();
 const before=await writer.get('history');resolveLate({launches:[launch('late')]});await new Promise(r=>setImmediate(r));
 assert.deepEqual((await writer.get('history')).launches,before.launches);
});
