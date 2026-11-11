import test from 'node:test';
import assert from 'node:assert/strict';
import {placeLabel,createPlaceLookup} from '../public/map/weather-place.js';
test('weather coordinates get administrative names without moving the sample',()=>{
 assert.equal(placeLabel({status:'0',result:{addressComponent:{nation:'中国',province:'陕西省',city:'安康市',county:'宁陕县'}}}),'陕西省 · 安康市 · 宁陕县');
 assert.equal(placeLabel({status:'0',result:{addressComponent:{nation:'泰国',city:'乌汶'}}}),'泰国 · 乌汶');
 assert.equal(placeLabel({status:'1'}),null);
});
test('place lookups coalesce, cache successful names, and fail without breaking weather',async()=>{
 let calls=0;const values=new Map();
 const lookup=createPlaceLookup({storage:{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)},fetcher:async u=>{calls++;return {ok:true,json:async()=>String(u).includes('map-config')?{token:'test'}:{status:'0',result:{addressComponent:{city:'测试城市'}}}}}});
 assert.deepEqual(await Promise.all([lookup(33.5,108.5),lookup(33.5,108.5)]),['测试城市','测试城市']);
 assert.equal(calls,2);await lookup(33.5,108.5);assert.equal(calls,2);
 assert.equal(await lookup(91,100),null);
 const offline=createPlaceLookup({storage:null,fetcher:async()=>{throw Error('offline')}});
 assert.equal(await offline(33.5,108.5),null);
});
