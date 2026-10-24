import test from 'node:test';
import assert from 'node:assert/strict';
import { launchCoordinates, rocketCloudForecast, solarAltitude } from '../src/rocket-cloud.js';

const base = {
  timing: { net: '2026-03-20T10:00:00Z', precision: '精确到分钟' },
  scheduleStatus: { code: 'confirmed' },
  pad: { location: '中国酒泉卫星发射中心' }
};

test('solar altitude distinguishes a local noon from a twilight instant', () => {
  const noon = solarAltitude('2026-03-20T04:00:00Z', 40.96, 100.29);
  const night = solarAltitude('2026-03-20T16:00:00Z', 40.96, 100.29);
  assert.ok(noon > 20); assert.ok(night < -10);
});

test('uses known launch-site coordinates and returns an explainable result', () => {
  assert.deepEqual(launchCoordinates({ location: '中国酒泉卫星发射中心' }), { latitude: 40.96, longitude: 100.29, source: '内置发射场坐标' });
  const forecast = rocketCloudForecast(base);
  assert.match(forecast.label, /值得留意|可能形成|条件一般/);
  assert.equal(typeof forecast.solarAltitude, 'number');
});

test('marks a twilight launch as worth watching but does not promise visibility', () => {
  const forecast = rocketCloudForecast({ ...base, timing: { net: '2026-03-20T12:00:00Z', precision: '精确到分钟' } });
  assert.equal(forecast.code, 'favorable');
  assert.match(forecast.disclaimer, /不保证可见/);
});

test('does not invent a rocket-cloud prediction for an imprecise or cancelled launch', () => {
  assert.equal(rocketCloudForecast({ ...base, timing: { net: base.timing.net, precision: '仅确定月份' } }).code, 'unavailable');
  assert.equal(rocketCloudForecast({ ...base, scheduleStatus: { code: 'cancelled' } }).code, 'unavailable');
});
