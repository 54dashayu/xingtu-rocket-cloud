import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeLaunches } from '../src/normalize.js';
import { createCalendar } from '../src/ics.js';

const payload = JSON.parse(await readFile(new URL('./fixtures/launches.json', import.meta.url)));
const launches = normalizeLaunches(payload);

test('creates valid calendar framing and UTC DTSTART', () => {
  const ics = createCalendar([launches[0]]);
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /DTSTART:20260905T043000Z/);
  assert.match(ics, /END:VCALENDAR\r\n$/);
});

test('uses stable source ID as UID and update time as sequence metadata', () => {
  const ics = createCalendar([launches[0]]);
  assert.match(ics, /UID:china-1@launch-calendar\.local/);
  assert.match(ics, /LAST-MODIFIED:20260831T100000Z/);
  assert.match(ics, /SEQUENCE:\d+/);
});

test('marks dated cancelled launches as cancelled', () => { const launch = structuredClone(launches[0]); launch.scheduleStatus = { code: 'cancelled', label: '已取消' }; assert.match(createCalendar([launch]), /STATUS:CANCELLED/); });
test('does not turn a time-to-be-determined launch into an invented ICS event', () => {
  const uncertain = structuredClone(launches[0]);
  uncertain.timing.net = null;
  uncertain.scheduleStatus = { code: 'tbd', label: '时间待定' };
  assert.doesNotMatch(createCalendar([uncertain]), /BEGIN:VEVENT/);
});
test('folds every physical line to at most 75 UTF-8 octets', () => {
  const ics = createCalendar(launches);
  for (const line of ics.split('\r\n')) assert.ok(Buffer.byteLength(line, 'utf8') <= 75, `line too long: ${line}`);
});
