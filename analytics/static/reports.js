const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time = x => new Date(typeof x === 'number' ? x*1000 : x).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false});
const outcomes={seen:'看到了火箭云',not_seen:'没有看到',uncertain:'不确定是什么'};
const states={pending:'待查看',reviewed:'已查看',invalid:'无效报告'};
let page=1,serial=0;
async function load(){
 const id=++serial; $('status').textContent='正在读取…';
 try{
  const r=await fetch(`./api/reports?status=${$('report-status').value}&page=${page}`,{cache:'no-store'});
  if(!r.ok)throw Error('读取失败，请刷新或重新登录。'); const d=await r.json();if(id!==serial)return;
  $('status').textContent=`待查看 ${d.counts.pending||0} · 已查看 ${d.counts.reviewed||0} · 无效 ${d.counts.invalid||0}`;
  $('reports').innerHTML=d.results.length?d.results.map(x=>`<article class="panel report-item"><div class="section-head"><h2>${esc(x.launch_name)}</h2><strong>${outcomes[x.outcome]} · ${states[x.status]}</strong></div><p>观测：${esc(x.time_text|| (x.observed_at?time(x.observed_at):'未填写'))} 北京时间${x.approximate?'（大约）':''}</p>${x.launch_time?`<p>发射：${time(x.launch_time)} 北京时间</p>`:''}<p>${esc(x.match_note)}</p>${(x.candidates||[]).map(c=>`<p>候选：${esc(c.name)} · ${time(c.time)} 北京时间 · ${esc(c.basis)}</p>`).join('')}<p>地点：${esc(x.place||'仅提供坐标')}</p><p>坐标：${x.latitude==null?'未提供':`${esc(x.latitude)}°, ${esc(x.longitude)}° · ${esc(x.coordinate_system)}`}</p><p>署名：${esc(x.nickname||'未填写')}</p><p class="report-notes">${esc(x.notes||'无补充说明')}</p><small>提交于 ${time(x.created)} · 编号 ${esc(x.id)}</small><div class="report-actions">${Object.entries(states).map(([value,label])=>`<button data-id="${esc(x.id)}" data-state="${value}" ${x.status===value?'disabled':''}>${label}</button>`).join('')}</div></article>`).join(''):'<p class="panel empty">暂无此类报告</p>';
  $('page').textContent=`${d.page} / ${d.pages} 页 · ${d.total} 条`;$('prev').disabled=page<=1;$('next').disabled=page>=d.pages;
 }catch(e){if(id===serial)$('status').textContent=e.message;}
}
$('reports').onclick=async e=>{
 const b=e.target.closest('button[data-id]');if(!b)return;b.disabled=true;
 try{const r=await fetch('./api/reports/status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:b.dataset.id,status:b.dataset.state})});if(!r.ok)throw Error('保存失败，请重新登录后重试。');await load();}catch(e){$('status').textContent=e.message;b.disabled=false;}
};
$('report-status').onchange=()=>{page=1;load();};$('refresh').onclick=load;
$('prev').onclick=()=>{page--;load();};$('next').onclick=()=>{page++;load();};load();
