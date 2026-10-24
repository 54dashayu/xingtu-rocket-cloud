import test from 'node:test';
import assert from 'node:assert/strict';
import {acceleration,ascentToHeight,integrateAscent,engineState,stageSchedule,REFERENCE_VEHICLE as vehicle,EARTH_RADIUS as R,MU,OMEGA} from '../public/map/ascent-dynamics.js';
import {HEIGHT_PRESETS,DEFAULT_HEIGHT} from '../public/map/height-presets.js';
const origin={latitude:38.85,longitude:111.61};
test('gravity, centrifugal and Coriolis terms have correct magnitude and sign',()=>{
 const options={mass:1000,thrust:0,pitch:0,tangent:[0,1,0],cdArea:0,omega:0};
 const a=acceleration([R,0,0],[0,0,0],options);assert.ok(Math.abs(a[0]+MU/R**2)<1e-12);
 const rotating=acceleration([R,0,0],[0,100,0],{...options,omega:OMEGA});
 assert.ok(Math.abs(rotating[0]-a[0]-OMEGA**2*R-2*OMEGA*100)<1e-12);
 const high=acceleration([R+150000,0,0],[0,0,0],options);assert.ok(Math.abs(high[0])<Math.abs(a[0]));
});
test('drag dissipates velocity and decays with altitude',()=>{
 const o={mass:1000,thrust:0,pitch:0,tangent:[0,1,0],omega:0};
 const low=acceleration([R,0,0],[0,100,0],o),high=acceleration([R+100000,0,0],[0,100,0],o);
 assert.ok(low[1]<0&&Math.abs(high[1])<Math.abs(low[1])/10000);
});
test('mass and engine events conserve propellant and separate stages without negative mass',()=>{
 const s=stageSchedule(),before=engineState(s.separation-1e-7),after=engineState(s.separation);
 assert.ok(Math.abs(before.mass-after.mass-vehicle.stage1Dry)<.001);
 assert.equal(after.thrust,0);assert.equal(engineState(s.ignition).thrust,vehicle.thrust2);
 assert.ok(Math.abs(engineState(s.cutoff).mass-25000)<1e-7);assert.equal(engineState(s.cutoff+10).thrust,0);
});
test('RK4 converges when halving time step, and produces nonlinear non-constant climb',()=>{
 for(const h of [100,150,200]){
 const a=ascentToHeight(origin,225,h),b=ascentToHeight(origin,225,h,{step:.25});
 assert.ok(a.reached&&b.reached);assert.ok(Math.abs(a.duration-b.duration)<.05);assert.ok(Math.abs(a.range-b.range)<.05);
 assert.equal(a.full.at(-1).height,h);
 for(const p of a.full)assert.ok(p.height>=0&&p.downrange>=0&&Number.isFinite(p.verticalSpeed));
 }
 const p=integrateAscent(origin,225),at=t=>p.find(p=>p.seconds>=t);
 assert.equal(p[0].speed,0);assert.ok(at(60).verticalSpeed>at(20).verticalSpeed*2);
 assert.ok(at(200).verticalSpeed<at(140).verticalSpeed);
 for(let i=1;i<p.length;i++)assert.ok(p[i].seconds>p[i-1].seconds&&p[i].downrange>=p[i-1].downrange);
});
test('UI uses two observation cutoffs; solver is deterministic and handles geographic seams',()=>{
 assert.deepEqual(HEIGHT_PRESETS.map(x=>x.height),[100,150]);assert.equal(DEFAULT_HEIGHT,150);
 for(const o of [{latitude:0,longitude:179.9},{latitude:70,longitude:-179.9}])for(const b of [0,90,180,270]){
 const p=ascentToHeight(o,b,150);assert.ok(p.reached);assert.deepEqual(p,ascentToHeight(o,b,150));
 for(const q of p.full)assert.ok(Math.abs(q.latitude)<=90&&Math.abs(q.longitude)<=180);
 }
 for(const step of [0,NaN,3])assert.throws(()=>integrateAscent(origin,225,{step}));
});
