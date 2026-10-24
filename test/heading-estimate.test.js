import test from 'node:test';
import assert from 'node:assert/strict';
import { headingEstimate, inclinationHeading } from '../public/map/heading-estimate.js';
test('task heading evidence takes priority over orbit estimates, unconfirmed 90 is not treated as evidence',()=>{
 const l={siteId:'vandenberg',coordinates:{latitude:34.6},mission:{orbit:'Low Earth Orbit'},direction:{kind:'unconfirmed',azimuth:90}};
 assert.equal(headingEstimate(l).azimuth,180);assert.equal(headingEstimate(l).kind,'estimated');
 for(const kind of ['reported_sector','sourced_heading'])assert.equal(headingEstimate({...l,direction:{kind,azimuth:225}}).azimuth,225);
 assert.equal(headingEstimate({...l,mission:{orbit:'Unknown',type:'Earth Science'}}).kind,'fallback');
});
test('explicit orbit classes select labelled assumptions, not fabricated mission inclinations',()=>{
 const l={coordinates:{latitude:38.8},siteId:'taiyuan'};
 const sso=headingEstimate({...l,mission:{orbit:'Sun-Synchronous Orbit'}});
 assert.ok(sso.azimuth>180&&sso.azimuth<200);assert.match(sso.basis,/参考倾角 98/);
 assert.equal(headingEstimate({...l,mission:{orbit:'Polar Orbit'}}).azimuth,180);
 assert.equal(headingEstimate({...l,siteId:'andoya',mission:{orbit:'Polar Orbit'}}).azimuth,0);
 assert.equal(headingEstimate({...l,mission:{orbit:'Geostationary Transfer Orbit'}}).azimuth,90);
 assert.equal(headingEstimate({...l,mission:{inclination:5}}).kind,'fallback');
 assert.equal(inclinationHeading(30,30),90);assert.equal(inclinationHeading(38,5),null);assert.equal(inclinationHeading(90,90),null);
});
