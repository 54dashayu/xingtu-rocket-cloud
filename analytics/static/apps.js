const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),fmt=n=>Number(n||0).toLocaleString('zh-CN');
const day=d=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
$('end').value=day(new Date());$('start').value=day(new Date(Date.now()-6*86400000));
async function load(){try{$('state').textContent='读取中…';const r=await fetch('./api/app-stats?'+new URLSearchParams({start:$('start').value,end:$('end').value}),d=await r.json();if(!r.ok)throw Error();
$('state').textContent='按北京时间统计';$('metrics').innerHTML=[['当前活跃会话',d.online],['所选期间会话',d.apps.reduce((a,r)=>a+r.sessions,0)],['下载入口请求',d.downloads.reduce((a,r)=>a+r.requests,0)]].map(([k,v])=>`<div class="metric"><span>${k}</span><strong>${fmt(v)}</strong></div>`).join('');
$('apps').innerHTML=d.apps.map(r=>`<tr><td>${esc(r.platform)}</td><td>v${esc(r.version)} ${String(r.build).padStart(4,'0')}</td><td>${fmt(r.sessions)}</td><td>${Math.round(r.seconds/60)} 分</td><td>${new Date(r.latest*1000).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})}</td></tr>`).join('')||'<tr><td colspan="5">暂无心跳</td></tr>';
$('daily').innerHTML=d.daily.map(r=>`<p>${esc(r.day)} · ${esc(r.platform)} · ${fmt(r.sessions)} 会话 · ${Math.round(r.seconds/60)} 分钟</p>`).join('')||'暂无记录';$('downloads').innerHTML=d.downloads.map(r=>`<p>${esc(r.day)} · ${esc(r.version)} · ${fmt(r.requests)} 次</p>`).join('')||'暂无下载请求';}catch{$('state').textContent='读取失败，请检查登录和日期范围。';}}
$('refresh').onclick=load;void load();
