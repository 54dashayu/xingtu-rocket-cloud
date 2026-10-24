import test from 'node:test';
import assert from 'node:assert/strict';
import {tilePlan,tileURL} from '../public/map/tianditu.js';
test('geographic WMTS starts with 2 by 1 tiles covering the globe',()=>{
 const p=tilePlan({left:0,right:360,top:0,bottom:180},1);
 assert.equal(p.zoom,1);assert.equal(p.span,180);assert.deepEqual(p.tiles,[{x:0,y:0},{x:1,y:0}]);assert.equal(p.labels,false);
});
test('dateline wraps columns without repeating tiles or fetching polar overflow',()=>{
 const p=tilePlan({left:350,right:390,top:-40,bottom:200},12);
 assert.equal(p.zoom,4);assert.equal(p.labels,true);
 assert.equal(new Set(p.tiles.map(t=>`${t.x}/${t.y}`)).size,p.tiles.length);
 assert.deepEqual([...new Set(p.tiles.map(t=>t.x))],[15,0,1]);
 assert.ok(p.tiles.every(t=>t.y>=0&&t.y<8));
});
test('off-globe viewport does not request invalid rows',()=>{
 assert.equal(tilePlan({left:0,right:50,top:185,bottom:200},20).tiles.length,0);
});
test('tile URL pairs geographic layer and matrix with encoded browser token',()=>{
 const u=new URL(tileURL('test & token','cva',5,26,5));
 assert.equal(u.hostname,'t0.tianditu.gov.cn');assert.equal(u.pathname,'/cva_c/wmts');
 assert.equal(u.searchParams.get('TILEMATRIXSET'),'c');assert.equal(u.searchParams.get('tk'),'test & token');
});
