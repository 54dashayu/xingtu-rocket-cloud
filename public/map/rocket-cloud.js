// 火箭云（暮光尾迹）几何初判：只判断太阳—发射场的几何关系，
// 不把云量、实际轨迹、燃料与高空风等不可得因素伪装成确定预报。
const FACILITY_COORDINATES = [
  [/酒泉|Jiuquan/i, [40.96, 100.29]], [/文昌|Wenchang/i, [19.61, 110.95]],
  [/太原|Taiyuan/i, [38.85, 111.61]], [/西昌|Xichang/i, [28.25, 102.03]],
  [/海阳|Haiyang/i, [36.06, 121.17]], [/肯尼迪|卡纳维拉尔|Cape Canaveral/i, [28.56, -80.58]],
  [/范登堡|Vandenberg/i, [34.73, -120.57]], [/马希亚|Mahia/i, [-39.26, 177.86]],
  [/库鲁|Kourou|Guiana Space/i, [5.24, -52.77]], [/拜科努尔|Baikonur/i, [45.92, 63.34]],
  [/普列谢茨克|Plesetsk/i, [62.93, 40.58]], [/种子岛|Tanegashima/i, [30.40, 130.97]],
  [/萨蒂什|Satish Dhawan/i, [13.72, 80.23]], [/罗老|Naro/i, [34.43, 127.54]],
  [/安岛|Andøya/i, [69.29, 16.02]], [/萨克萨沃德|SaxaVord/i, [60.82, -0.88]]
];

import { solarAltitude } from './solar.js?v=20261024ad';
import { localSunContext } from './sun-events.js?v=20261024ad';
export { solarAltitude } from './solar.js?v=20261024ad';

export function launchCoordinates(pad = {}) {
  pad ||= {};
  const latitude = Number(pad.latitude), longitude = Number(pad.longitude);
  if (pad.latitude != null && pad.longitude != null && String(pad.latitude).trim() !== '' && String(pad.longitude).trim() !== '' && Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) return { latitude, longitude, source: '上游发射场坐标' };
  const searchable = `${pad.originalLocation || ''} ${pad.location || ''} ${pad.name || ''}`;
  const match = FACILITY_COORDINATES.find(([pattern]) => pattern.test(searchable));
  return match ? { latitude: match[1][0], longitude: match[1][1], source: '内置发射场坐标' } : null;
}

export function rocketCloudForecast(launch) {
  const net = launch?.timing?.net;
  if (!net || Number.isNaN(Date.parse(net))) return { code: 'unavailable', label: '暂不判断', reason: '尚无可计算的发射时刻' };
  if (['cancelled', 'postponed', 'tbd', 'approximate'].includes(launch?.scheduleStatus?.code)) return { code: 'unavailable', label: '暂不判断', reason: '发射计划尚不稳定' };
  if (!/分钟|秒|小时|minute|second|hour/i.test(launch?.timing?.precision || '')) return { code: 'unavailable', label: '暂不判断', reason: '发射时刻精度不足' };
  const coordinates = launchCoordinates(launch.pad);
  if (!coordinates) return { code: 'unavailable', label: '暂不判断', reason: '发射场坐标待补充' };
  const altitude = solarAltitude(net, coordinates.latitude, coordinates.longitude);
  const localSun = localSunContext(net, coordinates, launch.pad);
  // -12° 到 -1°：地面已暗且高空尾迹可能仍受太阳照亮。
  const code = altitude >= -12 && altitude <= -1 ? 'favorable' : altitude >= -18 && altitude <= 4 ? 'possible' : 'unlikely';
  const labels = { favorable: '值得留意', possible: '可能形成', unlikely: '条件一般' };
  const reasons = {
    favorable: '发射场处于晨昏段，高空尾迹可能仍受太阳照亮',
    possible: '接近晨昏线，是否显著可见仍受轨迹、燃料与天气影响',
    unlikely: '发射场不在本模型的典型晨昏段；这不是实际可见性概率'
  };
  return { code, label: labels[code], reason: reasons[code], solarAltitude: Number(altitude.toFixed(1)), coordinateSource: coordinates.source, localSun,
    disclaimer: '这是太阳几何初判，不含天气、能见度、实际飞行轨迹和高空风；不保证可见。' };
}
