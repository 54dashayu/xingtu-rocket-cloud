import test from 'node:test';
import assert from 'node:assert/strict';
import {localTimeCandidates,localDateTime,simulationLaunch} from '../public/map/manual-time.js';
import {sunEvents} from '../public/map/sun-events.js';
import {mapLaunch,preciseTime} from '../public/map/model.js';
test('local launch input converts using the site zone, including fractional offsets',()=>{
 assert.deepEqual(localTimeCandidates('2026-10-28T18:00','America/New_York'),['2026-10-28T22:00:00.000Z']);
 assert.deepEqual(localTimeCandidates('2026-10-28T18:00','Asia/Shanghai'),['2026-10-28T10:00:00.000Z']);
 assert.deepEqual(localTimeCandidates('2026-10-28T18:00','Asia/Kolkata'),['2026-10-28T12:30:00.000Z']);
 assert.equal(localDateTime('2026-10-28T22:00:00Z','Asia/Shanghai'),'2026-10-29T06:00');
});
test('nonexistent DST times reject; repeated times offer both instants',()=>{
 assert.deepEqual(localTimeCandidates('2026-03-08T02:30','America/New_York'),[]);
 assert.deepEqual(localTimeCandidates('2026-11-01T01:30','America/New_York'),['2026-11-01T05:30:00.000Z','2026-11-01T06:30:00.000Z']);
 for(const value of ['','2026-02-30T18:00','2026-10-28T24:30'])assert.deepEqual(localTimeCandidates(value,'Asia/Shanghai'),[]);
});
test('manual scenario does not mutate official time/status or carry over dated evidence',()=>{
 const base={id:'test',timing:{net:'2026-10-29T00:00:00Z',precision:'仅确定日期'},scheduleStatus:{code:'tbd'},pad:{latitude:28.5,longitude:-80.6,timezone:'America/New_York'},flightProfile:{id:'old'},cloudEvidence:{id:'old'}};
 const copy=JSON.stringify(base),scenario=mapLaunch(simulationLaunch(base,'2026-10-28T22:00:00Z'));
 assert.equal(JSON.stringify(base),copy);assert.equal(preciseTime(base),false);assert.equal(preciseTime(scenario),true);
 assert.equal(scenario.cloudEvidence,null);assert.equal(scenario.flightProfile,null);assert.equal(scenario.manualTime,true);assert.ok(scenario.rocketCloud.localSun.sunset);
});
test('civil dawn/dusk and sunrise/sunset share date but separate cache entries',()=>{
 const p={latitude:28.5,longitude:-80.6};const day='2026-10-28T16:00:00Z';
 const sun=sunEvents(day,p,'America/New_York'),civil=sunEvents(day,p,'America/New_York',-6);
 assert.ok(Date.parse(civil.sunrise)<Date.parse(sun.sunrise));assert.ok(Date.parse(civil.sunset)>Date.parse(sun.sunset));
 assert.equal(sun.threshold,-.833);assert.equal(civil.threshold,-6);assert.equal(sun.date,civil.date);
});
