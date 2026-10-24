import test from 'node:test';
import assert from 'node:assert/strict';
import {solarShadePolygons,solarShadePath} from '../public/map/solar-shade.js';
import {altitudeAt} from '../public/map/solar.js';
function inside([x,y],p){let hit=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const [a,b]=p[i],[c,d]=p[j];if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)hit=!hit;}return hit;}
test('smooth solar masks agree with solar altitude across seasons, poles and dateline',()=>{
 for(const latitude of [-23.44,0,23.44])for(const longitude of [-179,0,179])for(const threshold of [0,-6]){
  const sun={latitude,longitude},polys=solarShadePolygons(sun,threshold);
  for(const lat of [-89,-75,-40,-.3,30,60,89])for(let lon=-179.7;lon<180;lon+=17){
   const altitude=altitudeAt(sun,lat,lon);if(Math.abs(altitude-threshold)<.05)continue;
   assert.equal(polys.some(p=>inside([lon+180,90-lat],p)),altitude<threshold,JSON.stringify({sun,lat,lon,threshold}));
  }
  for(const p of polys)for(const [x,y] of p){assert.ok(x>=0&&x<=360&&y>=0&&y<=180);assert.ok(Number.isFinite(x));}
 }
});
test('twilight mask is the difference of nested night polygons without square cell paths',()=>{
 const sun={latitude:-12,longitude:23},day=solarShadePolygons(sun),night=solarShadePolygons(sun,-6);
 for(let lat=-80;lat<=80;lat+=10)for(let lon=-175;lon<180;lon+=10){
  const alt=altitudeAt(sun,lat,lon);if(Math.min(Math.abs(alt),Math.abs(alt+6))<.05)continue;
  const a=day.some(p=>inside([lon+180,90-lat],p)),b=night.some(p=>inside([lon+180,90-lat],p));
  assert.ok(!b||a);assert.equal(a!==b,alt<0&&alt>=-6);
 }
 assert.ok(!solarShadePath(sun).includes('h2v2'));assert.throws(()=>solarShadePolygons(sun,0,0));
});
