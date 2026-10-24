import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeLaunches, filterLaunches } from '../src/normalize.js';
import { translateAgency, translateLocation, translateMissionName, translateRocket } from '../src/translate.js';

const payload = JSON.parse(await readFile(new URL('./fixtures/launches.json', import.meta.url)));
const launches = normalizeLaunches(payload);

test('normalizes country, ownership, crew and livestream fields', () => {
  assert.equal(launches[0].region, '中国');
  assert.equal(launches[0].agency.ownership, 'state');
  assert.equal(launches[0].crewed, true);
  assert.equal(launches[0].livestream.available, true);
  assert.deepEqual(launches[0].resources, [{ url: 'https://video.example/live', name: '视频回放' }]);
});

test('translates common mission, rocket, agency, location and precision terms', () => {
  assert.equal(launches[0].name, '长征2F｜Shenzhou Test');
  assert.equal(launches[0].rocket, '长征2F');
  assert.equal(launches[0].agency.name, '中国载人航天工程办公室');
  assert.equal(launches[0].pad.location, '中国酒泉卫星发射中心');
  assert.equal(launches[0].timing.precision, '精确到分钟');
  assert.equal(launches[0].country.name, '中国');
  assert.equal(launches[1].rocket, '猎鹰9号 Block 5型');
  assert.match(launches[1].name, /猎鹰9号/);
});

test('uses common Chinese news names for Chinese commercial launch vehicles', () => {
  assert.equal(translateRocket('Gravity-1'), '引力一号');
  assert.equal(translateRocket('Zhuque-2E Block 2'), '朱雀二号E型');
  assert.equal(translateRocket('Zhuque-3'), '朱雀三号');
  assert.equal(translateRocket('Pallas-1'), '智神星一号');
  assert.equal(translateAgency('Galactic Energy'), '星河动力');
  assert.equal(translateAgency('LandSpace'), '蓝箭航天');
  assert.equal(translateAgency('Orienspace Technology'), '东方空间');
  assert.equal(translateMissionName('Gravity-1 | Unknown Payload'), '引力一号｜未知载荷');
  assert.equal(translateRocket('Kuaizhou 11'), '快舟11');
  assert.equal(translateMissionName('Ariane 64 Block 2 | Amazon Leo'), '阿丽亚娜64 Block 2｜亚马逊利奥');
  assert.equal(translateMissionName('Falcon Heavy | Test Payload'), '猎鹰重型｜Test Payload');
  assert.equal(translateMissionName('Pallas-1 | Demo Flight'), '智神星一号｜验证飞行');
  assert.equal(translateMissionName('Long March 6C | 7 satellites'), '长征6C｜一箭七星');
  assert.equal(translateMissionName('Zhuque-3 | Honghu-03'), '朱雀三号｜鸿鹄03');
  assert.equal(translateMissionName('Falcon Heavy | Nancy Grace Roman Space Telescope'), '猎鹰重型｜罗曼空间望远镜');
  assert.equal(translateMissionName('Long March 4B | Yaogan 53-01 to 03/56-01 to 03'), '长征4B｜遥感五十三号01星至03星、遥感五十六号01星至03星');
  assert.equal(translateMissionName('Zhuque-2E Block 2 | SpaceSail Polar Group #15'), '朱雀二号E型｜千帆极轨15组卫星');
  assert.equal(translateMissionName('Gravity-1 | SpaceSail Polar Group #16'), '引力一号｜千帆极轨26组卫星及欧洲高通量技术试验卫星');
  assert.equal(translateMissionName('Kinetica 1 | 9 satellites'), '力箭一号｜一箭九星');
  assert.equal(translateMissionName('Long March 12 | SatNet LEO Group 25'), '长征12｜卫星互联网低轨25组卫星');
  assert.equal(translateMissionName('H3-24 | Martian Moon eXplorer (MMX)'), 'H3运载火箭24号｜火星卫星探测器');
  assert.equal(translateLocation('Haiyang Oriental Spaceport'), '山东海阳东方航天港');
});

test('uses common Chinese payload and upper-stage names in historical cards', () => {
  assert.equal(translateMissionName('Zhuque-3 | Honghu-03'), '朱雀三号｜鸿鹄03');
  assert.equal(translateMissionName('Soyuz 2.1b/Fregat | Glonass-K1 No. 19'), '联盟2.1b／弗雷加特｜格洛纳斯-K1 第19号');
  assert.equal(translateMissionName('Long March 2C | Satellite for Earth Observation (SEO)'), '长征2C｜对地观测卫星');
  assert.equal(translateRocket('Soyuz 2.1b Fregat'), '联盟2.1b 弗雷加特');
});

test('shows Ariane launches as a European programme while retaining the launch-site location', () => {
  const ariane = structuredClone(payload.results[0]);
  ariane.rocket.configuration.full_name = 'Ariane 62';
  ariane.pad.location.name = 'Guiana Space Centre, French Guiana';
  ariane.pad.country = { alpha_2_code: 'GF', name: 'French Guiana' };
  const launch = normalizeLaunches({ results: [ariane] })[0];
  assert.equal(launch.country.code, 'EU');
  assert.equal(launch.country.name, '欧洲（阿丽亚娜项目）');
  assert.equal(launch.country.basis, 'launcher_program');
  assert.equal(launch.pad.location, '法属圭亚那库鲁航天中心');
});

test('maps confidence and exceptional schedule states', () => {
  assert.equal(launches[0].scheduleStatus.code, 'confirmed');
  assert.equal(launches[1].scheduleStatus.code, 'tentative');
  assert.equal(launches[2].scheduleStatus.code, 'cancelled');
});

test('maps final upstream launch status to a Chinese verification result', () => {
  const successful = structuredClone(payload.results[0]);
  successful.status = { name: 'Launch Successful', abbrev: 'Success' };
  const failed = structuredClone(payload.results[0]);
  failed.status = { name: 'Launch Failure', abbrev: 'Failure' };
  assert.equal(normalizeLaunches({ results: [successful] })[0].result.label, '发射成功');
  assert.equal(normalizeLaunches({ results: [failed] })[0].result.label, '发射失败');
});

test('filters a previous 30-day result window rather than future launches', () => {
  const recent = structuredClone(launches[0]); recent.timing.net = new Date(Date.now() - 2 * 86400000).toISOString();
  const newest = structuredClone(launches[0]); newest.id = 'newest'; newest.timing.net = new Date(Date.now() - 1 * 86400000).toISOString();
  const old = structuredClone(launches[0]); old.id = 'old'; old.timing.net = new Date(Date.now() - 40 * 86400000).toISOString();
  const future = structuredClone(launches[0]); future.id = 'future'; future.timing.net = new Date(Date.now() + 2 * 86400000).toISOString();
  assert.deepEqual(filterLaunches([recent, old, newest, future], new URLSearchParams({ range: 'previous', days: '30' })).map((item) => item.id), ['newest', 'china-1']);
});

test('filters by region, agency ownership, rocket, crew and livestream', () => {
  const params = new URLSearchParams({ region: '中国', ownership: 'state', rocket: 'Long March 2F', crewed: 'true', livestream: 'true' });
  assert.deepEqual(filterLaunches(launches, params).map((item) => item.id), ['china-1']);
  assert.deepEqual(filterLaunches(launches, new URLSearchParams({ agency: 'SpaceX' })).map((item) => item.id), ['usa-1']);
});

test('keeps a stable UID when launch time changes', () => {
  const moved = structuredClone(payload.results[0]); moved.net = '2026-09-06T04:30:00Z';
  assert.equal(normalizeLaunches({ results: [moved] })[0].uid, launches[0].uid);
});

test('UTC instant renders as the expected Beijing time', () => {
  const value = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(launches[0].timing.net));
  assert.equal(value, '12:30');
});

test('untranslated rocket and payload names remain visible', () => {
  assert.equal(translateRocket('Unmapped Rocket X'), 'Unmapped Rocket X');
  assert.equal(translateMissionName('Unmapped Rocket X | Payload Z'), 'Unmapped Rocket X｜Payload Z');
  assert.equal(translateRocket(''), '未知火箭');
});

test('verified Chinese rocket and payload names survive upstream English and cache replay', () => {
  assert.equal(translateRocket('Ceres-1S'), '谷神星一号海射型');
  assert.equal(translateRocket('Ceres-1'), '谷神星一号');
  assert.equal(translateMissionName('Ceres-1S | Xiguang-4 01'), '谷神星一号海射型｜西光肆号01星');
  assert.equal(translateMissionName('Yaogan 40 Group 04'), '遥感四十号04组卫星');
  const id = 'dfcabb3c-078b-4f5b-a47c-0161f248cee9';
  assert.match(translateMissionName('Zhuque-2E Block 2 | 10 satellites', id), /国星宇航星时代-39、44至50星及光传-03、04星/);
  assert.equal(translateMissionName('10 satellites', 'another-launch'), '10 satellites');
});
