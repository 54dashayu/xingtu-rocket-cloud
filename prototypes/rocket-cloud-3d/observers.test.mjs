import test from 'node:test';
import assert from 'node:assert/strict';
import {nearestObserverCity} from './observers.js';
test('default observer follows nearby Chinese launch cities',()=>{
 assert.equal(nearestObserverCity({latitude:28.25,longitude:102.03}).name,'西昌');
 assert.equal(nearestObserverCity({latitude:19.61,longitude:110.95}).name,'文昌');
});
test('overseas missions choose local cities, not Chinese defaults',()=>{
 assert.equal(nearestObserverCity({latitude:34.63,longitude:-120.61}).name,'隆波克');
 assert.equal(nearestObserverCity({latitude:28.56,longitude:-80.57}).name,'泰特斯维尔');
});
test('missing nearby catalogue or invalid coordinates cannot imply a nearby city',()=>{
 assert.equal(nearestObserverCity({latitude:0,longitude:0}),null);
 assert.equal(nearestObserverCity({latitude:NaN,longitude:0}),null);
 assert.equal(nearestObserverCity({latitude:91,longitude:0}),null);
});
