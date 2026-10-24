// Public Open-Meteo APIs. Hourly estimates evaluate viewing conditions, not plume formation.
const DAY=86400000, cache=new Map(),pending=new Map();
export function weatherRoute(time,now=Date.now()){
 const t=Date.parse(time),today=Math.floor(now/DAY)*DAY;
 if(!Number.isFinite(t))return {status:'pending_time',label:'时刻待定'};
 if(t>=today+16*DAY)return {status:'outside_horizon',label:'天气待更新（超出16天预报范围）'};
 return t<today-5*DAY?{status:'ready',kind:'reanalysis',label:'历史再分析',base:'https://archive-api.open-meteo.com/v1/archive'}:
 t<now?{status:'ready',kind:'recent_model',label:'近期历史模式估计',base:'https://api.open-meteo.com/v1/forecast'}:
 {status:'ready',kind:'forecast',label:'天气预报',base:'https://api.open-meteo.com/v1/forecast'};
}
export function weatherVerdict(values){
 const cloud=values.cloud_cover, rain=values.precipitation;
 if(!Number.isFinite(cloud)||!Number.isFinite(rain))return {code:'missing',label:'天气数据缺测'};
 // Transparent screening rules, not calibrated detection probabilities.
 if(cloud>=80||rain>=1||Number.isFinite(values.visibility)&&values.visibility<5000)return {code:'obstructed',label:'遮挡风险较高'};
 if(cloud<=30&&rain<0.1&&(!Number.isFinite(values.visibility)||values.visibility>=10000))return {code:'clearer',label:'遮挡较少'};
 return {code:'mixed',label:'天气条件一般'};
}
export async function weatherAt(points,time,{now=Date.now(),fetcher=fetch}={}){
 const route=weatherRoute(time,now);
 if(route.status!=='ready')return {...route,points:[]};
 if(!points.length)return {status:'not_requested',label:'无可评估观测点',points:[]};
 const fields=['cloud_cover','cloud_cover_low','cloud_cover_mid','cloud_cover_high','precipitation','wind_speed_10m',...(route.kind==='reanalysis'?[]:['visibility'])];
 const date=new Date(time).toISOString().slice(0,10),url=new URL(route.base);
 for(const [k,v]of Object.entries({latitude:points.map(p=>p.latitude).join(','),longitude:points.map(p=>p.longitude).join(','),start_date:date,end_date:date,hourly:fields.join(','),timezone:'UTC',timeformat:'unixtime',wind_speed_unit:'ms',cell_selection:'nearest'}))url.searchParams.set(k,v);
 const key=url.href,old=cache.get(key),ttl=route.kind==='reanalysis'?DAY:3600000;
 if(old&&now-old.saved<ttl)return {...old.result,cached:true};
 if(pending.has(key))return pending.get(key);
 const work=(async()=>{try{
  const response=await fetcher(url,{signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw Error(`天气接口 HTTP ${response.status}`);
  const data=await response.json(),rows=Array.isArray(data)?data:[data];
  if(rows.length!==points.length)throw Error('天气地点数量不匹配');
  const target=Date.parse(time)/1000;
  const result={status:'available',kind:route.kind,label:route.label,source:'Open-Meteo',sourceUrl:url.href,fetchedAt:new Date(now).toISOString(),points:rows.map((row,i)=>{
   const times=row.hourly?.time||[],index=times.reduce((best,t,j)=>Math.abs(t-target)<Math.abs((times[best]??Infinity)-target)?j:best,-1);
   const valid=index>=0&&Math.abs(times[index]-target)<=3600,values={};
   for(const f of fields){const n=row.hourly?.[f]?.[index];values[f]=valid&&typeof n==='number'&&Number.isFinite(n)?n:null;}
   return {...points[i],grid:{latitude:row.latitude,longitude:row.longitude},time:valid?new Date(times[index]*1000).toISOString():null,values,...weatherVerdict(values)};
  })};
  if(cache.size>200)cache.delete(cache.keys().next().value);cache.set(key,{saved:now,result});return result;
 }catch(error){return {status:'unavailable',label:'天气暂不可用',reason:error.message,source:'Open-Meteo',sourceUrl:url.href,points:[],fetchedAt:new Date(now).toISOString()};}finally{pending.delete(key);}})();
 pending.set(key,work);return work;
}
