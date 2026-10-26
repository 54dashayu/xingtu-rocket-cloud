import test from 'node:test';import assert from 'node:assert/strict';
import {archiveMatches,HISTORY_RANGES,observationMatches} from '../public/map/archive-filters.js';
test('observation filters form a union and reports do not imply media confirmation',()=>{
 assert.ok(observationMatches({}));
 assert.ok(observationMatches({reported:true},{reported:true}));
 assert.ok(!observationMatches({reported:true},{media:true}));
 assert.ok(observationMatches({media:true},{reported:true,media:true}));
 assert.ok(!observationMatches({possible:true},{reported:true,media:true}));
 assert.ok(observationMatches({possible:true},{possible:true,media:true}));
});
test('archive filters intersect and do not turn missing values into non-crewed/private',()=>{
 assert.deepEqual(HISTORY_RANGES.map(r=>r.days),[30,90,180,365]);
 const l={country:{code:'CN'},crewed:false,agency:{ownership:'state'}};
 assert.ok(archiveMatches(l,{country:'CN',crewed:'false',ownership:'state'}));
 assert.ok(!archiveMatches(l,{country:'US'}));assert.ok(!archiveMatches(l,{crewed:'true'}));assert.ok(!archiveMatches(l,{ownership:'private'}));
 assert.ok(!archiveMatches({}, {crewed:'false'}));assert.ok(archiveMatches({}, {crewed:'unknown',ownership:'unknown'}));
});
