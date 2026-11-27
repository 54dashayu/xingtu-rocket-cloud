import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {withCrewStatus,officialCrewValue} from '../public/crew-status.js';
import {filterLaunches,normalizeLaunch} from '../src/normalize.js';
const mini=null; // Mini Program is excluded.
const mission=(n,year,crewed=false)=>({id:'sz'+n,name:'长征2F/G｜神舟'+n+'号飞船',originalName:'Long March 2F/G | Shenzhou '+n,mission:{name:'神舟'+n+'号'},timing:{net:year+'-11-25T00:00:00Z'},crewed,sources:[],country:{code:'CN'},region:'中国',agency:{name:'航天'},scheduleStatus:{code:'confirmed'},livestream:{available:false},pad:{}});
test('official mission evidence repairs old false flag, supports Chinese numerals and is shared with mini',()=>{
 for(const [n,y,value]of [[24,2026,true],[23,2026,true],[22,2025,false],[8,2011,false]]){const l=mission(n,y,!value),a=withCrewStatus(l);assert.equal(a.crewed,value);assert.equal(a.crewEvidence.kind,'official');assert.ok(a.sources[0].url);if(mini)assert.deepEqual(a,mini.withCrewStatus(l));}
 assert.equal(withCrewStatus({...mission(24,2026),name:'神舟二十四号载人飞行任务',originalName:null,mission:{name:'神舟二十四号'}}).crewed,true);
 assert.equal(withCrewStatus({...mission(24,2030),crewed:null}).crewed,null);
 assert.equal(withCrewStatus({...mission(25,2027),crewed:null}).crewed,null);
 assert.equal(withCrewStatus({...mission(24,2026),mission:{name:'神舟23号'}}).crewed,false);
});
test('crew-capable or program wording is not proof of passengers; unmanned takes precedence',()=>{
 assert.equal(officialCrewValue('神舟二十二号载人飞船以无人状态发射，属于载人航天工程'),false);
 assert.equal(officialCrewValue('载人航天工程的天舟十号货运飞船'),false);
 assert.equal(officialCrewValue('神舟二十四号载人飞船转运'),null);
 assert.equal(officialCrewValue('神舟二十三号载人飞行任务，航天员乘组状态良好'),true);
});
test('unknown is not non-crewed and official correction occurs before API filtering',()=>{
 const l=mission(24,2026);assert.equal(filterLaunches([l],new URLSearchParams('crewed=true&days=365')).length,1);
 const unknown={...mission(25,2027),crewed:null};
 assert.equal(filterLaunches([unknown],new URLSearchParams('crewed=false&days=3650')).length,0);
 assert.equal(filterLaunches([unknown],new URLSearchParams('crewed=unknown&days=3650')).length,1);
 const raw={id:'unknown',name:'Example',net:'2026-12-01T00:00:00Z'};assert.equal(normalizeLaunch(raw).crewed,null);
});
