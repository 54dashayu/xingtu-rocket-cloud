import { readFile } from 'node:fs/promises';
import {withDeadline,createRequestBudget} from './upstream-request.js';
import { createLaunchFeed } from './launch-feed.js';
import { calendarArchive } from './calendar-archive.js';
import {fetchWarningDiscovery} from './warning-discovery.js';
import { config } from './config.js';
import { normalizeLaunches } from './normalize.js';
import { getSupplements, mergeSupplements } from './supplements.js';
import { translateAgency, translateLocation, translateMissionName, translateRocket } from './translate.js';
import { rocketCloudForecast } from './rocket-cloud.js';

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

export async function fetchLaunchPages(startUrl, fetcher = fetch, {partial=false,maxPages=config.upstreamPages,signal,timeoutMs=20000,reserve}={}) {
  const results = [], seenUrls = new Set();
  let url = startUrl;
  for (let page = 0; page < maxPages && url && !seenUrls.has(url); page += 1) {
    seenUrls.add(url);
    try {
      signal?.throwIfAborted();
      if(reserve)await reserve();
      const payload=await withDeadline(async requestSignal=>{
      const response = await fetcher(url, { headers: { accept: 'application/json', 'user-agent': config.userAgent }, signal:requestSignal });
      if (!response.ok) {
        const error = new Error(`Launch Library 2 returned HTTP ${response.status}`);
        error.status=response.status;error.retryAfter=response.headers?.get?.('retry-after');
        const seconds=Number(error.retryAfter);
        error.retryAt=Date.now()+(seconds>0?seconds*1000:5*60000);
        throw error;
      }
      return response.json();
      },{timeoutMs,signal});
      if(!Array.isArray(payload.results))throw new TypeError('Launch Library 2 响应缺少 results');
      results.push(...payload.results);url=payload.next||null;
    }catch(error){if(partial&&results.length)return {results,error};throw error;}
  }
  return {results};
}
export function fetchUpcomingPages(fetcher=fetch){return fetchLaunchPages(config.upstreamUrl,fetcher);}
export function fetchPreviousPages(fetcher=fetch){return fetchLaunchPages(config.previousUrl,fetcher);}
const reserveRequest=createRequestBudget({file:new URL('launch-request-budget.json',config.launchSnapshotFile)});
function newFeed(){return createLaunchFeed({
  discover:fetchWarningDiscovery,file:config.launchSnapshotFile,readOnly:config.launchFeedReadOnly,ttl:config.cacheTtlMs,
  seed:async()=>({upcoming:await readDisk(config.cacheFile),history:await readDisk(config.historyCacheFile)}),
  beforeSave:launches=>calendarArchive.merge(launches),
  fetchRange:async (range,{signal,deepFetchedAt}={})=>{
    const source=range==='history'?config.previousUrl:config.upstreamUrl;
    // Refresh the newest page often; refresh older pages every six hours.
    const deep=!deepFetchedAt||Date.now()-Date.parse(deepFetchedAt)>=6*3600000;
    const payload=await fetchLaunchPages(source,fetch,{partial:true,maxPages:deep?config.upstreamPages:1,signal,reserve:reserveRequest});
    let launches=normalizeLaunches(payload);
    if(range==='upcoming')launches=mergeSupplements(launches,await getSupplements());
    return {launches,source,error:payload.error,deepFetchedAt:deep&&!payload.error?new Date().toISOString():deepFetchedAt};
  }
});}
let feed=newFeed();
export async function getLaunchData(options={}){return feed.get('upcoming',options);}
export async function getLaunchHistoryData(options={}){
  return mergeHistoryResources(await feed.get('history',options),await getHistoryResources());
}
export function refreshLaunchFeed(options={}){return feed.refresh(options);}
export function resetMemoryCache(){feed=newFeed();historyResourcesMemory=null;}
