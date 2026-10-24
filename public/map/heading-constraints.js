const cache=new Map();
export function inBearingArc(angle,arc){return ((angle-arc.start+360)%360)<=arc.width+1e-6;}
export async function renderHeadingConstraints(box,{launch,historical,onApply}){
 if(historical){box.hidden=true;return;}
 const params=new URLSearchParams({range:'upcoming'});if(launch.manualTime)params.set('simulationTime',launch.timing.net);
 const url=`./api/launches/${encodeURIComponent(launch.id)}/heading-constraints?${params}`;
 box.textContent='航警方向参考：读取中…';
 try{let item=cache.get(url);if(!item||Date.now()-item.time>1800000){item={time:Date.now(),promise:fetch(url).then(r=>{if(!r.ok)throw Error('读取失败');return r.json();})};cache.set(url,item);}const data=await item.promise;if(!box.isConnected)return;
  box.replaceChildren();
  if(!data.candidates?.length){box.textContent=data.status==='pending'?'航警参考：填写时刻后匹配':data.status==='unavailable'?'航警参考暂不可用':'航警参考：暂无匹配通告';return;}
  const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent=`航警方向参考 · ${data.candidates.length} 条候选`;details.append(summary);
  const note=document.createElement('p');note.textContent='按时间与场址匹配，任务对应关系待核对。通告区不是航迹。';details.append(note);
  for(const c of data.candidates){const row=document.createElement('div'),label=document.createElement('span'),button=document.createElement('button');label.textContent=`${c.id} · ${Math.round(c.start)}°–${Math.round(c.end)}° · ${c.kind}`;button.type='button';button.textContent='用作模拟约束';button.onclick=()=>onApply(c);row.append(label,button);details.append(row);}
  const source=document.createElement('a');source.href='https://rocket.rainywhisper.com/';source.target='_blank';source.rel='noopener noreferrer';source.textContent='通告来源：notam-whisper 聚合';details.append(source);box.append(details);
 }catch{if(box.isConnected)box.textContent='航警参考暂不可用';}
}
