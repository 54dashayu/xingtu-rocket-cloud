const requests=new Map(),times=new Map();
export function populationCopy(box,launch){
 if(!launch.coordinates){box.textContent='人口分布：场址坐标待补充';return;}
 const {latitude,longitude}=launch.coordinates,key=`${latitude},${longitude}`;
 if(Date.now()-(times.get(key)||0)>300000){requests.delete(key);times.set(key,Date.now());}
 if(!requests.has(key))requests.set(key,fetch(`./api/population?latitude=${latitude}&longitude=${longitude}`).then(r=>{if(!r.ok)throw Error();return r.json();}));
 requests.get(key).then(p=>{
  if(!box.isConnected)return;
  box.textContent=p.status==='available'?`场址周边100公里约${Math.round(p.total/1000)/10}万人（${p.year}年 WorldPop 估计）。${p.rings.map(r=>`${r.from_km}–${r.to_km}公里：约${Math.round(r.population).toLocaleString()}人`).join('；')}。仅表示周边常住人口，非可见区人数，不计入几何指数。`:`人口分布：${p.reason||'暂不可用'}；未计入指数。`;
 }).catch(()=>{if(box.isConnected)box.textContent='人口分布：数据暂不可用；未计入指数。';});
}
