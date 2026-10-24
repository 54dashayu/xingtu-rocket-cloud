import { findSite } from './sites.js?v=20261024ad';
import { solarAltitude } from './solar.js?v=20261024ad';
// Standard apparent sunrise/sunset threshold: solar centre -0.833 degrees.
// Includes typical refraction and solar radius only; excludes terrain and weather.
// NOAA: https://gml.noaa.gov/grad/solcalc/solareqns.PDF
const ZONES = [
 [/酒泉|文昌|太原|西昌|海阳|Jiuquan|Wenchang|Taiyuan|Xichang|Haiyang/i,'Asia/Shanghai'],
 [/肯尼迪|卡纳维拉尔|Kennedy|Cape Canaveral/i,'America/New_York'],
 [/范登堡|Vandenberg/i,'America/Los_Angeles'],[/马希亚|Mahia/i,'Pacific/Auckland'],
 [/库鲁|Kourou|Guiana Space/i,'America/Cayenne'],[/拜科努尔|Baikonur/i,'Asia/Almaty'],
 [/普列谢茨克|Plesetsk/i,'Europe/Moscow'],[/种子岛|Tanegashima/i,'Asia/Tokyo'],
 [/萨蒂什|Satish Dhawan/i,'Asia/Kolkata'],[/罗老|Naro/i,'Asia/Seoul'],
 [/安岛|Andøya/i,'Europe/Oslo'],[/萨克萨沃德|SaxaVord/i,'Europe/London']
];
const cache=new Map();
const formatters=new Map();
export function padTimezone(pad={}) {
  pad ||= {};
  if(pad.timezone){try{new Intl.DateTimeFormat('en',{timeZone:pad.timezone}).format();return {name:pad.timezone,source:'上游发射场时区'};}catch{}}
  const registered=findSite(pad);
  if(registered)return {name:registered.timezone,source:'内置发射场时区'};
  const match=ZONES.find(([pattern])=>pattern.test(`${pad.location || ''} ${pad.originalLocation || ''} ${pad.name || ''}`));
  return match?{name:match[1],source:'内置发射场时区'}:{name:'UTC',source:'当地时区缺失，暂以 UTC 标注'};
}
function localDay(date,timeZone){
  if(!formatters.has(timeZone))formatters.set(timeZone,new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}));
  const parts=formatters.get(timeZone).formatToParts(new Date(date));
  const read=(type)=>parts.find(p=>p.type===type).value;
  return `${read('year')}-${read('month')}-${read('day')}`;
}
export function sunEvents(date,coordinates,timeZone='UTC',threshold=-.833) {
  const ms=typeof date==='number'?date:Date.parse(date);
  if(!Number.isFinite(ms))throw new RangeError('Invalid event date');
  const day=localDay(ms,timeZone),key=`${day}|${timeZone}|${coordinates.latitude}|${coordinates.longitude}|${threshold}`;
  if(cache.has(key))return cache.get(key);
  const midnight=Date.parse(`${day}T00:00:00Z`),step=10*60000;
  const height=(t)=>solarAltitude(t,coordinates.latitude,coordinates.longitude)-threshold;
  const events={date:day,timeZone,sunrise:null,sunset:null,polar:null,threshold};
  let minimum=Infinity,maximum=-Infinity;
  let start=midnight-18*3600000,previous=height(start);
  for(let end=start+step;end<=midnight+42*3600000;end+=step){
    const value=height(end);
    if(localDay(end,timeZone)===day){minimum=Math.min(minimum,value);maximum=Math.max(maximum,value);}
    if((previous<0&&value>=0)||(previous>=0&&value<0)){
      let left=end-step,right=end;
      for(let i=0;i<20;i++){const mid=(left+right)/2;if((height(mid)>=0)===(previous>=0))left=mid;else right=mid;}
      const crossing=Math.round((left+right)/2);
      if(localDay(crossing,timeZone)===day)events[value>previous?'sunrise':'sunset']=new Date(crossing).toISOString();
    }
    previous=value;
  }
  if(!events.sunrise&&!events.sunset)events.polar=minimum>0?'polar_day':maximum<0?'polar_night':'no_crossing';
  if(cache.size>256)cache.clear();cache.set(key,events);return events;
}
export function localSunContext(date,coordinates,pad={}) {
  const zone=padTimezone(pad),events=sunEvents(date,coordinates,zone.name);
  const ms=typeof date==='number'?date:Date.parse(date);
  const nearby=[events];
  // A local day can have just one event at high latitudes. Check adjacent days for nearest event.
  if(!events.polar){nearby.push(sunEvents(ms-86400000,coordinates,zone.name),sunEvents(ms+86400000,coordinates,zone.name));}
  const candidates=nearby.flatMap(e=>['sunrise','sunset'].filter(k=>e[k]).map(kind=>({kind,time:e[kind],minutes:(ms-Date.parse(e[kind]))/60000})));
  candidates.sort((a,b)=>Math.abs(a.minutes)-Math.abs(b.minutes));
  return {...events,timezoneSource:zone.source,nearest:candidates[0] || null};
}
