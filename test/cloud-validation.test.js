import test from 'node:test';
import assert from 'node:assert/strict';
import {corpus,auditCase} from '../scripts/validate-cloud-cases.mjs';
const results=corpus.cases.map(auditCase);
test('historical audit preserves local dates, EST/EDT and official corrections',()=>{
 const by=id=>results.find(c=>c.id===id);
 assert.equal(by('cz6a-20260512').utc,'2026-05-12T11:59:00Z');
 assert.equal(by('cz6a-20250606').local,'04:45');
 assert.equal(by('cz7-tz9-20250715').local,'05:34');
 assert.equal(by('f9-sl1040-20260304').local,'05:52');
 assert.equal(by('f9-sl1040-20260304').beijing,'18:52');
 assert.equal(by('f9-crs35-20261013').local,'06:33');
 assert.equal(by('f9-crs35-20261013').beijing,'18:33');
});
test('NASA independent dawn interval agrees and June dusk launch precedes sunset',()=>{
 const nasa=results.find(r=>r.nasaSunriseCheckMinutes).nasaSunriseCheckMinutes;
 assert.ok(Math.abs(nasa.calculated-nasa.reported)<2);
 const june=results.find(r=>r.id==='cz6a-20260604');
 assert.ok(june.solarAltitude>1&&june.solarAltitude<3);
 assert.equal(june.nearest.kind,'sunset');assert.ok(june.nearest.minutes< -14&&june.nearest.minutes> -18);
 for(const r of results){assert.ok(Math.abs(r.noaaDifferenceDegrees)<.5);assert.ok(r.terminatorWestwardDegrees10Minutes>2.49&&r.terminatorWestwardDegrees10Minutes<2.51);}
});
test('Philippines late observation is outside modeled time, not a visibility rejection',()=>{
 const r=results.find(r=>r.id==='cz6a-20260604');assert.equal(r.observation.secondsAfterLaunch,1260);
 assert.equal(r.observation.association,'highly_likely');
 for(const d of r.directions){assert.equal(d.kind,'parameter_sweep_not_actual_heading');for(const h of d.heights)assert.equal(h.observationTimeStatus,h.reached?'outside_model_time_window':'profile_unavailable');}
 assert.ok(r.directions.every(d=>d.heights.every(h=>h.reached?h.modelWindowEndSeconds<1260:h.modelWindowEndSeconds===null)));
});
test('coarse regional testimony is never converted to precise validation points or an accuracy score',()=>{
 assert.equal(corpus.cases.length,7);
 for(const c of corpus.cases){assert.equal(c.videoSource.independentlyGeolocated,false);assert.equal(c.trajectoryStatus,'no_verified_time_height_position_series');assert.ok(c.sources.length);assert.equal(c.observation?.coordinates,undefined);}
 for(const r of results){assert.match(r.spatialValidation,/not_scored/);assert.equal(r.directions.length,24);assert.equal(r.accuracy,undefined);}
});
