import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreObserver,cloudIndex,indexBadge} from '../public/map/cloud-index.js';
const observer={latitude:0,longitude:0};
const samples=(longitude,sunlit=true)=>[0,30,60,90,120].map(t=>({latitude:0,longitude:0,height:150,time:Date.parse('2026-03-20T18:00:00Z')+t*1000,sun:{latitude:0,longitude},sunlit}));
test('dark observers with sunlit high plumes score higher; unlit/daylight stay zero',()=>{
 assert.ok(scoreObserver(samples(100),observer).score>scoreObserver(samples(93),observer).score);
 assert.equal(scoreObserver(samples(80),observer).score,0);
 assert.equal(scoreObserver(samples(100,false),observer).score,0);
 assert.equal(scoreObserver([],observer).score,0);
});
test('index does not turn unknown time or mismatched assessment into zero',()=>{
 const l={timing:{net:'2026-11-07T00:00:00Z',precision:'仅确定日期'}};
 assert.equal(cloudIndex(l).score,null);
 assert.match(indexBadge(l),/待评估/);
 l.timing.precision='精确到分钟';
 assert.equal(cloudIndex(l,{net:'2026-11-08T00:00:00Z'}).score,null);
});
test('population and reports cannot manufacture physical visibility',()=>{
 const a=scoreObserver(samples(80),observer);
 const b=scoreObserver(samples(80),{...observer,population:100000000,reports:999});
 assert.equal(a.score,b.score);
});

import {playbackWindow} from '../public/map/timeline.js';
import {visibilitySamples} from '../public/map/visibility.js';
import {solarPosition} from '../public/map/solar.js';
test('forecast extends retained plume observation without extending the rocket trajectory',()=>{
 const profile={kind:'predicted',duration:120,full:[{seconds:120,height:150,downrange:100,latitude:0,longitude:0}]};
 assert.equal(playbackWindow(profile).end,420);
 const launch={timing:{net:'2026-03-20T18:00:00Z'}};
 const parcels=visibilitySamples(launch,{profile,persistenceSeconds:300,untilSeconds:420}).flat();
 assert.equal(Math.max(...parcels.map(p=>p.age)),300);
 assert.ok(parcels.every(p=>p.height===150&&p.longitude===0));
 assert.equal(profile.full.length,1);
});
test('same observer has darkening sunset and brightening dawn, with no eastward bonus',()=>{
 const make=start=>[0,60,120,180,240,300].map(t=>{const time=Date.parse(start)+t*1000;return {latitude:0,longitude:0,height:150,time,sun:solarPosition(time),sunlit:true};});
 assert.equal(scoreObserver(make('2026-03-20T18:10:00Z'),observer).trend,'天色渐暗');
 assert.equal(scoreObserver(make('2026-03-20T06:00:00Z'),observer).trend,'天色渐亮');
});
