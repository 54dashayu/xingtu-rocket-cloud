const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const requests=new Map();let sequence=0,queueGeneration=0;
const assessmentURL=(launch,target,historical,scenario=false,azimuth)=>`./api/launches/${encodeURIComponent(launch.id)}/cloud-assessment?range=${historical?'history':'upcoming'}&target=${target}&net=${encodeURIComponent(launch.timing?.net||'')}${scenario&&launch.manualTime?'&simulationTime='+encodeURIComponent(launch.timing.net):''}${scenario&&Number.isFinite(azimuth)?'&azimuth='+azimuth:''}`;
function request(url){
 let entry=requests.get(url);if(!entry||Date.now()-entry.time>300000){
  entry={time:Date.now(),promise:fetch(url,{signal:AbortSignal.timeout(45000)}).then(async response=>{if(!response.ok)throw Error(`HTTP ${response.status}`);return response.json();})};requests.set(url,entry);
  entry.promise.catch(()=>requests.delete(url));
 }return entry.promise;
}
// Evaluate each loaded mission without blocking the calendar; no report search is involved.
export async function assessMissionList(launches,historical,onResult){
 const generation=++queueGeneration;
 for(const launch of launches){
  if(generation!==queueGeneration)return;
  try{const r=await request(assessmentURL(launch,150,historical));if(generation!==queueGeneration)return;if(r.net===launch.timing?.net)onResult(launch,r);}catch{}
 }
}

export function renderDataAssessment(box,{launch,target,historical,scenario,azimuth,onResult}){
 const token=++sequence;
 box.innerHTML='<div class="rating-head"><h3>模型与天气</h3><span class="rating-limit">发射数据 → 几何 → 天气</span></div><div class="assessment-body" role="status">正在评估…</div>';
 const body=box.querySelector('.assessment-body');
 const url=assessmentURL(launch,target,historical,scenario,azimuth);
 const display=r=>{
  if(token!==sequence||!box.isConnected)return;
  if(r.net!==launch.timing?.net){body.textContent='发射时刻已更新，请刷新任务列表后重新评估。';return;}
  const m=r.model,w=r.weather,c=w.counts;
  body.innerHTML=`<p><strong>${escape(r.conclusion)}</strong>${scenario?'<br><small>手动情景 · 按所填时间与航向评估</small>':''}</p><small>① ${escape(m.label)}${m.reference?' · 参考动力学':''}</small><p>② ${escape(w.label)}${w.samples.length?` · ${w.samples.length} 个观测采样点`:''}</p>${w.status==='available'?`<div class="weather-counts"><span>遮挡较少 ${c.clearer}</span><span>一般 ${c.mixed}</span><span>遮挡较高 ${c.obstructed}</span>${c.missing?`<span>缺测 ${c.missing}</span>`:''}</div>`:''}<details><summary>数据来源与观测点</summary><small>发射：${escape(r.launchData?.source||'Launch Library 2')} · ${r.launchData?.stale?'缓存待更新':'已获取'}<br>更新：${escape(r.launchData?.fetchedAt||'—')}<br>天气：Open-Meteo · ${escape(w.label)}<br>${escape(r.limits)}</small>${w.samples.map(p=>`<p class="weather-point">${p.latitude.toFixed(1)}°, ${p.longitude.toFixed(1)}° · ${escape(p.label)}<br><small>云量 ${p.values.cloud_cover??'—'}% · 降水 ${p.values.precipitation??'—'} mm · 能见度 ${p.values.visibility==null?'缺测':(p.values.visibility/1000).toFixed(1)+' km'}<br>${escape(p.time||'无对应时次')}（UTC）</small></p>`).join('')}<small>云量 ≤30% 且无明显降水为遮挡较少；云量 ≥80%、降水 ≥1 mm/h 或能见度 &lt;5 km 为遮挡风险较高。属于观测筛选规则，不是出现概率。</small><p><a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">天气数据：Open-Meteo</a></p></details><button type="button" class="retry-assessment">更新评估</button>`;
  body.querySelector('.retry-assessment').onclick=()=>{requests.delete(url);renderDataAssessment(box,{launch,target,historical,scenario,azimuth,onResult});};
  onResult(r);
 };
 request(url).then(display).catch(e=>{if(token!==sequence||!box.isConnected)return;requests.delete(url);body.innerHTML=`<p>评估接口暂不可用（${escape(e.message)}），不代表没有火箭云。</p><button type="button">重试</button>`;body.querySelector('button').onclick=()=>renderDataAssessment(box,{launch,target,historical,scenario,azimuth,onResult});});
}
