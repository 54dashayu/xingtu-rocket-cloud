const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time = x => new Date(typeof x === 'number' ? x*1000 : x).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false});
const outcomes={seen:'看到了火箭云',not_seen:'没有看到',uncertain:'不确定是什么'};
const states={pending:'待查看',reviewed:'已查看',invalid:'无效报告',published:'已公开'};
let page=1,serial=0;
function matchControls(x){
 const i=x.match_inputs||{};
 return `<details class="report-match"><summary>任务匹配 · ${x.match_method==='admin'?'管理员已关联':x.launch_id?'用户指定，待核对':'待匹配'}</summary><p>当前关联：${esc(x.launch_id?x.launch_name:'无')}。关联仅用于整理报告，不会将任务标记为“已证实”。</p><div class="controls"><label>匹配时间（北京时间）<input class="match-time" maxlength="160" placeholder="如：2026-11-07 18:30" value="${esc(i.time_text||x.time_text||'')}"></label><label>匹配地点<input class="match-place" maxlength="160" value="${esc(i.place||x.place||'')}"></label><label>纬度 WGS84<input class="match-lat" type="number" min="-90" max="90" step="any" value="${esc(i.latitude??(x.coordinate_system==='WGS84'?x.latitude:'')??'')}"></label><label>经度 WGS84<input class="match-lon" type="number" min="-180" max="180" step="any" value="${esc(i.longitude??(x.coordinate_system==='WGS84'?x.longitude:'')??'')}"></label><button data-match="recommend" data-report="${esc(x.id)}">重新自动匹配</button></div><p class="muted">补充条件仅用于匹配，不改写原报告。“昨天”等相对时间按报告提交日期解释；经纬度优先于城市名。候选不代表实际可见。</p><div class="controls"><label>发射日历 · 筛选任务<input class="mission-query" maxlength="160" placeholder="任务名称或日期 YYYY-MM-DD（留空显示日历）"></label><button data-match="search" data-report="${esc(x.id)}">筛选日历</button><div class="mission-calendar" role="group" aria-label="发射日历任务"></div><label>已选任务<select class="match-task"><option value="">请选择候选任务</option>${(x.candidates||[]).map(c=>`<option value="${esc(c.id)}">${esc(c.name)} · ${time(c.time)} · ${esc(c.basis)}</option>`).join('')}</select></label><label><input type="checkbox" class="match-publish" ${!x.publish_consent||!x.has_photo?'disabled':''}>保存后在前台展示（需已授权照片及公开说明）</label><button data-match="assign" data-report="${esc(x.id)}">保存关联</button><button data-match="clear" data-report="${esc(x.id)}">解除关联</button></div><p class="match-state" role="status"></p></details>`;
}

async function load(){
 const id=++serial; $('status').textContent='正在读取…';
 try{
  const r=await fetch(`./api/reports?status=${$('report-status').value}&page=${page}`,{cache:'no-store'});
  if(!r.ok)throw Error('读取失败，请刷新或重新登录。'); const d=await r.json();if(id!==serial)return;
  $('status').textContent=`待查看 ${d.counts.pending||0} · 已查看 ${d.counts.reviewed||0} · 无效 ${d.counts.invalid||0} · 已公开 ${d.counts.published||0}`;
  $('reports').innerHTML=d.results.length?d.results.map(x=>`<article class="panel report-item"><div class="section-head"><h2>${esc(x.launch_name)}</h2><strong>${outcomes[x.outcome]} · ${states[x.status]}</strong></div><p>观测：${esc(x.time_text|| (x.observed_at?time(x.observed_at):'未填写'))} 北京时间${x.approximate?'（大约）':''}</p>${x.launch_time?`<p>发射：${time(x.launch_time)} 北京时间</p>`:''}<p>${esc(x.match_note)}</p>${matchControls(x)}${(x.candidates||[]).map(c=>`<p>候选：${esc(c.name)} · ${time(c.time)} 北京时间 · ${esc(c.basis)}</p>`).join('')}<p>地点：${esc(x.place||'仅提供坐标')}</p><p>坐标：${x.latitude==null?'未提供':`${esc(x.latitude)}°, ${esc(x.longitude)}° · ${esc(x.coordinate_system)}`}</p><p>私密署名：${esc(x.nickname||'未填写')}</p><p>照片公开署名：${esc(x.public_credit||'未提供')} · 公开地点：${esc(x.public_place||'未提供')}</p><p class="report-notes">${esc(x.notes||'无补充说明')}</p><p>${x.has_photo?`<a href="./api/report-images/${encodeURIComponent(x.id)}" target="_blank" rel="noopener"><img class="report-photo" src="./api/report-images/${encodeURIComponent(x.id)}" alt="用户提交的观测照片" loading="lazy"></a>`:''}</p><small>提交于 ${time(x.created)} · 编号 ${esc(x.id)}</small><label>公开说明（仅授权照片可发布；请去除身份、详细地址等隐私）<textarea class="public-caption" maxlength="500" rows="3">${esc(x.public_caption||'')}</textarea></label><p>${x.publish_consent?'提交者已授权公开照片':'未授权公开，仅后台可见'}</p><div class="report-actions">${Object.entries(states).map(([value,label])=>`<button data-id="${esc(x.id)}" data-state="${value}" ${x.status===value||(value==='published'&&(!x.publish_consent||!x.has_photo))?'disabled':''}>${value==='published'?'审核通过并展示':value==='reviewed'&&x.status==='published'?'撤下':label}</button>`).join('')}</div></article>`).join(''):'<p class="panel empty">暂无此类报告</p>';
  $('page').textContent=`${d.page} / ${d.pages} 页 · ${d.total} 条`;$('prev').disabled=page<=1;$('next').disabled=page>=d.pages;
 }catch(e){if(id===serial)$('status').textContent=e.message;}
}
$('reports').onclick=async e=>{
 const mb=e.target.closest('button[data-match]');
 if(mb){
  const panel=mb.closest('.report-match'),state=panel.querySelector('.match-state'),select=panel.querySelector('.match-task');
  const action=mb.dataset.match;state.textContent='正在处理…';panel.querySelectorAll('button').forEach(b=>b.disabled=true);
  try{
   let r;
   if(action==='search')r=await fetch('./api/report-missions?q='+encodeURIComponent(panel.querySelector('.mission-query').value),{cache:'no-store'});
   else{
    const payload={id:mb.dataset.report,action,launchId:select.value,publish:panel.querySelector('.match-publish').checked,publicCaption:panel.closest('article').querySelector('.public-caption').value};
    if(action==='assign'&&!select.value)throw Error('请先选择任务。');
    if(action==='recommend'){
     const lat=panel.querySelector('.match-lat').value,lon=panel.querySelector('.match-lon').value;
     payload.inputs={timeText:panel.querySelector('.match-time').value,place:panel.querySelector('.match-place').value,latitude:lat===''?null:Number(lat),longitude:lon===''?null:Number(lon)};
    }
    r=await fetch('./api/reports/match',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
   }
   const d=await r.json();if(!r.ok)throw Error(d.error||'操作失败，请重新登录后重试。');
   if(action==='search'||action==='recommend'){
    const rows=action==='search'?d.results:d.candidates;
    select.innerHTML='<option value="">请选择任务</option>'+rows.map(c=>`<option value="${esc(c.id)}">${esc(c.name)} · ${time(c.time)}${c.basis?' · '+esc(c.basis):''}</option>`).join('');
    renderCalendar(panel,rows);
    if(action==='recommend'&&rows.length){select.value=rows[0].id;panel.querySelector('input[data-mission]')?.click();}
    state.textContent=action==='search'?`找到 ${d.total} 条，显示前 ${rows.length} 条；选择后点击保存关联。`:(d.note+' 已自动选中首个候选，请核对后保存。');
   }else{await load();$('status').textContent=action==='assign'?'任务关联已保存；前台展示状态已按所选设置处理。':'任务关联已解除。';}
  }catch(err){state.textContent=err.message;}finally{panel.querySelectorAll('button').forEach(b=>b.disabled=false);}return;
 }
 const b=e.target.closest('button[data-id]');if(!b)return;b.disabled=true;
 try{const r=await fetch('./api/reports/status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:b.dataset.id,status:b.dataset.state,publicCaption:b.closest('article').querySelector('.public-caption').value})});if(!r.ok){const d=await r.json().catch(()=>({}));throw Error(d.error||'保存失败，请重新登录后重试。');}await load();}catch(e){$('status').textContent=e.message;b.disabled=false;}
};
$('report-status').onchange=()=>{page=1;load();};$('refresh').onclick=load;
$('prev').onclick=()=>{page--;load();};$('next').onclick=()=>{page++;load();};load();

function renderCalendar(panel,rows){
 const groups=new Map();for(const item of rows){const day=time(item.time).split(' ')[0];if(!groups.has(day))groups.set(day,[]);groups.get(day).push(item);}
 panel.querySelector('.mission-calendar').innerHTML=[...groups].map(([day,items])=>`<section><strong>${esc(day)}</strong>${items.map(c=>`<label class="mission-card"><input type="radio" name="mission-${panel.querySelector('[data-report]').dataset.report}" data-mission="${esc(c.id)}"><span>${esc(c.name)}<small>${time(c.time)} 北京时间${c.basis?' · '+esc(c.basis):''}</small></span></label>`).join('')}</section>`).join('')||'<p>未找到任务，可修改日期或名称筛选。</p>';
 panel.querySelectorAll('[data-mission]').forEach(input=>input.onchange=()=>{panel.querySelector('.match-task').value=input.dataset.mission;});
}
$('reports').addEventListener('toggle',async e=>{
 const panel=e.target;if(!panel.matches('.report-match')||!panel.open||panel.dataset.loaded)return;
 panel.dataset.loaded='1';panel.querySelector('[data-match="recommend"]').click();
},true);
