import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {launchReliability} from '../src/launch-reliability.js';
import {discoverWarningLaunches} from '../src/warning-discovery.js';
import {createLaunchFeed} from '../src/launch-feed.js';
const now=Date.parse('2026-11-11T15:00:00Z');
const candidate=discoverWarningLaunches(JSON.parse(await readFile(new URL('./fixtures/notices-1119.json',import.meta.url))),{now})[0];
const formal={...candidate,id:'ll2-task',name:'正式任务',provenance:undefined,warningDiscovery:undefined,lastUpdated:new Date(now).toISOString(),sources:[{name:'LL2',url:'https://ll.thespacedevs.com/2.3.0/launches/ll2-task/',role:'primary'}],scheduleStatus:{code:'confirmed'},timing:{net:'2026-11-18T22:50:00Z',precision:'精确到分钟'}};
test('LL2 stays primary with official verification; reliability is not a cloud score',()=>{
 const x=launchReliability({...formal,officialVerification:{sourceName:'官网',url:'https://www.cmse.gov.cn/a'},warningReference:candidate.warningDiscovery});
 assert.equal(x.primarySource,'LL2');assert.equal(x.fields.identity.level,'official');assert.equal(x.fields.direction.level,'notice_estimate');assert.equal(x.assessment.eligible,true);assert.equal(x.score,undefined);
 const unknown=launchReliability(candidate);assert.equal(unknown.fields.identity.level,'unverified');assert.equal(unknown.fields.time.level,'notice_window');assert.equal(unknown.assessment.mode,'notice_window');assert.equal(unknown.assessment.eligible,true);
});
test('notice prerequisites and sourced heading are evaluated field by field',()=>{
 assert.equal(launchReliability({...candidate,warningDiscovery:{}}).assessment.eligible,false);
 assert.equal(launchReliability({...candidate,pad:{}}).assessment.eligible,false);
 assert.equal(launchReliability({...candidate,scheduleStatus:{code:'cancelled'}}).assessment.eligible,false);
 const trajectory={launchId:formal.id,net:formal.timing.net,azimuth:190,sourceUrl:'https://example.org/task',publishedAt:'2026-11-11T00:00:00Z'};
 assert.equal(launchReliability({...formal,trajectory,warningReference:candidate.warningDiscovery}).fields.direction.level,'sourced_heading');
 assert.equal(launchReliability({...formal,trajectory:{...trajectory,launchId:'wrong'}}).fields.direction.level,'pending');
});
test('notice evidence survives LL2 refresh and restart, but is removed on withdrawal or reschedule',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'reliability-'));t.after(()=>rm(dir,{recursive:true,force:true}));let time=now,withdrawn=false,moved=false,calls=0;
 const opts={file:join(dir,'snapshot.json'),clock:()=>time,seed:async()=>({}),discover:async()=>{calls++;return {launches:withdrawn?[]:[candidate]};},fetchRange:async range=>({source:'LL2',launches:range==='upcoming'?[{...formal,lastUpdated:new Date(time).toISOString(),timing:{...formal.timing,net:moved?'2026-11-20T00:00:00Z':formal.timing.net}}]:[]})};
 let writer=createLaunchFeed(opts);await writer.refresh();let data=await writer.get('upcoming');assert.equal(data.launches.length,1);assert.ok(data.launches[0].warningReference);assert.equal(data.launches[0].dataReliability.primarySource,'LL2');assert.equal(data.discovery.candidates,undefined);
 time+=60000;await writer.refresh({force:true});assert.equal(calls,1);assert.ok((await writer.get('upcoming')).launches[0].warningReference);
 writer=createLaunchFeed(opts);time+=60000;await writer.refresh({force:true});assert.ok((await writer.get('upcoming')).launches[0].warningReference);
 moved=true;time+=60000;await writer.refresh({force:true});data=await writer.get('upcoming');assert.equal(data.launches.length,2);assert.equal(data.launches.find(l=>l.id===formal.id).warningReference,undefined);
 moved=false;withdrawn=true;time+=31*60000;await writer.refresh();data=await writer.get('upcoming');assert.equal(data.launches.length,1);assert.equal(data.launches[0].warningReference,undefined);
 const reader=createLaunchFeed({...opts,readOnly:true});assert.deepEqual((await reader.get('upcoming')).launches,JSON.parse(JSON.stringify(data.launches)));
});
