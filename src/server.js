import { fetchWarnings, warningCandidates } from './navigation-warnings.js';
import { mapLaunch, preciseTime } from '../public/map/model.js';
import { assessmentScenario } from './assessment-scenario.js';
import { assessCloud } from './cloud-assessment.js';
import { attachFlightProfile } from './flight-profiles.js';
import { attachCloudEvidence } from './cloud-evidence.js';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { calendarArchive, validSince, subscriptionEntries } from './calendar-archive.js';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { getLaunchData, getLaunchHistoryData } from './store.js';
import { filterLaunches } from './normalize.js';
import { createCalendar, createSubscriptionCalendar, isCalendarEligible } from './ics.js';

const publicRoot = fileURLToPath(config.publicDir).replace(/[\\/]$/, '');
const mime = { '.png': 'image/png', '.ico': 'image/x-icon', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers });
  res.end(body);
}

function json(res, status, value) { send(res, status, JSON.stringify(value), { 'content-type': 'application/json; charset=utf-8' }); }

async function api(req, res, url) {
  const warningMatch=url.pathname.match(/^\/api\/launches\/([a-zA-Z0-9-]+)\/heading-constraints$/);
  if(warningMatch){
    const historical=url.searchParams.get('range')==='history';
    const data=await (historical?getLaunchHistoryData():getLaunchData());
    const raw=data.launches.find(l=>l.id===warningMatch[1]);
    if(!raw)return json(res,404,{error:'未找到该发射任务'});
    let scenario;try{scenario=assessmentScenario(attachFlightProfile(attachCloudEvidence(raw)),{time:url.searchParams.get('simulationTime'),historical});}catch(e){return json(res,400,{error:e.message});}
    if(historical)return json(res,200,{status:'history_unavailable',candidates:[],note:'实时通告不反推历史航向；需与任务对应的归档通告。'});
    const launch=mapLaunch(scenario.launch);
    if(!launch.coordinates||!preciseTime(launch))return json(res,200,{status:'pending',candidates:[],note:'填写模拟时刻后匹配通告。'});
    const feed=await fetchWarnings(),candidates=warningCandidates(launch,feed.rows);
    return json(res,200,{status:candidates.length?'candidates':feed.sources.every(s=>s.error)?'unavailable':'no_match',provider:feed.provider,fetchedAt:feed.fetchedAt,sources:feed.sources,candidates,note:'仅约束指向通告区域的方位；不是实际航迹、初始航向或观测范围。'});
  }

  const assessmentMatch=url.pathname.match(/^\/api\/launches\/([a-zA-Z0-9-]+)\/cloud-assessment$/);
  if(assessmentMatch){
    const target=Number(url.searchParams.get('target')||150);
    const latitude=url.searchParams.get('latitude'),longitude=url.searchParams.get('longitude');
    const observer=latitude!==null&&longitude!==null?{latitude:Number(latitude),longitude:Number(longitude)}:null;
    if(![100,150].includes(target)||(latitude!==null||longitude!==null)&&(!observer||!latitude.trim()||!longitude.trim()||!Number.isFinite(observer.latitude)||!Number.isFinite(observer.longitude)||Math.abs(observer.latitude)>90||Math.abs(observer.longitude)>180))return json(res,400,{error:'高度或观测坐标无效'});
    const history=url.searchParams.get('range')==='history';
    const data=await (history?getLaunchHistoryData():getLaunchData());
    const raw=data.launches.find(l=>l.id===assessmentMatch[1]);
    if(!raw)return json(res,404,{error:'未找到该发射任务'});
    const launch=attachFlightProfile(attachCloudEvidence(raw));
    let scenario;
    try{scenario=assessmentScenario(launch,{time:url.searchParams.get('simulationTime'),azimuth:url.searchParams.get('azimuth'),historical:history});}catch(error){return json(res,400,{error:error.message});}
    const result=await assessCloud(scenario.launch,{target,observer,...scenario.options});
    return json(res,200,{...result,launchData:{source:data.source,fetchedAt:data.fetchedAt,stale:Boolean(data.stale)}});
  }
  if (url.pathname === '/api/calendar/subscription.ics') {
    const since = url.searchParams.get('since');
    if (!validSince(since)) return json(res, 400, { error: '请提供有效的固定起始日期 since=YYYY-MM-DD' });
    const [upcoming, history] = await Promise.all([getLaunchData(), getLaunchHistoryData()]);
    const entries = await calendarArchive.merge([...upcoming.launches, ...history.launches]);
    // A temporary upstream failure must not replace an existing client calendar with an empty one.
    if (!entries.length && (upcoming.stale || history.stale)) return json(res, 503, { error: '订阅数据暂不可用，请稍后重试' });
    const body = createSubscriptionCalendar(subscriptionEntries(entries, since));
    const etag = '"' + createHash('sha256').update(body).digest('hex') + '"';
    const headers = { 'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': 'inline; filename="xingtu-subscription.ics"',
      'cache-control': 'no-cache', etag, 'x-calendar-stale': String(Boolean(upcoming.stale || history.stale)) };
    if ((req.headers['if-none-match'] || '').split(/\s*,\s*/).includes(etag)) return send(res, 304, '', headers);
    return send(res, 200, body, headers);
  }
  if (url.pathname === '/api/launches/previous') {
    const data = await getLaunchHistoryData();
    url.searchParams.set('range', 'previous');
    const results = filterLaunches(data.launches, url.searchParams);
    return json(res, 200, { meta: { count: results.length, fetchedAt: data.fetchedAt, stale: data.stale, refreshing: Boolean(data.refreshing), warning: data.warning || null, source: data.source, range: 'previous', timezone: 'UTC in API; client also renders Asia/Shanghai' }, results: results.map(launch=>attachFlightProfile(attachCloudEvidence(launch))) });
  }
  const data = await getLaunchData();
  if (url.pathname === '/api/launches') {
    const results = filterLaunches(data.launches, url.searchParams);
    return json(res, 200, { meta: { count: results.length, supplementCount: data.supplementCount || 0, fetchedAt: data.fetchedAt, stale: data.stale, refreshing: Boolean(data.refreshing), warning: data.warning || null, source: data.source, timezone: 'UTC in API; client also renders Asia/Shanghai' }, results: results.map(launch=>attachFlightProfile(attachCloudEvidence(launch))) });
  }
  if (url.pathname === '/api/calendar.ics') {
    const results = filterLaunches(data.launches, url.searchParams);
    return send(res, 200, createCalendar(results), { 'content-type': 'text/calendar; charset=utf-8', 'content-disposition': 'inline; filename="global-launches.ics"' });
  }
  const match = url.pathname.match(/^\/api\/launches\/([^/]+?)(?:\.ics)?$/);
  if (match) {
    const launch = data.launches.find((item) => item.id === decodeURIComponent(match[1]));
    if (!launch) return json(res, 404, { error: '未找到该发射任务' });
    if (url.pathname.endsWith('.ics') && !isCalendarEligible(launch)) return json(res, 409, { error: '日期尚未确定，暂不能导出单次日历' });
    if (url.pathname.endsWith('.ics')) return send(res, 200, createCalendar([launch], launch.name), { 'content-type': 'text/calendar; charset=utf-8', 'content-disposition': `attachment; filename="launch-${launch.id}.ics"` });
    return json(res, 200, { meta: { fetchedAt: data.fetchedAt, stale: data.stale }, result: attachFlightProfile(attachCloudEvidence(launch)) });
  }
  return json(res, 404, { error: '接口不存在' });
}

async function staticFile(res, pathname) {
  const requested = pathname === '/' ? '/index.html' : pathname;
  const path = resolve(publicRoot, `.${decodeURIComponent(requested)}`);
  if (!(path === publicRoot || path.startsWith(publicRoot + sep))) return send(res, 403, 'Forbidden');
  try { const body = await readFile(path); send(res, 200, body, { 'content-type': mime[extname(path)] || 'application/octet-stream', 'cache-control': 'public, max-age=300' }); }
  catch { send(res, 404, 'Not found', { 'content-type': 'text/plain; charset=utf-8' }); }
}

export function createServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    try { if (url.pathname.startsWith('/api/')) await api(req, res, url); else await staticFile(res, url.pathname); }
    catch (error) { console.error(error); json(res, 502, { error: '暂时无法获取发射数据', detail: error.message }); }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = createServer().listen(config.port, config.host, () => console.log(`Launch calendar: http://${config.host}:${config.port}`));
  const refresh = () => Promise.allSettled([getLaunchData(), getLaunchHistoryData()]);
  void refresh();
  const timer = setInterval(refresh, Math.max(60000, config.cacheTtlMs));
  timer.unref(); server.on('close', () => clearInterval(timer));
}
