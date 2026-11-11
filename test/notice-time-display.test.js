import test from 'node:test';
import assert from 'node:assert/strict';
import {launchTimePair,noticeTimeRange} from '../public/map/time-display.js';
test('notice window identifies morning and evening in each time zone',()=>{
 const launch={pad:{timezone:'Asia/Shanghai'},timing:{basis:'notice_window',windowStart:'2026-11-18T22:43:00Z',windowEnd:'2026-11-18T23:10:00Z'}};
 const text=launchTimePair(launch);
 assert.equal(text.beijing,'11/19 清晨 06:43—11/19 清晨 07:10');
 assert.match(text.note,/24小时制/);
 assert.equal(noticeTimeRange('2026-11-19T10:43:00Z','2026-11-19T11:10:00Z'),'11/19 傍晚 18:43—11/19 晚上 19:10');
 assert.equal(noticeTimeRange('2026-11-18T22:43:00Z','2026-11-18T23:10:00Z','America/Los_Angeles'),'11/18 下午 14:43—11/18 下午 15:10');
});
