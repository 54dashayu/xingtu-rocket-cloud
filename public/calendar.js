const $ = s => document.querySelector(s);
const params = new URLSearchParams(location.search);
const today = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
const valid = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && value >= '1900-01-01' && value <= today &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
let since = params.get('since');
if (!valid(since)) {
  try { since = localStorage.getItem('xingtu:calendar:since'); } catch {}
  if (!valid(since)) since = new Date(Date.now() + 8 * 3600000 - 30 * 86400000).toISOString().slice(0, 10);
}
try { localStorage.setItem('xingtu:calendar:since', since); } catch {}
const feed = new URL('./api/calendar/subscription.ics', location.href);
feed.searchParams.set('since', since);
$('#feed').value = feed.href; $('#since-label').textContent = since;
$('#apple').href = feed.href.replace(/^https?:/, 'webcal:');
async function copy(value) {
  try { await navigator.clipboard.writeText(value); $('#feedback').textContent = '已复制。请在日历软件中添加网址订阅；复制本身尚未建立订阅。'; }
  catch { $('#feed').focus(); $('#feed').select(); $('#feedback').textContent = '自动复制不可用，请长按或选中上方地址复制。'; }
}
$('#copy-feed').addEventListener('click', () => copy(feed.href));
const id = params.get('launch');
if (id) {
  $('#single').hidden = false; $('#single-info').textContent = '正在核对任务…';
  try {
    const endpoint = new URL('./api/launches/' + encodeURIComponent(id), location.href);
    const response = await fetch(endpoint);
    if (!response.ok) throw Error('任务暂不可用，请返回首页刷新后重试。');
    const { result: launch } = await response.json();
    const knownDate = Number.isFinite(Date.parse(launch.timing.net)) && !['tbd', 'approximate', 'postponed'].includes(launch.scheduleStatus.code) && /分钟|秒|小时|日期|到日|minute|second|hour|^day$/i.test(launch.timing.precision || '');
    const precise = /分钟|秒|minute|second/i.test(launch.timing.precision || '');
    const time = knownDate ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', dateStyle: 'long', ...(precise ? { timeStyle: 'short' } : {}) }).format(new Date(launch.timing.net)) + (precise ? ' 北京时间' : ' · 全天标记，时刻待定') : '日期待定，暂不能生成日程';
    const text = launch.name + '\n' + time + '\n' + (launch.pad.location || '') + '\n发射计划可能调整，请核对：' + new URL('./', location.href).href;
    $('#single-info').textContent = launch.name + ' · ' + time;
    $('#single-download').href = endpoint.href + '.ics'; $('#single-download').hidden = !knownDate;
    $('#copy-task').hidden = false;
    $('#copy-task').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(text); $('#single-info').textContent = '任务文字已复制，可在日历中手动新建事项。'; }
      catch { $('#single-info').textContent = text + '（请长按复制）'; }
    });
  } catch (error) { $('#single-info').textContent = error.message; }
}
