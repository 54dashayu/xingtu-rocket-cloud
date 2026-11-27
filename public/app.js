import {createMissionCache} from './map/mission-cache.js?v=0.03-0036';
const readMissions=createMissionCache();
const datasets=new Map();
import {propulsionSummary,propulsionDetails} from './map/propulsion-view.js?v=0.03-0035';
const model3DEnabled=['http:','https:'].includes(location.protocol);
const task3DUrl=(id,history)=>`./3d/index.html?launch=${encodeURIComponent(id)}&range=${history?'history':'upcoming'}`;
import { localizeLaunch } from './launch-localization.js?v=0.03-0035';
import { cloudStatus } from './cloud-status.js?v=0.03-0035';
import { displayName } from './name-display.js?v=0.03-0035';
const $ = (selector) => document.querySelector(selector);
const state = { launches: [], timer: null, view: 'upcoming', loadToken: 0 };
const basePath = location.pathname.startsWith('/launch-calendar/') ? '/launch-calendar'
  : location.pathname.startsWith('/launch/') ? '/launch' : '';
const formatter = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
const utcFormatter = new Intl.DateTimeFormat('zh-CN', { timeZone: 'UTC', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });

function countdown(value) {
  const ms = Date.parse(value) - Date.now();
  if (ms <= 0) return '窗口已到 / 等待更新';
  const days = Math.floor(ms / 86400000), hours = Math.floor(ms % 86400000 / 3600000), mins = Math.floor(ms % 3600000 / 60000);
  // 当不足 24 小时时显示到秒，配合秒级刷新；较远任务保持简洁的天/小时信息。
  const seconds = Math.floor(ms % 60000 / 1000);
  return days ? `${days} 天 ${hours} 小时` : `${hours} 小时 ${mins} 分 ${seconds} 秒`;
}
function isUrgentCountdown(value) {
  const remaining = Date.parse(value) - Date.now();
  return remaining > 0 && remaining < 86400000;
}

function escapeHtml(value = '') { const node = document.createElement('span'); node.textContent = value; return node.innerHTML; }
function nameHtml(value) {
  const name = displayName(value);
  return escapeHtml(name.text) + (name.provisional ? ' <small class="translation-note" title="仅指中文译名，发射计划状态见独立标签">（中文译名待确认）</small>' : '');
}
function dateParts(value) { const parts = formatter.formatToParts(new Date(value)); return Object.fromEntries(parts.map(({ type, value: item }) => [type, item])); }
function flag(code) { return code?.length === 2 ? String.fromCodePoint(...[...code.toUpperCase()].map((char) => 127397 + char.charCodeAt())) : '🌐'; }
function historyResourcesFor(launch) {
  const resources = [];
  const add = (url, name) => { if (url && !resources.some((item) => item.url === url)) resources.push({ url, name }); };
  for (const resource of launch.resources || []) add(resource.url, resource.name);
  return resources.slice(0, 3);
}
function rocketCloudHint(launch) {
  const cloud=cloudStatus(launch);
  if(!['observed','reminder','retrospective'].includes(cloud.code))return '';
  return `<span class="rocket-cloud rocket-cloud-${cloud.code}" title="${escapeHtml(cloud.description)}">☁ ${escapeHtml(cloud.label)}</span>`;
}

function card(launch) {
  const scheduled = Boolean(launch.timing.net);
  const date = scheduled ? dateParts(launch.timing.net) : null;
  const history = state.view === 'history';
  const historyResources = history ? historyResourcesFor(launch) : [];
  const historyResourceHint = historyResources.length
    ? `<span class="history-resource-hint">资料与回放 ${historyResources.length} 条</span>`
    : '<span class="calendar-pending">资料待补充</span>';
  const historyResourceLinks = history
    ? historyResources.length ? `<div class="history-card-links">${historyResources.map((resource) => `<a data-resource href="${escapeHtml(resource.url)}" target="_blank" rel="noreferrer">${escapeHtml(resource.name)} ↗</a>`).join('')}</div>` : ''
    : '';
  const time = launch.timing.basis==='notice_window'
    ? `<div class="time"><div><strong>航警时间窗（北京时间）</strong><small>${formatter.format(new Date(launch.timing.windowStart))}—${formatter.format(new Date(launch.timing.windowEnd))}</small><small>点火时刻待核实 · 不作发射倒计时</small></div></div>`
    : scheduled
    ? `<div class="time"><div class="date-box"><small>${date.month}月</small><strong>${date.day}</strong></div><div><strong>${date.hour}:${date.minute} 北京时间</strong><small>${utcFormatter.format(new Date(launch.timing.net))} 世界协调时</small><div class="countdown${isUrgentCountdown(launch.timing.net) ? ' countdown-urgent' : ''}" data-net="${launch.timing.net}">${countdown(launch.timing.net)}</div></div></div>`
    : `<div class="time uncertain-time"><div class="date-box"><small>计划</small><strong>待定</strong></div><div><strong>${escapeHtml(launch.timing.precision || '时间待定')}</strong><small>以公开来源后续更新为准</small></div></div>`;
  return `<article class="launch-card" data-id="${launch.id}" tabindex="0" style="--accent:${launch.crewed ? '#39d6d1' : '#ff6935'}">
    <div class="card-top"><span class="flag">${flag(launch.country.code)} ${escapeHtml(launch.country.name)}</span><span class="${history ? 'result' : 'status'} ${history ? launch.result.code : launch.scheduleStatus.code}">${escapeHtml(history ? launch.result.label : launch.scheduleStatus.label)}</span></div>
    <h3>${nameHtml(launch.name)}</h3><div class="meta">${nameHtml(launch.rocket)}${launch.crewed ? ' · 👨‍🚀 载人任务' : ''}${launch.livestream.available ? ' · ◉ 有直播' : ''}</div><div class="propulsion-summary">${propulsionSummary(launch)}</div><div class="location">◎ ${escapeHtml(launch.pad.location || launch.pad.name || '发射地点待定')}</div>
    ${history ? time.replace(/<div class="countdown"[^>]*>.*?<\/div>/, '<div class="countdown">实际发射记录</div>') : time}
    <div class="card-foot"><span class="agency">${escapeHtml(launch.agency.name)} · ${escapeHtml(launch.agency.ownership === 'private' ? '民营/商业' : launch.agency.ownership === 'state' ? '国营/政府' : '未分类')}</span><span class="card-cloud-status">${rocketCloudHint(launch)}${model3DEnabled&&cloudStatus(launch).code===(history?'observed':'reminder')?`<a class="launch-3d" data-resource href="${task3DUrl(launch.id,history)}" aria-label="3D模型：${escapeHtml(launch.name)}">3D模型</a>`:''}${history ? historyResourceHint : ''}</span></div>${historyResourceLinks}
  </article>`;
}

function cacheKey() { return `launch-calendar:${state.view}:all:v2`; }
function readSnapshot() {
  try { return JSON.parse(localStorage.getItem(cacheKey()) || 'null'); } catch { return null; }
}
function writeSnapshot(data) {
  try { localStorage.setItem(cacheKey(), JSON.stringify({ ...data, cachedAt: Date.now() })); } catch { /* 存储不可用时仍正常联网加载 */ }
}
function render(data, cached = false) {
  const region=$('#region').value,ownership=$('#ownership').value,crew=$('#crewed').value,q=$('#q').value.trim().toLowerCase();
  const results=data.results.map(localizeLaunch).filter(l=>(!region||l.region===region)&&(!ownership||l.agency.ownership===ownership)&&(crew==='all'||(crew==='unknown'?typeof l.crewed!=='boolean':(crew==='true')===l.crewed))&&(!q||[l.name,l.originalName,l.rocket,l.originalRocket,l.agency.name,l.agency.originalName,l.mission?.name,l.pad.location].some(v=>v?.toLowerCase().includes(q))));
  data = {...data, results};
  state.launches = data.results;
  const next = data.results.find((launch) => launch.timing.net && launch.timing.basis!=='notice_window');
  $('#count').textContent = data.results.length; $('#next-time').textContent = state.view === 'history' ? '已完成' : (next ? countdown(next.timing.net) : '--');
  const suffix = cached ? '（本次更新中）' : data.meta.stale || data.meta.refreshing || data.meta.clientUpdate ? '（已保留缓存，可手动刷新）' : '';
  const warning = data.meta.warning ? ` · ${data.meta.warning}` : '';
  $('#updated').textContent = `数据更新：${(data.meta.fetchedAt?formatter.format(new Date(data.meta.fetchedAt)):'时间待确认')}${suffix}${warning}`;
  $('#launches').innerHTML = data.results.length ? data.results.map(card).join('') : '<div class="empty">暂无符合条件的近期任务。</div>';
}

function renderCurrent(){const data=datasets.get(state.view);if(data)render(data);}
async function load({force=false}={}) {
  const token=++state.loadToken,view=state.view;
  const snapshot=datasets.get(view)||readSnapshot();
  if(snapshot?.results&&snapshot?.meta){datasets.set(view,snapshot);render(snapshot,true);}
  else $('#launches').innerHTML='<div class="loading">正在读取发射数据…</div>';
  $('#refresh').disabled=true;
  const apply=(data,interim=false)=>{
    if(token!==state.loadToken)return;
    datasets.set(view,data);writeSnapshot(data);render(data,interim);
  };
  try{
    const endpoint=view==='history'?'/api/launches/previous':'/api/launches';
    const data=await readMissions(`${basePath}${endpoint}?days=30`,{force,onSnapshot:data=>{if(!snapshot)apply(data,true);}});
    apply(data);
  }catch(error){
    if(token!==state.loadToken)return;
    const available=datasets.get(view);
    if(available){render(available);$('#updated').textContent+=' · 更新失败，保留当前列表，可手动刷新';}
    else $('#launches').innerHTML=`<div class="error">暂时无法获取数据。<br><small>${escapeHtml(error.message)}</small></div>`;
  }finally{if(token===state.loadToken)$('#refresh').disabled=false;}
}

let detailRequest;
function showDetail(launch) {
  detailRequest?.abort();
  const request=detailRequest=new AbortController();
  const body = $('#detail-body');
  const scheduled = Boolean(launch.timing.net);
  const time = launch.timing.basis==='notice_window' ? `${formatter.format(new Date(launch.timing.windowStart))}—${formatter.format(new Date(launch.timing.windowEnd))} 北京时间` : scheduled
    ? `${formatter.format(new Date(launch.timing.net))} 北京时间<br><small>${utcFormatter.format(new Date(launch.timing.net))} 世界协调时</small>`
    : `${escapeHtml(launch.timing.precision || '时间待定')}<br><small>尚未公布可导入日历的具体时间</small>`;
  const provenance = launch.provenance ? `<p class="provenance"><strong>${escapeHtml(launch.provenance.label)}</strong> · ${escapeHtml(launch.provenance.confidence)}${launch.provenance.lastVerified ? ` · 核验于 ${escapeHtml(launch.provenance.lastVerified.slice(0, 10))}` : ''}</p>` : '';
  const status = state.view === 'history' ? launch.result.label : launch.scheduleStatus.label;
  const timeLabel = launch.timing.basis==='notice_window'?'航警时间窗（非点火时间）':state.view === 'history' ? '实际发射时间' : '计划时间';
  const resources = state.view === 'history' ? historyResourcesFor(launch) : [];
  const cloud=cloudStatus(launch);
  const forecast=launch.rocketCloud;
  const rocketCloud=cloud.code==='observed'?`<div class="rocket-cloud-detail observed"><strong>☁ 已证实火箭云</strong><p>${escapeHtml(launch.cloudEvidence.observation.basis)}</p><p>报道地点：${escapeHtml(launch.cloudEvidence.observation.locations.map(p=>p.name).join('、'))}</p>${cloud.sources.map(s=>`<a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(s.name)} ↗</a>`).join('')}<a href="./map.html?range=history&launch=${encodeURIComponent(launch.id)}">在地图回溯与计算区域对照 ↗</a></div>`:cloud.code==='reminder'||cloud.code==='retrospective'?`<p class="rocket-cloud-detail"><strong>☁ ${escapeHtml(cloud.label)}</strong><br><small>${escapeHtml(cloud.description)}。${escapeHtml(forecast.reason)}。场址太阳高度约 ${escapeHtml(forecast.solarAltitude)}°。${escapeHtml(forecast.disclaimer)}</small></p>`:'';

  const resourceBlock = state.view === 'history' && resources.length
    ? `<p><strong>公开资料与回放</strong><small class="resource-note">（仅显示已收录的直达网页链接）</small></p><div class="source-list history-resources">${resources.map((resource) => `<a href="${escapeHtml(resource.url)}" target="_blank" rel="noreferrer">${escapeHtml(resource.name)} ↗</a>`).join('')}</div>`
    : state.view === 'history' ? '<p class="resource-note">该任务的可访问资料链接仍待后台补充。</p>'
    : '';
  body.innerHTML = `<p class="eyebrow dark">${flag(launch.country.code)} ${escapeHtml(launch.country.name)} · ${escapeHtml(status)}</p><h2>${nameHtml(launch.name)}</h2>
    <p class="detail-time"><small>${timeLabel}</small><br>${time}</p>${rocketCloud}${provenance}<p>${escapeHtml(launch.mission.description || '任务详情待发布。')}</p>
    <div class="detail-grid"><div><small>发射机构</small>${escapeHtml(launch.agency.name)}</div><div><small>载人属性</small>${escapeHtml(launch.crewLabel||(launch.crewed===true?'载人任务':launch.crewed===false?'非载人任务':'待核实'))}</div><div><small>运载火箭</small>${nameHtml(launch.rocket)}</div><div><small>发射场</small>${escapeHtml(launch.pad.location || launch.pad.name || '待定')}</div><div><small>时间精度</small>${escapeHtml(launch.timing.precision || '未知')}</div></div>
    <div class="detail-grid"><div><small>火箭原名</small>${escapeHtml(launch.originalRocket || '上游未提供')}</div><div><small>载荷／任务原名</small>${escapeHtml(launch.mission.originalName || '上游未提供')}</div><div><small>完整发射名称（原文）</small>${escapeHtml(launch.originalName || '上游未提供')}</div></div>
    ${propulsionDetails(launch)}<details><summary id="detail-index">火箭云指数评估中…</summary><p id="detail-index-note"></p></details><p><strong>来源与核验</strong></p><div class="source-list">${launch.sources.map((source) => `<a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.name)} ↗</a>`).join('')}</div>${resourceBlock}
    <p class="notice">${state.view === 'history' ? '实际结果以来源记录为准，后续可能补充任务详情。' : '发射计划可能随时变动，请在活动前再次核对。'}</p>`;
  $('#detail').showModal();
  fetch(`${basePath}/api/launches/${encodeURIComponent(launch.id)}/cloud-assessment?weather=off&range=${state.view}`,{signal:request.signal}).then(async r=>{if(!r.ok)throw Error();return r.json();}).then(r=>{
    if(detailRequest!==request||r.launchId!==launch.id||r.net!==launch.timing.net)return;
    $('#detail-index').textContent=r.index?.label||'火箭云指数暂未取得';
    $('#detail-index-note').textContent=[r.index?.reason,r.index?.limits].filter(Boolean).join('。');
  }).catch(e=>{if(e.name!=='AbortError'&&detailRequest===request)$('#detail-index').textContent='火箭云指数暂未取得';});
}

for (const id of ['region', 'ownership', 'crewed']) $(`#${id}`).addEventListener('change', renderCurrent);
function setView(view) {
  state.view = view;
  const history = view === 'history';
  $('#view-upcoming').classList.toggle('active', !history); $('#view-history').classList.toggle('active', history);
  $('#view-kicker').textContent = history ? 'PAST 30 DAYS' : 'NEXT 30 DAYS';
  $('#view-title').textContent = history ? '发射回溯 · 过去 30 天' : '近期 30 天';
  $('#count-label').textContent = history ? '回溯任务' : '近期任务';
  $('#next-label').textContent = history ? '任务状态' : '距下次发射';
  $('#calendar-all').hidden = false;
  load();
}
$('#refresh').addEventListener('click',()=>void load({force:true}));
$('#view-upcoming').addEventListener('click', () => setView('upcoming'));
$('#view-history').addEventListener('click', () => setView('history'));
let searchTimer; $('#q').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(renderCurrent, 250); });
$('#launches').addEventListener('click', (event) => { if (event.target.closest('[data-resource]')) return; const item = event.target.closest('[data-id]'); if(item){showDetail(state.launches.find((launch)=>launch.id===item.dataset.id));} });
$('#launches').addEventListener('keydown', (event) => { if (event.key === 'Enter') event.target.click(); });
$('#detail .close').addEventListener('click', () => $('#detail').close());
$('#calendar-all').addEventListener('click', () => { location.href = `${basePath}/calendar.html`; });
const backToTop = $('#back-to-top');
function updateBackToTop() { backToTop.classList.toggle('visible', window.scrollY > Math.max(360, window.innerHeight * 0.65)); }
window.addEventListener('scroll', updateBackToTop, { passive: true });
backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
updateBackToTop();
setInterval(() => { if (state.view !== 'upcoming') return; document.querySelectorAll('[data-net]').forEach((node) => { node.textContent = countdown(node.dataset.net); node.classList.toggle('countdown-urgent', isUrgentCountdown(node.dataset.net)); }); const next = state.launches.find((launch) => launch.timing.net && launch.timing.basis!=='notice_window'); if (next) $('#next-time').textContent = countdown(next.timing.net); }, 1000);
if ('serviceWorker' in navigator) navigator.serviceWorker.register(`${basePath}/sw.js`).catch(() => {});
load();



