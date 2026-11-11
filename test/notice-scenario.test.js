import test from 'node:test';
import assert from 'node:assert/strict';
import {noticeScenario} from '../public/map/notice-scenario.js';
import {preciseTime,mapLaunch,countdown} from '../public/map/model.js';
import {missionScenario} from '../public/3d/missions.js';
import {simulationProfile} from '../public/map/prediction.js';
const raw={id:'notice-test',name:'太原发射（待核实）',pad:{latitude:38.85,longitude:111.61},timing:{net:'2026-11-18T22:43:00Z',windowStart:'2026-11-18T22:43:00Z',windowEnd:'2026-11-18T23:10:00Z',basis:'notice_window',precision:'航警时间窗'},scheduleStatus:{code:'unverified'},warningDiscovery:{headingEstimate:188.8}};
const result={launchId:raw.id,net:raw.timing.net,model:{reliability:{assessment:{eligible:true}}},noticeWindow:{start:raw.timing.windowStart,end:raw.timing.windowEnd,referenceTime:'2026-11-18T22:47:30Z',heading:188.8}};
test('notice playback preserves original window and shares time and exact heading across 2D and 3D',()=>{
 const before=JSON.stringify(raw),s=noticeScenario(mapLaunch(raw),result);
 assert.ok(preciseTime(s));assert.equal(preciseTime(raw),false);assert.equal(JSON.stringify(raw),before);
 assert.equal(s.timing.net,result.noticeWindow.referenceTime);assert.equal(s.noticeScenario.heading,188.8);
 const three=missionScenario(s),two=simulationProfile(s,{target:0,azimuth:188.8,historical:false});
 assert.equal(three.heading.azimuth,188.8);assert.deepEqual(three.profile.full,two.full);
 assert.match(countdown(raw),/待核实/);assert.equal(s.scheduleStatus.label,'航警预估');
});
test('invalid, stale, cancelled and mismatched window assessments cannot enable playback',()=>{
 for(const bad of [{...result,launchId:'other'},{...result,net:'2026-11-17T00:00:00Z'},{...result,noticeWindow:{...result.noticeWindow,referenceTime:'2026-11-19T00:00:00Z'}},{...result,noticeWindow:{...result.noticeWindow,heading:189}},{...result,model:{reliability:{assessment:{eligible:false}}}}])assert.equal(noticeScenario(raw,bad),null);
 assert.equal(noticeScenario({...raw,scheduleStatus:{code:'cancelled'}},result),null);
 assert.equal(noticeScenario({...raw,warningDiscovery:{}},result),null);
 assert.equal(noticeScenario({...raw,timing:{...raw.timing,basis:'official'}},result),null);
});
