import test from 'node:test';
import assert from 'node:assert/strict';
import {cloudOpportunity,cloudStatus} from '../public/cloud-status.js';
import {mapLaunch,cloudCandidate} from '../public/map/model.js';
import {sunEvents} from '../public/map/sun-events.js';
const base={timing:{net:'2026-10-25T10:00:00Z',precision:'精确到分钟'},scheduleStatus:{code:'confirmed'},pad:{latitude:19.61,longitude:110.95,timezone:'Asia/Shanghai'}};
test('broad shortlist includes daylight near sunset without changing detailed assessment',()=>{
 const sunset=Date.parse(sunEvents(base.timing.net,base.pad,'Asia/Shanghai').sunset);
 const at=minutes=>mapLaunch({...base,timing:{...base.timing,net:new Date(sunset+minutes*60000).toISOString()}});
 const early=at(-75);assert.equal(early.rocketCloud.code,'unlikely');assert.equal(cloudCandidate(early),true);
 assert.equal(cloudCandidate(at(-95)),false);
 assert.equal(cloudStatus(early,0).code,'reminder');
 for(const minutes of [-90,90])assert.equal(cloudOpportunity({...base,rocketCloud:{code:'unlikely',localSun:{nearest:{minutes}}}}),'possible');
});
test('unknown times are pending, not positive, and withdrawn plans stay excluded',()=>{
 const unknown={...base,timing:{net:base.timing.net,precision:'仅确定日期'}};
 assert.equal(cloudOpportunity(unknown),'pending');assert.equal(cloudCandidate(unknown),false);assert.equal(cloudStatus(unknown,0).code,'none');
 for(const code of ['cancelled','postponed'])assert.equal(cloudOpportunity({...unknown,scheduleStatus:{code}}),'none');
 assert.equal(cloudOpportunity({...base,rocketCloud:{code:'unlikely',localSun:{nearest:{minutes:null}}}}),'none');
});
