import test from 'node:test';
import assert from 'node:assert/strict';
import { regionEdges,trajectoryStyle } from '../public/map/overlay-style.js';
test('viewing area outline removes shared edges but preserves disconnected components',()=>{
 assert.equal(regionEdges([]).length,0);
 assert.equal(regionEdges([{latitude:.5,longitude:.5}]).length,4);
 assert.equal(regionEdges([{latitude:.5,longitude:.5},{latitude:.5,longitude:1.5}]).length,6);
 assert.equal(regionEdges([{latitude:.5,longitude:.5},{latitude:.5,longitude:2.5}]).length,8);
 const block=[{latitude:.5,longitude:.5},{latitude:.5,longitude:1.5},{latitude:1.5,longitude:.5},{latitude:1.5,longitude:1.5}];assert.equal(regionEdges(block).length,8);
});
test('region boundary wraps at dateline instead of outlining a false seam',()=>assert.equal(regionEdges([{latitude:.5,longitude:179.5},{latitude:.5,longitude:-179.5}]).length,6));
test('historical predictions are labelled model calculations, not measured or verified tracks',()=>{
 assert.equal(trajectoryStyle('predicted',true).label,'上升轨迹模拟');assert.match(trajectoryStyle('predicted',false).label,/预测/);
 assert.match(trajectoryStyle('measured',true).label,/实测/);assert.notEqual(trajectoryStyle('predicted',true).color,trajectoryStyle('measured',true).color);assert.equal(trajectoryStyle('measured',true).dash,null);
});
