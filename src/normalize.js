const REGION_BY_COUNTRY = new Map([
  ['CN', '中国'], ['US', '美国'], ['RU', '俄罗斯'], ['JP', '日本'], ['IN', '印度'],
  ['FR', '欧洲'], ['DE', '欧洲'], ['IT', '欧洲'], ['GB', '欧洲'], ['EU', '欧洲'],
  ['NZ', '其他'], ['KR', '其他'], ['KP', '其他']
]);

const STATUS_LABELS = {
  confirmed: '已确认', tentative: '暂定', net: '不早于',
  approximate: '时间范围', tbd: '时间待定', postponed: '已推迟', cancelled: '已取消'
};

const RESULT_LABELS = {
  success: '发射成功', failure: '发射失败', partial_failure: '部分成功',
  cancelled: '已取消', pending: '结果待更新'
};

function scheduleStatus(raw) {
  const abbrev = raw.status?.abbrev?.toLowerCase() || '';
  const precision = (raw.net_precision?.abbrev || raw.net_precision?.name || '').toLowerCase();
  let code = 'net';
  if (abbrev.includes('cancel')) code = 'cancelled';
  else if (abbrev.includes('hold') || abbrev.includes('postpon')) code = 'postponed';
  else if (abbrev === 'tbd') code = 'tbd';
  else if (abbrev === 'tbc') code = 'tentative';
  else if (/year|quarter|month/.test(precision)) code = 'approximate';
  else if (/day/.test(precision)) code = 'tentative';
  else if (abbrev === 'go') code = 'confirmed';
  return { code, label: STATUS_LABELS[code], upstream: raw.status?.name || null };
}

function launchResult(raw) {
  const value = `${raw.status?.abbrev || ''} ${raw.status?.name || ''}`.toLowerCase();
  let code = 'pending';
  if (value.includes('partial')) code = 'partial_failure';
  else if (value.includes('success')) code = 'success';
  else if (value.includes('failure')) code = 'failure';
  else if (value.includes('cancel')) code = 'cancelled';
  return { code, label: RESULT_LABELS[code], upstream: raw.status?.name || null, verified: code !== 'pending' };
}

function sourceLinks(raw) {
  const links = [{
    name: '太空开发者发射资料库 2',
    url: `https://ll.thespacedevs.com/2.3.0/launches/${raw.id}/`,
    role: 'primary'
  }];
  for (const item of [...(raw.info_urls || []), ...(raw.mission?.info_urls || [])]) {
    const url = typeof item === 'string' ? item : item?.url;
    if (url && !links.some((source) => source.url === url)) links.push({ name: '任务参考资料', url, role: 'reference' });
  }
  return links;
}

function videoLinks(raw) {
  return [...(raw.vid_urls || []), ...(raw.mission?.vid_urls || [])]
    .map((item) => typeof item === 'string' ? { url: item } : item)
    .filter((item) => item?.url);
}

function publicResources(raw, videos) {
  const resources = [];
  const add = (url, name) => {
    if (!/^https?:\/\//i.test(url || '') || resources.some((item) => item.url === url)) return;
    resources.push({ url, name });
  };
  for (const item of [...(raw.info_urls || []), ...(raw.mission?.info_urls || [])]) {
    const url = typeof item === 'string' ? item : item?.url;
    add(url, item?.title || item?.name || '任务报道或资料');
  }
  for (const item of videos) add(item.url, item.title || item.name || '视频回放');
  return resources.slice(0, 3);
}

function displayOrigin(rawRocket, agency, siteCountry) {
  // 库鲁是法属圭亚那的发射地点；阿丽亚娜项目本身属于欧洲合作项目。
  // 因此卡片的旗帜/归属显示欧洲，地点字段仍忠实保留库鲁航天中心。
  if (/^Ariane\b/i.test(rawRocket)) return { alpha_2_code: 'EU', name: '欧洲（阿丽亚娜项目）', basis: 'launcher_program' };
  return siteCountry || agency.country || {};
}

export function normalizeLaunch(raw) {
  const agency = raw.launch_service_provider || {};
  const asCountry = (value) => Array.isArray(value) ? value[0] : value;
  // 发射国/地区优先按发射场判定，缺失时再用火箭制造方或发射机构国别补全。
  const siteCountry = asCountry(raw.pad?.country) || asCountry(raw.pad?.location?.country) || asCountry(raw.rocket?.configuration?.manufacturer?.country);
  const agencyType = agency.type?.name || agency.type || 'Unknown';
  const videos = videoLinks(raw);
  const rawName = raw.name || raw.mission?.name || '未命名任务';
  const rawRocket = raw.rocket?.configuration?.full_name || raw.rocket?.configuration?.name || '未知火箭';
  const country = displayOrigin(rawRocket, { ...agency, country: asCountry(agency.country) }, siteCountry);
  const rawLocation = raw.pad?.location?.name || null;
  const launch = {
    id: raw.id,
    uid: `${raw.id}@launch-calendar.local`,
    name: translateMissionName(rawName, raw.id), originalName: rawName,
    timing: {
      net: raw.net || null,
      windowStart: raw.window_start || raw.net || null,
      windowEnd: raw.window_end || raw.net || null,
      precision: translatePrecision(raw.net_precision?.name)
    },
    scheduleStatus: scheduleStatus(raw),
    result: launchResult(raw),
    launchStatus: raw.status?.name || null,
    lastUpdated: raw.last_updated || null,
    country: {
      code: country.alpha_2_code || 'XX',
      name: translateCountry(country.alpha_2_code, country.name),
      basis: country.basis || (raw.pad?.country || raw.pad?.location?.country ? 'launch_site' : raw.rocket?.configuration?.manufacturer?.country ? 'rocket_manufacturer' : agency.country ? 'launch_agency' : 'unknown')
    },
    region: REGION_BY_COUNTRY.get(country.alpha_2_code) || '其他',
    agency: {
      id: agency.id || null,
      name: translateAgency(agency.name), originalName: agency.name || null,
      ownership: /commercial|private/i.test(agencyType) ? 'private' : /government|multinational/i.test(agencyType) ? 'state' : 'unknown',
      type: agencyType
    },
    rocket: translateRocket(rawRocket), originalRocket: rawRocket,
    crewed: Boolean(raw.is_crewed),
    livestream: { available: videos.length > 0, live: Boolean(raw.webcast_live), urls: videos },
    resources: publicResources(raw, videos),
    mission: {
      name: translateMissionName(raw.mission?.name || '', raw.id), originalName: raw.mission?.name || null,
      type: raw.mission?.type || null,
      description: translateDescription(raw.mission?.description, rawName),
      orbit: raw.mission?.orbit?.name || null
    },
    pad: {
      name: raw.pad?.name || null,
      location: translateLocation(rawLocation), originalLocation: rawLocation,
      timezone: raw.pad?.location?.timezone_name || null,
      latitude: raw.pad?.latitude ?? raw.pad?.location?.latitude ?? null,
      longitude: raw.pad?.longitude ?? raw.pad?.location?.longitude ?? null
    },
    image: raw.image?.thumbnail_url || raw.image?.image_url || null,
    sources: sourceLinks(raw)
  };
  return { ...launch, rocketCloud: rocketCloudForecast(launch) };
}

export function normalizeLaunches(payload) {
  if (!payload || !Array.isArray(payload.results)) throw new TypeError('Upstream payload must contain a results array');
  return payload.results.map(normalizeLaunch).filter((launch) => launch.id && launch.timing.net);
}

export function filterLaunches(launches, params) {
  const values = (key) => params.getAll(key).flatMap((value) => value.split(',')).filter(Boolean);
  const includes = (key, value) => { const selected = values(key); return !selected.length || selected.some((x) => x.toLowerCase() === String(value).toLowerCase()); };
  const bool = (key, value) => !params.has(key) || params.get(key) === 'all' || (params.get(key) === 'true') === value;
  const now = Date.now();
  const days = Number(params.get('days') || 0);
  const until = days > 0 ? now + days * 86400000 : Infinity;
  const since = days > 0 ? now - days * 86400000 : -Infinity;
  const range = params.get('range') || 'upcoming';
  const query = (params.get('q') || '').trim().toLowerCase();
  const filtered = launches.filter((launch) => {
    const timestamp = launch.timing.net ? Date.parse(launch.timing.net) : null;
    // 无具体时间的中国补充计划也可展示，但会排在有时间的近期任务之后，且不会导出 ICS。
    const inRange = range === 'previous'
      ? timestamp !== null && timestamp >= since && timestamp <= now
      : (timestamp === null || timestamp <= until);
    return inRange &&
      includes('country', launch.country.code) && includes('region', launch.region) &&
      (includes('agency', launch.agency.name) || includes('agency', launch.agency.originalName)) && includes('ownership', launch.agency.ownership) &&
      (includes('rocket', launch.rocket) || includes('rocket', launch.originalRocket)) && includes('status', launch.scheduleStatus.code) &&
      bool('crewed', launch.crewed) && bool('livestream', launch.livestream.available) &&
      (!query || [launch.name, launch.originalName, launch.agency.name, launch.agency.originalName, launch.rocket, launch.originalRocket, launch.mission.name, launch.pad.location].some((value) => value?.toLowerCase().includes(query)));
  });
  // 回溯页以最近完成的任务优先，避免依赖上游分页或缓存原始顺序。
  return range === 'previous' ? filtered.sort((a, b) => Date.parse(b.timing.net) - Date.parse(a.timing.net)) : filtered;
}
import { translateAgency, translateCountry, translateDescription, translateLocation, translateMissionName, translatePrecision, translateRocket } from './translate.js';
import { rocketCloudForecast } from './rocket-cloud.js';
