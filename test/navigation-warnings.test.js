import test from 'node:test';
import assert from 'node:assert/strict';
import {parseWarningCSV,warningCandidates,bearingArc} from '../src/navigation-warnings.js';
import {inBearingArc} from '../public/map/heading-constraints.js';
const launch={coordinates:{latitude:0,longitude:0},timing:{net:'2026-10-25T02:00:00Z'}};
const row={notam_id:'TEST',from_utc:'2026-10-25T01:30:00Z',to_utc:'2026-10-25T02:30:00Z',raw:'ROCKET LAUNCH DEBRIS AREA',polygon:'[[[-0.2,5],[0.2,5],[0.2,6],[-0.2,6]]]'};
test('CSV preserves quoted commas, newlines and escaped quotes',()=>{
 const r=parseWarningCSV('from_utc,polygon,raw\r\nnow,"[[1,2],[3,4]]","a,b\n""quoted"""\r\n');assert.equal(r[0].raw,'a,b\n"quoted"');assert.equal(r[0].polygon,'[[1,2],[3,4]]');assert.throws(()=>parseWarningCSV('from_utc,polygon\nx,"bad'));
});
test('warning geometry gives a candidate interval, never confirmed task direction',()=>{
 const c=warningCandidates(launch,[row])[0];assert.ok(c.center>89&&c.center<91);assert.ok(c.width<10);assert.match(c.match,/尚未确认/);assert.match(c.kind,/落区/);
});
test('expired, broad, daily, recovery and over-wide regions cannot constrain direction',()=>{
 for(const patch of [{to_utc:'2026-10-24T03:00Z'},{to_utc:'2026-11-20T03:00Z'},{raw:'ROCKET LAUNCH D) DAILY 0100-0500'},{raw:'ROCKET RECOVERY'},{polygon:'[[[-10,5],[10,5],[0,6]]]'}])assert.equal(warningCandidates(launch,[{...row,...patch}]).length,0);
 assert.equal(warningCandidates({...launch,direction:{kind:'sourced_heading',azimuth:270}},[row]).length,0);
});
test('bearing intervals crossing north stay narrow and wrap correctly',()=>{const arc=bearingArc([355,2,5]);assert.equal(arc.width,10);assert.ok(inBearingArc(0,arc));assert.ok(inBearingArc(359,arc));assert.equal(inBearingArc(180,arc),false);});
