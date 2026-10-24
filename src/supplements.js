import { readFile } from 'node:fs/promises';
import { config } from './config.js';

const CONFIDENCE = new Map([
  ['official_confirmed', { label: '官方已确认', rank: 4 }],
  ['official_planned', { label: '官方预告', rank: 3 }],
  ['cross_checked', { label: '多来源核验', rank: 2 }],
  ['pending_review', { label: '待核验', rank: 1 }]
]);

const STATUS = new Map([
  ['confirmed', '已确认'], ['tentative', '暂定'], ['net', '不早于'],
  ['approximate', '时间范围'], ['tbd', '时间待定'], ['postponed', '已推迟'], ['cancelled', '已取消']
]);

function required(value, field, id) {
  if (!value) throw new TypeError(`补充任务 ${id || '未知'} 缺少 ${field}`);
  return value;
}

function source(item, id) {
  const url = required(item.url, '来源链接', id);
  if (!/^https:\/\//.test(url)) throw new TypeError(`补充任务 ${id} 的来源必须使用 HTTPS`);
  return { name: required(item.name, '来源名称', id), url, role: item.role || 'official' };
}

export function normalizeSupplement(item) {
  const id = required(item.id, 'id');
  const status = item.scheduleStatus || 'tbd';
  const confidence = CONFIDENCE.get(item.confidence || 'pending_review') || CONFIDENCE.get('pending_review');
  const timing = item.timing || {};
  if (timing.net && Number.isNaN(Date.parse(timing.net))) throw new TypeError(`补充任务 ${id} 的时间格式无效`);
  return {
    id: `china-commercial:${id}`,
    uid: `china-commercial:${id}@launch-calendar.local`,
    name: required(item.name, '任务名称', id), originalName: item.originalName || null,
    timing: {
      net: timing.net || null,
      windowStart: timing.windowStart || timing.net || null,
      windowEnd: timing.windowEnd || timing.net || null,
      precision: timing.precision || '时间待定'
    },
    scheduleStatus: { code: status, label: STATUS.get(status) || '时间待定', upstream: '中国商业航天公开信息' },
    launchStatus: '中国商业航天公开信息',
    lastUpdated: item.lastVerified || item.publishedAt || new Date(0).toISOString(),
    country: { code: 'CN', name: '中国', basis: 'launch_site' },
    region: '中国',
    agency: {
      id: item.agency?.id || null,
      name: required(item.agency?.name, '发射机构', id),
      originalName: item.agency?.originalName || null,
      ownership: 'private', type: 'Commercial'
    },
    rocket: required(item.rocket, '运载火箭', id), originalRocket: item.originalRocket || null,
    crewed: false,
    livestream: { available: false, live: false, urls: [] },
    mission: {
      name: item.mission?.name || item.name,
      originalName: item.mission?.originalName || null,
      type: item.mission?.type || '商业发射计划',
      description: item.mission?.description || '任务详情以公开来源后续更新为准。',
      orbit: item.mission?.orbit || null
    },
    pad: {
      name: item.pad?.name || null,
      location: item.pad?.location || '发射地点待定',
      originalLocation: item.pad?.originalLocation || null,
      timezone: item.pad?.timezone || 'Asia/Shanghai'
    },
    image: null,
    sources: (item.sources || []).map((entry) => source(entry, id)),
    provenance: {
      kind: 'china_commercial_public',
      label: '中国商业航天补充',
      confidence: confidence.label,
      confidenceRank: confidence.rank,
      publishedAt: item.publishedAt || null,
      lastVerified: item.lastVerified || null
    },
    // 若已人工确认与 LL2 条目完全一致，可填写对应 ID，系统才会合并，避免猜测性去重。
    ll2Id: item.ll2Id || null
  };
}

export async function getSupplements() {
  const value = JSON.parse(await readFile(config.supplementFile, 'utf8'));
  if (value.schemaVersion !== 1 || !Array.isArray(value.launches)) throw new TypeError('中国商业航天补充池格式无效');
  return value.launches.map(normalizeSupplement);
}

export function mergeSupplements(launches, supplements) {
  const byId = new Map(launches.map((launch) => [launch.id, { ...launch, sources: [...launch.sources] }]));
  const standalone = [];
  for (const supplement of supplements) {
    const matched = supplement.ll2Id && byId.get(supplement.ll2Id);
    if (!matched) { standalone.push(supplement); continue; }
    for (const item of supplement.sources) if (!matched.sources.some((known) => known.url === item.url)) matched.sources.push(item);
    matched.provenance = supplement.provenance;
    matched.lastUpdated = [matched.lastUpdated, supplement.lastUpdated].filter(Boolean).sort().at(-1);
  }
  return [...byId.values(), ...standalone].sort((a, b) => {
    const aTime = a.timing.net ? Date.parse(a.timing.net) : Infinity;
    const bTime = b.timing.net ? Date.parse(b.timing.net) : Infinity;
    return aTime - bTime;
  });
}
