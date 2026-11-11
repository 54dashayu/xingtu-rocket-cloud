import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {discoverWarningLaunches,reconcileWarningEntries} from '../src/warning-discovery.js';
import {createLaunchFeed} from '../src/launch-feed.js';
import {calendarTiming} from '../src/ics.js';
import {preciseTime,countdown} from '../public/map/model.js';
import {launchTimePair} from '../public/map/time-display.js';
import {simulationLaunch} from '../public/map/manual-time.js';
const rows=JSON.parse(await readFile(new URL('./fixtures/notices-1119.json',import.meta.url)));
const now=Date.parse('2026-11-11T15:00:00Z');
const discover=(r=rows)=>discoverWarningLaunches(r,{now});
const candidate=()=>discover()[0];
test('real generic notices produce one pending Taiyuan window, not an ignition time',()=>{
 const [l]=discover();assert.equal(discover().length,1);assert.match(l.name,/太原.*待核实/);assert.equal(l.scheduleStatus.code,'unverified');
 assert.equal(l.timing.windowStart,'2026-11-18T22:43:00.000Z');assert.equal(l.timing.windowEnd,'2026-11-18T23:10:00.000Z');
 assert.equal(l.crewed,null);assert.equal(l.agency.ownership,'unknown');assert.equal(preciseTime(l),false);assert.equal(calendarTiming(l),null);
 assert.match(countdown(l,now),/不作发射倒计时/);assert.match(launchTimePair(l).beijing,/06:43.*07:10/);
 assert.equal(l.id,discover([...rows].reverse())[0].id);
});
test('single, unrelated, expired, broad, exercise, replacement and ambiguous corridors are rejected',()=>{
 assert.equal(discover(rows.slice(0,1)).length,0);
 for(const change of [r=>({...r,raw:r.raw+' TRAINING'}),r=>({...r,to_utc:'2026-11-20T00:00:00Z'}),r=>({...r,polygon:'broken'})])assert.equal(discover(rows.map(change)).length,0);
 assert.equal(discoverWarningLaunches(rows,{now:Date.parse('2026-11-19T00:00:00Z')}).length,0);
 assert.equal(discover([...rows,{...rows[0],notam_id:'A6000/26',raw:'A6000/26 NOTAMC A5897/26'}]).length,0);
 const site={id:'a',short:'A',name:'A',region:'中国',latitude:38.85,longitude:111.61,timezone:'Asia/Shanghai'};
 assert.equal(discoverWarningLaunches(rows,{now,sites:[site,{...site,id:'b'}]}).length,0);
});
test('formal task supersedes candidate, no takeover at distant site or unrelated time',()=>{
 const c=candidate(),formal={...c,id:'official',provenance:null,timing:{...c.timing,net:'2026-11-18T22:50:00Z',precision:'精确到分钟'},sources:[]};
 const merged=reconcileWarningEntries([{range:'upcoming',launch:c},{range:'upcoming',launch:formal}],[c],now);
 assert.equal(merged.length,1);assert.equal(merged[0].launch.id,'official');assert.equal(merged[0].launch.timing.net,formal.timing.net);assert.deepEqual(merged[0].launch.warningReference.noticeIds,c.warningDiscovery.noticeIds);
 assert.equal(reconcileWarningEntries([{range:'upcoming',launch:{...formal,timing:{...formal.timing,net:'2026-11-19T12:00:00Z'}}}],[c],now).length,2);
 assert.equal(reconcileWarningEntries([{range:'upcoming',launch:{...formal,pad:{location:'酒泉',latitude:40.8,longitude:100.2}}}],[c],now).length,2);
 assert.equal(reconcileWarningEntries([{range:'upcoming',launch:c}],[],now).length,0);
});
test('independent discovery works during LL2 429, synchronizes reader, survives failure and expires',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'notice-feed-'));t.after(()=>rm(dir,{recursive:true,force:true}));let clock=now,failed=false,empty=false,calls=0;
 const options={file:join(dir,'snapshot.json'),clock:()=>clock,seed:async()=>({}),fetchRange:async()=>{throw Object.assign(Error('quota'),{status:429,retryAfter:'7200'});},discover:async()=>{calls++;if(failed)throw Error('notice offline');return {launches:empty?[]:discover()};}};
 const writer=createLaunchFeed(options);await writer.refresh();assert.equal((await writer.get('upcoming')).launches.length,1);
 const reader=createLaunchFeed({...options,readOnly:true,discover:()=>assert.fail('reader fetching')});
 assert.deepEqual((await reader.get('upcoming')).launches,(await writer.get('upcoming')).launches);
 clock+=31*60000;failed=true;await writer.refresh();assert.equal(calls,2);assert.equal((await writer.get('upcoming')).launches.length,1);
 clock+=31*60000;failed=false;empty=true;await writer.refresh();assert.equal((await reader.get('upcoming')).launches.length,0);
 empty=false;clock+=31*60000;await writer.refresh();assert.equal((await reader.get('upcoming')).launches.length,1);
 clock=Date.parse('2026-11-19T00:00:00Z');assert.equal((await reader.get('upcoming')).launches.length,0);
});

test('manual notice scenario uses chosen instant without changing notice window',()=>{
 const c=candidate(),sim=simulationLaunch(c,'2026-11-18T22:50:00Z');
 assert.equal(sim.timing.basis,'manual');assert.equal(preciseTime(sim),true);
 assert.match(launchTimePair(sim).beijing,/06:50/);assert.equal(c.timing.basis,'notice_window');
});
