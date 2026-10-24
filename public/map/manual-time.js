// Civil wall-clock conversion through the IANA zone, independent of the browser zone.
const formatters=new Map();
export function localDateTime(instant,zone){
 if(!formatters.has(zone))formatters.set(zone,new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}));
 const parts=formatters.get(zone).formatToParts(new Date(instant)),get=k=>parts.find(p=>p.type===k).value;
 return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}
export function localTimeCandidates(value,zone){
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))return [];
 const seed=Date.parse(value+'Z');if(!Number.isFinite(seed)||new Date(seed).toISOString().slice(0,16)!==value)return [];
 const offsets=new Set();
 // Both sides of nearby DST transitions, including fractional-hour zones.
 for(let hours=-48;hours<=48;hours+=6){const t=seed+hours*3600000;offsets.add(Date.parse(localDateTime(t,zone)+'Z')-t);}
 return [...offsets].map(delta=>seed-delta).filter(t=>localDateTime(t,zone)===value).sort((a,b)=>a-b).map(t=>new Date(t).toISOString());
}
export function simulationLaunch(launch,net){
 if(!Number.isFinite(Date.parse(net)))throw new RangeError('Invalid simulation time');
 return {...launch,manualTime:true,timing:{...launch.timing,net,precision:'手动模拟 · 精确到分钟',windowStart:null,windowEnd:null},scheduleStatus:{code:'confirmed',label:'手动模拟'},result:{code:'pending'},flightProfile:null,trajectory:null,cloudEvidence:null};
}
