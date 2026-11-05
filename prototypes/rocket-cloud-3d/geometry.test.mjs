import test from 'node:test';
import assert from 'node:assert/strict';
import {safeCameraPosition,pair,frame,footprint,xyz,earthBlocked,elevationAt,observe} from './geometry.js';
import {isSunlit} from '../../public/map/model.js';
const site={latitude:40.96,longitude:100.29,timezone:'Asia/Shanghai'};
const scenarios=pair(site,'2026-11-04',90);
test('shared dawn/dusk regression: same trajectory, 153 vs 270 grid cells',()=>{assert.deepEqual(scenarios[0].profile.full,scenarios[1].profile.full);assert.deepEqual(scenarios.map(s=>footprint(s).cells.length),[153,270]);});
test('parcels are never emitted early; expire after 300 seconds and after reference end',()=>{const s=scenarios[1];assert.equal(frame(s,0).parcels.length,0);for(let t=0;t<=s.end;t+=17)for(const p of frame(s,t).parcels){assert.ok(p.seconds<=t);assert.ok(p.age>=0&&p.age<=300);assert.notEqual(p.emitting,false);}assert.equal(frame(s,s.end+.01).parcels.length,0);});
test('Cartesian sphere obstruction agrees with spherical elevation for near and far observers',()=>{for(let lon=-180;lon<=180;lon+=7)for(const height of [1,50,150]){const o={latitude:36,longitude:lon},p={latitude:41,longitude:110,height};assert.equal(earthBlocked(o,p),elevationAt(o,p)<0);}});
test('Cartesian parallel sunlight agrees with shared shadow geometry',()=>{const sun={latitude:-15,longitude:80},sv=xyz(sun);for(let lon=-180;lon<=180;lon+=5){const p={latitude:40,longitude:lon,height:150},v=xyz(p),d=v.reduce((a,x,i)=>a+x*sv[i],0);assert.equal(isSunlit(sun,p,150),d>=0||v.reduce((a,x)=>a+x*x,0)-d*d>1);}});
test('exaggeration is visual only and no physical geometry state is mutated',()=>{const s=scenarios[1],f=frame(s,220),before=JSON.stringify(f),p=f.parcels.at(-1);assert.ok(Math.hypot(...xyz(p,12))>Math.hypot(...xyz(p)));assert.equal(JSON.stringify(f),before);const obs=observe(f,site);for(const r of obs.eligible){assert.ok(!r.blocked&&r.elevation>=5&&r.p.sunlit&&obs.sunAltitude<=-1);}});

import {observationWindow} from './geometry.js';
import {flightEvents} from './events.js';
test('whole-window conclusion stays possible while current time has no trail',()=>{const s=scenarios[1],observer={latitude:36.06,longitude:103.83};assert.equal(observe(frame(s,0),observer).eligible.length,0);const w=observationWindow(s,observer);assert.equal(w.possible,true);assert.ok(w.windows.every(x=>x.start>=0&&x.end<=s.end&&x.end>=x.start));assert.equal(observe(frame(s,s.end+1),observer).eligible.length,0);assert.ok(w.maxElevation>=5);});
test('whole window rejects a far observer and does not change with visual height',()=>{const w=observationWindow(scenarios[1],{latitude:-40,longitude:-80});assert.equal(w.possible,false);assert.deepEqual(w.windows,[]);});
test('fairing and payload estimates carry assumptions and never invent off-segment positions',()=>{const e=flightEvents(scenarios[1].profile),fairing=e.find(x=>x.id==='fairing'),payload=e.find(x=>x.id==='payload');assert.ok(Math.abs(fairing.point.height-100)<1e-7);assert.equal(fairing.origin,'estimate');assert.match(fairing.reason,/教学假设/);assert.equal(payload.point,null);assert.match(payload.reason,/60秒/);});

test('camera remains outside Earth through a full low orbit around launch target',()=>{
 for(let i=0;i<=720;i++){const a=i*Math.PI/360,p={x:.48*Math.sin(a),y:0,z:.95+.48*Math.cos(a)},safe=safeCameraPosition(p);assert.ok(Math.hypot(safe.x,safe.y,safe.z)>=1.015-1e-12);if(Math.hypot(p.x,p.y,p.z)>=1.015)assert.deepEqual(safe,p);}
 const center=safeCameraPosition({x:0,y:0,z:0});assert.equal(center.z,1.015);
});
