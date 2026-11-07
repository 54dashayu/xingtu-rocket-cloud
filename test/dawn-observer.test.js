import test from 'node:test';
import assert from 'node:assert/strict';
import {parcelVisibility,observerVisibility,visibilityFootprint,skySunAltitudeLimit} from '../public/map/visibility.js';
import {scoreObserver} from '../public/map/cloud-index.js';
import {observe} from '../prototypes/rocket-cloud-3d/geometry.js';
import {observerWeather} from '../src/observer-weather.js';
import {weatherAt} from '../src/weather.js';
import {observerWeatherRequest,createObserverWeatherController} from '../prototypes/rocket-cloud-3d/observer-weather.js';
const o={latitude:0,longitude:0};
const point=(lon,sunlon)=>({latitude:0,longitude:lon,height:150,sunlit:true,time:0,sun:{latitude:0,longitude:sunlon}});
test('sunward twilight is stricter, dawn/dusk mirror and deep darkness remains eligible',()=>{
 assert.equal(parcelVisibility(o,point(5,93)).possible,false);
 assert.equal(parcelVisibility(o,point(-5,93)).possible,true);
 assert.equal(parcelVisibility(o,point(5,-93)).possible,true);
 assert.equal(parcelVisibility(o,point(-5,-93)).possible,false);
 assert.equal(parcelVisibility(o,point(5,98)).possible,true);
 assert.equal(parcelVisibility(o,point(-5,89)).possible,false);
 assert.equal(parcelVisibility(o,{...point(-5,93),sunlit:false}).possible,false);
 assert.equal(parcelVisibility(o,{...point(-5,93),height:1}).possible,false);
 for(let a=1;a<=180;a++)assert.ok(skySunAltitudeLimit(a)>=skySunAltitudeLimit(a-1));
});
test('dawn brightening closes sunward window first; observer, 3D and index agree',()=>{
 const east=[98,97,96,95,94,93,92].map((s,i)=>({...point(5,s),time:i*30000}));
 const west=east.map(p=>({...p,longitude:-5}));
 assert.ok(observerVisibility([east],o).lastTime<observerVisibility([west],o).lastTime);
 assert.ok(scoreObserver(east,o).score<scoreObserver(west,o).score);
 for(const p of [...east,...west])assert.equal(observe({sun:p.sun,parcels:[p]},o).eligible.length>0,observerVisibility([[p]],o).possible);
});
test('weather request uses applied observer and first candidate time, fallback is explicitly launch time',()=>{
 const scenario={launch:{timing:{net:'2026-11-07T00:00:00Z'}}};
 const r=observerWeatherRequest(scenario,{latitude:31,longitude:121},{possible:true,windows:[{start:120}]});
 assert.equal(r.params.get('latitude'),'31');assert.equal(r.params.get('longitude'),'121');
 assert.equal(r.time,'2026-11-07T00:02:00.000Z');assert.equal(r.hasWindow,true);
 assert.equal(observerWeatherRequest(scenario,o,{possible:false,windows:[]}).hasWindow,false);
});
test('observer weather endpoint validates coordinates, uses one location and respects disabled platform',async()=>{
 let calls=0;const provider=async(points,time)=>{calls++;assert.deepEqual(points,[{latitude:31,longitude:121}]);assert.equal(time,'2026-11-07T00:02:00.000Z');return {status:'available',points};};
 const params=new URLSearchParams({latitude:'31',longitude:'121',time:'2026-11-07T08:02:00+08:00'});
 const r=await observerWeather(params,{weatherProvider:provider});assert.equal(r.scope,'observer');assert.equal(calls,1);
 await observerWeather(params,{weatherEnabled:false,weatherProvider:provider});assert.equal(calls,1);
 for(const [key,value] of [['latitude',''],['longitude','181'],['time','2026-11-07T08:02:00']]){const bad=new URLSearchParams(params);bad.set(key,value);await assert.rejects(observerWeather(bad,{weatherProvider:provider}),RangeError);}
});
test('changing observer rejects late results; playback does not trigger per-frame weather',async()=>{
 const results=[],pending=[];let calls=0;
 const ctl=createObserverWeatherController({render:r=>results.push(r),fetcher:async(url,options)=>{calls++;return new Promise(resolve=>pending.push({url,options,resolve}));}});
 const s={launch:{timing:{net:'2026-11-07T00:00:00Z'}}},w={possible:true,windows:[{start:100}]};
 const first=ctl.update(s,o,w,'旧地点');const second=ctl.update(s,{latitude:31,longitude:121},w,'新地点');
 assert.equal(pending[0].options.signal.aborted,true);assert.match(pending[1].url,/latitude=31&longitude=121/);
 pending[1].resolve({ok:true,json:async()=>({points:[]})});await second;
 pending[0].resolve({ok:true,json:async()=>({points:[]})});await first;
 assert.deepEqual(results.filter(r=>r.state==='ready').map(r=>r.name),['新地点']);assert.equal(calls,2);
 ctl.clear();
 const disabled=createObserverWeatherController({enabled:false,render:()=>{},fetcher:()=>{throw Error('must not call');}});await disabled.update(s,o,w);
});
test('weather cache cannot reuse previous hour from same day/location',async()=>{
 const base=Date.parse('2026-11-07T00:00:00Z')/1000,points=[{latitude:23.123,longitude:112.456}];
 const options={now:Date.parse('2026-11-06T00:00:00Z'),fetcher:async()=>({ok:true,json:async()=>({hourly:{time:[base,base+3600],cloud_cover:[10,95],precipitation:[0,0]}})})};
 const first=await weatherAt(points,'2026-11-07T00:00:00Z',options),second=await weatherAt(points,'2026-11-07T01:00:00Z',options);
 assert.equal(first.points[0].code,'clearer');assert.equal(second.points[0].code,'obstructed');
});
