// Generic two-stage reference scenario, NOT a vehicle specification or telemetry.
// ECEF Cartesian integration (SI): thrust + gravity + drag - Coriolis - centrifugal.
// See docs/MODEL.md for equations, parameters and limitations.
export const EARTH_RADIUS=6371000, MU=3.986004418e14, OMEGA=7.292115e-5, G0=9.80665;
export const REFERENCE_VEHICLE=Object.freeze({
 mass:500000,stage1Propellant:350000,stage1Dry:25000,
 thrust1:7200000,isp1:300,thrust2:1000000,isp2:340,
 stage2Propellant:100000,coastSeconds:4,cdArea:7,
 // Smooth commanded pitch from local horizontal; not a recovered mission guidance law.
 pitch:[[0,90],[12,90],[35,75],[70,55],[120,35],[180,22],[300,12],[450,5]]
});
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),norm=a=>Math.hypot(...a);
const mul=(a,k)=>a.map(v=>v*k),add=(a,b)=>a.map((v,i)=>v+b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>mul(a,1/norm(a));
export function stageSchedule(v=REFERENCE_VEHICLE){
 const flow1=v.thrust1/(v.isp1*G0),flow2=v.thrust2/(v.isp2*G0);
 const separation=v.stage1Propellant/flow1,ignition=separation+v.coastSeconds,cutoff=ignition+v.stage2Propellant/flow2;
 return {flow1,flow2,separation,ignition,cutoff};
}
export function engineState(t,v=REFERENCE_VEHICLE){
 const s=stageSchedule(v);
 if(t<s.separation)return {mass:v.mass-s.flow1*t,thrust:v.thrust1,stage:1};
 const upper=v.mass-v.stage1Propellant-v.stage1Dry;
 if(t<s.ignition)return {mass:upper,thrust:0,stage:0};
 if(t<s.cutoff)return {mass:upper-s.flow2*(t-s.ignition),thrust:v.thrust2,stage:2};
 return {mass:upper-v.stage2Propellant,thrust:0,stage:0};
}
export function commandedPitch(t,knots=REFERENCE_VEHICLE.pitch){
 const end=knots.findIndex(p=>p[0]>=t);
 if(end<0)return knots.at(-1)[1];if(end===0)return knots[0][1];
 const a=knots[end-1],b=knots[end],u=(t-a[0])/(b[0]-a[0]),s=u*u*(3-2*u);
 return a[1]+s*(b[1]-a[1]);
}
export function acceleration(position,velocity,{mass,thrust,pitch,tangent,cdArea=7,omega=OMEGA}){
 const r=norm(position),up=mul(position,1/r),height=Math.max(0,r-EARTH_RADIUS);
 const horizontal=unit(add(tangent,mul(up,-dot(tangent,up))));
 const direction=add(mul(up,Math.sin(pitch)),mul(horizontal,Math.cos(pitch)));
 const density=1.225*Math.exp(-height/8500),speed=norm(velocity);
 const w=[0,0,omega];
 return add(add(mul(up,-MU/(r*r)),mul(direction,thrust/mass)),
  add(mul(velocity,-.5*density*cdArea*speed/mass),add(mul(cross(w,velocity),-2),mul(cross(w,cross(w,position)),-1))));
}
const rk4=(y,dt,f)=>{
 const a=f(y,0),b=f(add(y,mul(a,dt/2)),dt/2),c=f(add(y,mul(b,dt/2)),dt/2),d=f(add(y,mul(c,dt)),dt);
 return y.map((v,i)=>v+dt*(a[i]+2*b[i]+2*c[i]+d[i])/6);
};
const cache=new Map();
export function integrateAscent(origin,azimuth,{step=.5,maxSeconds=600,vehicle=REFERENCE_VEHICLE,omega=OMEGA}={}){
 if(!Number.isFinite(origin?.latitude)||Math.abs(origin.latitude)>90||!Number.isFinite(origin?.longitude)||Math.abs(origin.longitude)>180||!Number.isFinite(azimuth)||azimuth<0||azimuth>=360||!Number.isFinite(step)||step<=0||step>2||!Number.isFinite(maxSeconds)||maxSeconds<=0||maxSeconds>1200)throw new RangeError('Invalid ascent parameters');
 const key=JSON.stringify([origin.latitude,origin.longitude,azimuth,step,maxSeconds,vehicle,omega]);
 if(cache.has(key))return cache.get(key);
 const rad=Math.PI/180,lat=origin.latitude*rad,lon=origin.longitude*rad,bearing=azimuth*rad;
 const initial=[Math.cos(lat)*Math.cos(lon),Math.cos(lat)*Math.sin(lon),Math.sin(lat)];
 const north=[-Math.sin(lat)*Math.cos(lon),-Math.sin(lat)*Math.sin(lon),Math.cos(lat)],east=[-Math.sin(lon),Math.cos(lon),0];
 const tangent=add(mul(north,Math.cos(bearing)),mul(east,Math.sin(bearing))),plane=unit(cross(initial,tangent));
 const schedule=stageSchedule(vehicle),events=[schedule.separation,schedule.ignition,schedule.cutoff];
 let y=[...mul(initial,EARTH_RADIUS),0,0,0],time=0,path=0,previous=initial;
 const points=[];
 const sample=()=>{const position=y.slice(0,3),r=norm(position),u=mul(position,1/r);
 path+=EARTH_RADIUS*Math.atan2(norm(cross(previous,u)),Math.max(-1,Math.min(1,dot(previous,u))));previous=u;
 points.push({seconds:time,height:Math.max(0,(r-EARTH_RADIUS)/1000),downrange:path/1000,latitude:Math.asin(u[2])/rad,longitude:Math.atan2(u[1],u[0])/rad,speed:norm(y.slice(3))/1000,verticalSpeed:dot(y.slice(3),u)/1000,stage:engineState(time,vehicle).stage});};
 sample();
 while(time<maxSeconds-1e-8){
 const boundary=events.find(t=>t>time+1e-8)??Infinity,dt=Math.min(step,maxSeconds-time,boundary-time);
 // Evaluate the stage on this interval; do not smear a mass/thrust jump across RK4 stages.

 const f=(state,delta)=>{let engine=engineState(time+delta,vehicle);
 if(delta===dt&&time+dt===boundary)engine=engineState(time+dt-1e-7,vehicle);
 const pos=state.slice(0,3),vel=state.slice(3),up=unit(pos),heading=unit(cross(plane,up));
 return [...vel,...acceleration(pos,vel,{...engine,pitch:commandedPitch(time+delta,vehicle.pitch)*rad,tangent:heading,cdArea:vehicle.cdArea,omega})];};
 y=rk4(y,dt,f);time+=dt;sample();
 if(points.at(-1).height>250||time>15&&norm(y.slice(0,3))<EARTH_RADIUS||time>schedule.cutoff&&points.at(-1).verticalSpeed<0)break;
 }
 if(cache.size>96)cache.clear();cache.set(key,points);return points;
}
// Dense integration output: interpolation only bridges <=0.5 s, not ascent anchor segments.
export function interpolateState(a,b,time){const u=(time-a.seconds)/(b.seconds-a.seconds),p={};for(const k of ['height','downrange','latitude','speed','verticalSpeed'])p[k]=a[k]+u*(b[k]-a[k]);const d=((b.longitude-a.longitude+540)%360)-180;p.longitude=((a.longitude+u*d+540)%360)-180;return {...p,seconds:time,stage:a.stage};}
export function ascentToHeight(origin,azimuth,target,options={}){
 const raw=integrateAscent(origin,azimuth,options),i=raw.findIndex(p=>p.height>=target);
 if(i<1)return {raw,full:[],reached:false,duration:raw.at(-1).seconds};
 const a=raw[i-1],b=raw[i],time=a.seconds+(target-a.height)/(b.height-a.height)*(b.seconds-a.seconds),end={...interpolateState(a,b,time),height:target};
 const full=[];let j=1;
 for(let t=0;t<time;t+=2){while(raw[j].seconds<t)j++;full.push(interpolateState(raw[j-1],raw[j],t));}
 // Include lower cut-off crossings so height presets share exactly the same prefix.
 for(const h of [100,150,200].filter(h=>h<target)){
  const k=raw.findIndex(p=>p.height>=h);if(k<1)continue;
  const a=raw[k-1],b=raw[k],t=a.seconds+(h-a.height)/(b.height-a.height)*(b.seconds-a.seconds);
  if(!full.some(p=>Math.abs(p.seconds-t)<1e-8))full.push({...interpolateState(a,b,t),height:h});
 }
 full.push(end);full.sort((a,b)=>a.seconds-b.seconds);return {raw,full,reached:true,duration:time,range:end.downrange};
}
