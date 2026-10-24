import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { calendarArchive } from './calendar-archive.js';
import { config } from './config.js';
import { normalizeLaunches } from './normalize.js';
import { getSupplements, mergeSupplements } from './supplements.js';
import { translateAgency, translateLocation, translateMissionName, translateRocket } from './translate.js';
import { rocketCloudForecast } from './rocket-cloud.js';

let memory = null;
let historyMemory = null;
let inFlight = null;
let historyInFlight = null;
let refreshRetryAt = 0;
let historyRefreshRetryAt = 0;
let historyResourcesMemory = null;

async function readDisk(path) {
  try {
    const value = JSON.parse(await readFile(path, 'utf8'));
    // 缓存保存的是规范化后的对象。重新套用名称映射，使新加的中文惯用译名
    // 不必等到下一次上游刷新才在页面中出现。
    if (!Array.isArray(value.launches)) return value;
    return {
      ...value,
      launches: value.launches.map((launch) => {
        const refreshed = {
        ...launch,
        name: launch.originalName ? translateMissionName(launch.originalName, launch.id) : launch.name,
        rocket: translateRocket(launch.originalRocket || launch.rocket),
        // 缓存可能早于“阿丽亚娜按欧洲项目归属显示”的规则；与名称翻译一起重放，
        // 避免旧缓存继续把项目归属误显示为法属圭亚那发射场。
        country: /^Ariane\b/i.test(launch.originalRocket || launch.rocket || '')
          ? { code: 'EU', name: '欧洲（阿丽亚娜项目）', basis: 'launcher_program' }
          : launch.country,
        agency: launch.agency ? {
          ...launch.agency,
          name: translateAgency(launch.agency.originalName || launch.agency.name)
        } : launch.agency,
        pad: launch.pad ? {
          ...launch.pad,
          location: translateLocation(launch.pad.originalLocation || launch.pad.location)
        } : launch.pad,
        mission: launch.mission ? {
          ...launch.mission,
          name: launch.mission.originalName ? translateMissionName(launch.mission.originalName, launch.id) : launch.mission.name
        } : launch.mission,
        // 历史缓存可能来自早期版本；从已有公开来源和视频地址补回资料入口。
        resources: launch.resources || [
          ...(launch.sources || []).filter((source) => source.role !== 'primary').map((source) => ({ url: source.url, name: source.name || '任务报道或资料' })),
          ...(launch.livestream?.urls || []).map((video) => ({ url: video.url, name: video.title || video.name || '视频回放' }))
        ].filter((item, index, all) => /^https?:\/\//i.test(item.url || '') && all.findIndex((candidate) => candidate.url === item.url) === index).slice(0, 3)
        };
        return { ...refreshed, rocketCloud: rocketCloudForecast(refreshed) };
      })
    };
  } catch { return null; }
}

async function writeDisk(file, value) {
  const path = fileURLToPath(file);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(value, null, 2));
}

async function getHistoryResources() {
  if (historyResourcesMemory) return historyResourcesMemory;
  const value = await readDisk(config.historyResourcesFile);
  if (!value || value.schemaVersion !== 1 || typeof value.resourcesByLaunchId !== 'object') return new Map();
  const entries = Object.entries(value.resourcesByLaunchId).map(([id, resources]) => [id, (Array.isArray(resources) ? resources : [])
    .filter((item) => /^https:\/\//.test(item?.url || '') && item.name)
    .slice(0, 3)]);
  historyResourcesMemory = new Map(entries);
  return historyResourcesMemory;
}

function mergeHistoryResources(value, resourcesByLaunchId) {
  if (!value?.launches) return value;
  return {
    ...value,
    launches: value.launches.map((launch) => {
      const supplemental = resourcesByLaunchId.get(launch.id) || [];
      const resources = [...(launch.resources || []), ...supplemental]
        .filter((item, index, all) => /^https:\/\//.test(item?.url || '') && all.findIndex((candidate) => candidate.url === item.url) === index)
        .slice(0, 3);
      return { ...launch, resources };
    })
  };
}

export async function fetchLaunchPages(startUrl, fetcher = fetch) {
  const results = [];
  const seenUrls = new Set();
  let url = startUrl;
  for (let page = 0; page < config.upstreamPages && url && !seenUrls.has(url); page += 1) {
    seenUrls.add(url);
    const response = await fetcher(url, { headers: { accept: 'application/json', 'user-agent': config.userAgent }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) {
      const error = new Error(`Launch Library 2 returned HTTP ${response.status}`);
      const waitSeconds = Number(response.headers?.get?.('retry-after') || 0);
      error.retryAt = Date.now() + (waitSeconds > 0 ? waitSeconds * 1000 : 5 * 60 * 1000);
      throw error;
    }
    const payload = await response.json();
    if (!Array.isArray(payload.results)) throw new TypeError('Launch Library 2 响应缺少 results');
    results.push(...payload.results);
    url = payload.next || null;
  }
  return { results };
}

export function fetchUpcomingPages(fetcher = fetch) { return fetchLaunchPages(config.upstreamUrl, fetcher); }
export function fetchPreviousPages(fetcher = fetch) { return fetchLaunchPages(config.previousUrl, fetcher); }

async function refresh() {
  const [payload, supplements] = await Promise.all([fetchUpcomingPages(), getSupplements()]);
  const launches = mergeSupplements(normalizeLaunches(payload), supplements);
  const value = { fetchedAt: new Date().toISOString(), stale: false, source: config.upstreamUrl, supplementCount: supplements.length, launches };
  await calendarArchive.merge(launches);
  memory = value;
  refreshRetryAt = 0;
  await writeDisk(config.cacheFile, value);
  return value;
}

async function refreshHistory() {
  const payload = await fetchPreviousPages();
  const resources = await getHistoryResources();
  const value = mergeHistoryResources({ fetchedAt: new Date().toISOString(), stale: false, source: config.previousUrl, launches: normalizeLaunches(payload) }, resources);
  await calendarArchive.merge(value.launches);
  historyMemory = value;
  historyRefreshRetryAt = 0;
  await writeDisk(config.historyCacheFile, value);
  return value;
}

function startRefresh() {
  if (!inFlight) inFlight = refresh().catch((error) => {
    refreshRetryAt = Math.max(refreshRetryAt, error.retryAt || Date.now() + 5 * 60 * 1000);
    throw error;
  }).finally(() => { inFlight = null; });
  return inFlight;
}

function startHistoryRefresh() {
  if (!historyInFlight) historyInFlight = refreshHistory().catch((error) => {
    historyRefreshRetryAt = Math.max(historyRefreshRetryAt, error.retryAt || Date.now() + 5 * 60 * 1000);
    throw error;
  }).finally(() => { historyInFlight = null; });
  return historyInFlight;
}

function unavailableCache(message) {
  return {
    fetchedAt: new Date().toISOString(),
    stale: true,
    refreshing: false,
    warning: message,
    launches: []
  };
}

export async function getLaunchData({ force = false } = {}) {
  memory ||= await readDisk(config.cacheFile);
  if (!force && memory && Date.now() - Date.parse(memory.fetchedAt) < config.cacheTtlMs) return { ...memory, stale: false };
  // 缓存过期不等于不可用：先响应上次成功数据，后台再拉取多页上游数据。
  // 这样首次画面不会因跨境 API 延迟而空白；没有任何缓存时仍会等待一次完整拉取。
  if (!force && memory) {
    const refreshing = Date.now() >= refreshRetryAt;
    if (refreshing) void startRefresh().catch(() => {});
    return { ...memory, stale: true, refreshing, warning: refreshing ? null : '上游数据更新稍后自动重试' };
  }
  try { return await startRefresh(); } catch (error) {
    if (memory) return { ...memory, stale: true, warning: error.message };
    // 上游被限流或暂时不可用时，让客户端得到可解释的缓存状态，
    // 而不是把一次外部服务错误放大成本站的 502。
    return unavailableCache('上游数据暂时不可用，系统会自动重试');
  }
}

export async function getLaunchHistoryData({ force = false } = {}) {
  const historyResources = await getHistoryResources();
  historyMemory ||= await readDisk(config.historyCacheFile);
  // 补充资料独立于上游历史缓存发布；每次读取都合并，确保新收录的中文报道
  // 能立即出现在已缓存的历史任务卡片中，而不必等待下一次上游刷新。
  historyMemory = mergeHistoryResources(historyMemory, historyResources);
  if (!force && historyMemory && Date.now() - Date.parse(historyMemory.fetchedAt) < config.cacheTtlMs) return { ...historyMemory, stale: false };
  if (!force && historyMemory) {
    const refreshing = Date.now() >= historyRefreshRetryAt;
    if (refreshing) void startHistoryRefresh().catch(() => {});
    return { ...historyMemory, stale: true, refreshing, warning: refreshing ? null : '上游数据更新稍后自动重试' };
  }
  try { return await startHistoryRefresh(); } catch (error) {
    if (historyMemory) return { ...historyMemory, stale: true, warning: error.message };
    return unavailableCache('历史数据暂时不可用，系统会自动重试');
  }
}

export function resetMemoryCache() { memory = null; historyMemory = null; historyResourcesMemory = null; inFlight = null; historyInFlight = null; }
