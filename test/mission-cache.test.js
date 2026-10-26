import test from 'node:test';
import assert from 'node:assert/strict';
import {createMissionCache} from '../public/map/mission-cache.js';
import {chineseMissionLabel} from '../public/mission-labels.js';
import {translateMissionName,translateRocket} from '../src/translate.js';
test('preload and replay share one request, refresh and expiry renew it',async()=>{
 let calls=0,now=0;
 const read=createMissionCache(async()=>{calls++;return{ok:true,json:async()=>({results:[]})};},()=>now);
 const a=read('/history'),b=read('/history');assert.equal(a,b);await a;
 await read('/history');assert.equal(calls,1);
 await read('/history',{force:true});assert.equal(calls,2);
 now=300001;await read('/history');assert.equal(calls,3);
});
test('failed preloads can retry',async()=>{
 let count=0;const read=createMissionCache(async()=>({ok:++count>1,status:503,json:async()=>({results:[]})}));
 await assert.rejects(read('/history'));await read('/history');assert.equal(count,2);
});
test('calendar and map use the same Smart Dragon and SatNet Chinese names',()=>{
 assert.equal(chineseMissionLabel('Smart Dragon 3 | SatNet test satellite'),'捷龙三号 | 卫星互联网技术试验卫星');
 assert.equal(translateMissionName('Smart Dragon 3 | SatNet test satellite'),'捷龙三号｜卫星互联网技术试验卫星');
 assert.equal(translateRocket('Smart Dragon 3'),'捷龙三号');
 assert.equal(chineseMissionLabel('Unknown test name'),'Unknown test name');
});
