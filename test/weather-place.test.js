import test from 'node:test';
import assert from 'node:assert/strict';
import {placeLabel,createPlaceLookup,fallbackPlace,weatherLocationHTML,installWeatherPlaces} from '../public/map/weather-place.js';
const options={storage:null,paceMs:0,sleep:async()=>{}};
const offline=async()=>{throw Error('offline');};
const good=city=>({status:'0',result:{addressComponent:{nation:'中国',province:'陕西省',city,county:'宁陕县',town:'某乡'}}});
test('prefer short city or broad region, never append county/town chain',()=>{
 assert.equal(placeLabel(good('安康市')),'安康市');
 assert.equal(placeLabel(good('市辖区')),'陕西省');
 assert.equal(placeLabel({status:'0',result:{addressComponent:{nation:'泰国',city:'乌汶'}}}),'泰国 · 乌汶');
 assert.equal(placeLabel({status:'1'}),null);
});
test('offline city reference uses original point and includes distance; far points stay coordinates',()=>{
 const p=fallbackPlace(33.5,108.5);assert.match(p.label,/西安.*约\d+公里/);assert.equal(p.coordinates,'33.5000°, 108.5000°');
 assert.match(fallbackPlace(39.90,116.40).label,/北京/);
 const ocean=fallbackPlace(0,-140);assert.equal(ocean.kind,'coordinates');assert.match(ocean.note,/覆盖不足/);assert.doesNotMatch(ocean.label,/附近|周边/);
 for(const [lat,lon] of [[NaN,0],[null,0],[0,Infinity],[91,0],[0,181]])assert.equal(fallbackPlace(lat,lon).kind,'invalid');
});
test('failed reverse geocode retains local reference and never requests weather at city centre',async()=>{
 const urls=[];const lookup=createPlaceLookup({...options,fetcher:async u=>{urls.push(String(u));return String(u).includes('map-config')?{ok:true,json:async()=>({token:'test'})}:{ok:false,status:429};}});
 const p=await lookup(33.5,108.5);assert.equal(p.kind,'city_reference');assert.match(p.label,/西安/);
 const q=JSON.parse(new URL(urls[1]).searchParams.get('postStr'));assert.equal(q.lat,33.5);assert.equal(q.lon,108.5);assert.equal(urls.length,2);
 assert.equal((await createPlaceLookup({...options,fetcher:offline})(0,-140)).kind,'coordinates');
});
test('duplicate lookups coalesce and structured cache ignores old v1 entries',async()=>{
 let calls=0;const values=new Map([['weather-place-v1:33.5000,108.5000','旧县乡长名称']]);
 const lookup=createPlaceLookup({...options,storage:{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)},fetcher:async u=>{calls++;return {ok:true,json:async()=>String(u).includes('map-config')?{token:'test'}:good('安康市')};}});
 const result=await Promise.all([lookup(33.5,108.5),lookup(33.5,108.5)]);assert.deepEqual(result.map(x=>x.label),['安康市','安康市']);assert.equal(calls,2);
 await lookup(33.5,108.5);assert.equal(calls,2);await lookup(91,100);assert.equal(calls,2);
});
test('fallback cache expires for recovery and remote batches are serial',async()=>{
 let now=0,fail=true,calls=0,active=0,max=0;
 const lookup=createPlaceLookup({...options,now:()=>now,fetcher:async u=>{
  if(String(u).includes('map-config'))return {ok:true,json:async()=>({token:'test'})};
  calls++;active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,5));active--;return {ok:!fail,json:async()=>good('安康市')};
 }});
 await Promise.all([lookup(33.5,108.5),lookup(34,109)]);assert.equal(max,1);assert.equal(calls,2);
 fail=false;await lookup(33.5,108.5);assert.equal(calls,2);now=300001;
 assert.equal((await lookup(33.5,108.5)).kind,'geocoded');assert.equal(calls,3);
});
test('HTML keeps raw coordinate tooltip and never mutates weather sample',()=>{
 const point={latitude:33.5,longitude:108.5,values:{cloud_cover:14}};const before=JSON.stringify(point),html=weatherLocationHTML(point);
 assert.match(html,/data-lat="33.5"/);assert.match(html,/data-lon="108.5"/);assert.match(html,/title="33.5000/);assert.match(html,/西安/);assert.equal(JSON.stringify(point),before);
});
test('task switch and reused nodes cannot receive a stale asynchronous label',async()=>{
 const node={dataset:{lat:'33.5',lon:'108.5'},isConnected:true,textContent:'new task'};let finish;
 class Details extends EventTarget{open=true;isConnected=true;querySelectorAll(){return [node];}}
 const details=new Details();installWeatherPlaces(details,{lookup:()=>new Promise(r=>{finish=r;})});
 node.dataset.lat='40';finish({label:'stale',coordinates:'old',note:'old'});await new Promise(r=>setTimeout(r,0));assert.equal(node.textContent,'new task');
});
test('cancelled old task queue is retried for a current task sharing the same point',async()=>{
 let alive=true,calls=0;
 const lookup=createPlaceLookup({...options,fetcher:async u=>{calls++;return {ok:true,json:async()=>String(u).includes('map-config')?{token:'test'}:good('安康市')};}});
 const old=lookup(33.5,108.5,{isCurrent:()=>alive});alive=false;
 const current=lookup(33.5,108.5);
 assert.equal((await old).cancelled,true);assert.equal((await current).label,'安康市');assert.equal(calls,2);
});
