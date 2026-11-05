// WorldPop resident population estimates: not observers, reports or a visibility probability.
const cache=new Map();
let blockedUntil=0;
export function populationRequest(latitude,longitude){
 if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180)throw new RangeError('坐标无效');
 return {geometry:{type:'Point',coordinates:[longitude,latitude]},radius_km:100,rings_km:[25,50,100],decay:'none',year:2025};
}
export async function surroundingPopulation(latitude,longitude,{fetcher=fetch,now=Date.now()}={}){
 const body=populationRequest(latitude,longitude),key=JSON.stringify(body);
 const base={year:2025,radiusKm:100,source:'WorldPop Global2',sourceUrl:'https://api.worldpop.org/v3/documentation',scope:'发射场周边常住人口估计；不是预测可见区覆盖人口或实际观众人数'};
 if(cache.has(key))return cache.get(key);
 if(now<blockedUntil)return {...base,status:'unavailable',reason:'人口数据源今日额度已用完',retryAt:new Date(blockedUntil).toISOString()};
 try{
  const r=await fetcher('https://api.worldpop.org/v3/exposure',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
  const data=await r.json();
  if(data.error==='rate_limit_exceeded'){
   const reset=Date.parse(data.details?.reset_at);blockedUntil=Number.isFinite(reset)?reset:now+3600000;
   return {...base,status:'unavailable',reason:'人口数据源今日额度已用完',retryAt:new Date(blockedUntil).toISOString()};
  }
  if(!r.ok||!Number.isFinite(data.total?.population_within)||data.total.population_within<0)return {...base,status:'unavailable',reason:'人口数据暂不可用'};
  const result={...base,status:'available',total:data.total.population_within,rings:data.total.rings||[],fetchedAt:new Date(now).toISOString()};
  if(cache.size>100)cache.clear();cache.set(key,result);return result;
 }catch{return {...base,status:'unavailable',reason:'人口数据查询超时或连接失败'};}
}
