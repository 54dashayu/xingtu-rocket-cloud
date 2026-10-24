import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSupplement, mergeSupplements } from '../src/supplements.js';
import { fetchLaunchPages, fetchUpcomingPages } from '../src/store.js';

const supplementInput = {
  id: 'example-1', name: '谷神星二号首飞任务', agency: { name: '星河动力' }, rocket: '谷神星二号',
  timing: { precision: '仅确定年份' }, scheduleStatus: 'tbd', confidence: 'official_planned',
  publishedAt: '2026-09-09T00:00:00Z', lastVerified: '2026-09-09T00:00:00Z',
  pad: { location: '发射地点待定' },
  sources: [{ name: '星河动力官方公告', url: 'https://www.galactic-energy.cn/' }]
};

test('normalizes a public Chinese commercial supplement without inventing a launch time', () => {
  const launch = normalizeSupplement(supplementInput);
  assert.equal(launch.id, 'china-commercial:example-1');
  assert.equal(launch.timing.net, null);
  assert.equal(launch.provenance.confidence, '官方预告');
  assert.equal(launch.uid, 'china-commercial:example-1@launch-calendar.local');
});

test('only explicit LL2 links merge supplemental official sources', () => {
  const supplemental = normalizeSupplement({ ...supplementInput, ll2Id: 'll2-1' });
  const merged = mergeSupplements([{ id: 'll2-1', sources: [{ name: 'LL2', url: 'https://example.test/ll2' }], timing: { net: '2026-10-01T00:00:00Z' }, lastUpdated: '2026-01-01T00:00:00Z' }], [supplemental]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].sources.length, 2);
  assert.equal(merged[0].provenance.kind, 'china_commercial_public');
});

test('follows paginated LL2 responses without duplicate page requests', async () => {
  const calls = [];
  const fetcher = async (url) => {
    calls.push(url);
    return { ok: true, json: async () => calls.length === 1 ? { results: [{ id: 'a' }], next: 'https://second.test/' } : { results: [{ id: 'b' }], next: null } };
  };
  const value = await fetchUpcomingPages(fetcher);
  assert.deepEqual(value.results.map((item) => item.id), ['a', 'b']);
  assert.equal(calls.length, 2);
});

test('uses the passed historical endpoint for a paginated fetch', async () => {
  const calls = [];
  await fetchLaunchPages('https://history.test/', async (url) => {
    calls.push(url);
    return { ok: true, json: async () => ({ results: [], next: null }) };
  });
  assert.deepEqual(calls, ['https://history.test/']);
});

test('preserves an upstream retry-after delay for cache refresh backoff', async () => {
  await assert.rejects(
    () => fetchLaunchPages('https://limited.test/', async () => ({ ok: false, status: 429, headers: { get: (key) => key === 'retry-after' ? '60' : null } })),
    (error) => error.message.includes('429') && error.retryAt > Date.now() + 59000
  );
});
