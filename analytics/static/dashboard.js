const $ = id => document.getElementById(id);
const names = { launch: '全球发射日历', 'rocket-cloud': '火箭云预测' };
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => Number(n || 0).toLocaleString('zh-CN');
const duration = s => s == null ? '未采集' : (s < 60 ? `${Math.round(s)} 秒` : `${Math.floor(s / 60)} 分 ${Math.round(s % 60)} 秒`);
const clock = t => t ? new Date(t * 1000).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) : '—';
const dayString = date => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
let page = 1, request = 0;
function range(days) { const now = new Date(); $('end').value = dayString(now); $('start').value = dayString(new Date(now - (days - 1) * 86400000)); }
function metric(title, value, note) { return `<div class="metric"><span>${title}</span><strong>${esc(value)}</strong><small>${note}</small></div>`; }
async function load() {
  const id = ++request;
  $('status').textContent = '正在更新统计…'; $('status').className = '';
  const q = new URLSearchParams({ site: $('site').value, kind: $('kind').value, start: $('start').value, end: $('end').value, ip: $('ip').value.trim(), page });
  try {
    const res = await fetch(`./api/stats?${q}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(res.status === 401 ? '登录已失效，请重新登录统一后台。' : '读取失败，请检查日期范围和 IP 格式后重试。');
    const d = await res.json(); if (id !== request) return;
    const history = d.kind === 'history', t = d.total;
    $('status').textContent = `${history ? '上线前页面请求记录（不含已识别爬虫）' : '页面访问与前台停留'} · 更新于 ${clock(d.generated)}${$('ip').value ? ` · 已筛选 IP ${$('ip').value}` : ''}`;
    $('metrics').innerHTML = metric(history ? '页面请求次数' : '页面访问次数', fmt(t.pv), history ? '成功返回页面的日志请求' : '打开 / 刷新一次计一次') + metric('独立 IP', fmt(t.ips), '同一 IP 在所选范围内去重') + metric('访问会话', history ? '未采集' : fmt(t.sessions), '同一标签页 30 分钟内连续访问') + metric('平均前台停留', duration(history ? null : t.avg_seconds || 0), history ? '历史日志没有停留时间' : '每次页面访问 · 切后台暂停');
    $('range').textContent = `${d.start} 至 ${d.end}`;
    const daily = new Map(); d.daily.forEach(x => { const v = daily.get(x.day) || {}; v[x.site] = x.pv; daily.set(x.day, v); });
    const days = []; for (let date = new Date(`${d.start}T00:00:00+08:00`); dayString(date) <= d.end; date = new Date(+date + 86400000)) { days.push(dayString(date)); }
    const max = Math.max(1, ...[...daily.values()].map(v => (v.launch || 0) + (v['rocket-cloud'] || 0)));
    $('chart').innerHTML = days.map(day => { const v = daily.get(day) || {}, a = v.launch || 0, b = v['rocket-cloud'] || 0; return `<div class="day" title="${day}：日历 ${a} 次，火箭云 ${b} 次"><b>${a + b || ''}</b><div class="bar-space"><div class="bars"><i class="rocket"></i><i class="launch"></i></div></div><small>${day.slice(5)}</small></div>`; }).join('');
    document.querySelectorAll('.day').forEach((el, i) => {
      const v = daily.get(days[i]) || {}, a = v.launch || 0, b = v['rocket-cloud'] || 0;
      el.querySelector('.bars').style.height = `${(a + b) / max * 100}%`;
      el.querySelector('.rocket').style.flex = b;
      el.querySelector('.launch').style.flex = a;
    });
    $('products').innerHTML = Object.entries(names).filter(([key]) => !$('site').value || $('site').value === key).map(([key, name]) => { const p = d.products.find(x => x.site === key) || {}; return `<div class="product"><strong>${name}</strong><div><span>${fmt(p.pv)} 次访问</span><span>${fmt(p.ips)} 个 IP</span><span>${history ? '停留未采集' : `平均 ${duration(p.avg_seconds || 0)}`}</span></div></div>`; }).join('');
    $('ips').innerHTML = d.ips.length ? d.ips.map(x => `<div class="ip-row"><button data-ip="${esc(x.ip)}">${esc(x.ip)}</button><span>${fmt(x.pv)} 次</span></div>`).join('') : '<p class="empty">所选时间内暂无访问</p>';
    $('rows').innerHTML = d.recent.length ? d.recent.map(r => `<tr><td>${clock(r.started)}</td><td>${names[r.site]}</td><td>${esc(r.ip)}</td><td>${duration(r.active_ms == null ? null : r.active_ms / 1000)}</td><td>${esc(r.device)} / ${esc(r.browser)}</td><td>${esc(r.referrer || '直接访问 / 未提供')}</td><td>${clock(r.updated)}</td></tr>`).join('') : '<tr><td colspan="7" class="empty">这个时间范围内没有记录。新访问产生后点击“刷新统计”。</td></tr>';
    $('record-note').textContent = history ? '日志请求不代表独立用户；历史停留时间未采集。' : '每行代表一次页面打开，心跳不会增加访问次数。';
    $('page').textContent = `${d.page} / ${d.pages} 页 · ${fmt(t.pv)} 条`;
    $('prev').disabled = page <= 1; $('next').disabled = page >= d.pages;
    $('collection-note').textContent = `采集开始：${clock(Number(d.metadata.started))}。已保存 ${fmt(d.retained_live)} 条页面访问，${fmt(d.historical_total)} 条上线前日志记录。`;
  } catch (e) { if (id === request) { $('status').textContent = e.message; $('status').className = 'error'; } }
}
range(7);
$('refresh').onclick = () => load();
for (const id of ['site', 'kind', 'start', 'end']) $(id).onchange = () => { page = 1; load(); };
document.querySelectorAll('[data-days]').forEach(b => b.onclick = () => { range(Number(b.dataset.days)); page = 1; load(); });
$('prev').onclick = () => { page--; load(); }; $('next').onclick = () => { page++; load(); };
$('ip-form').onsubmit = e => { e.preventDefault(); page = 1; load(); };
$('clear').onclick = () => { $('ip').value = ''; page = 1; load(); };
$('ips').onclick = e => { const b = e.target.closest('[data-ip]'); if (b) { $('ip').value = b.dataset.ip; page = 1; load(); } };
load();
