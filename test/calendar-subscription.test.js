import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createArchiveStore, subscriptionEntries, validSince } from '../src/calendar-archive.js';
import { createCalendar, createSubscriptionCalendar } from '../src/ics.js';
import { normalizeLaunches } from '../src/normalize.js';
const fixture = normalizeLaunches(JSON.parse(await readFile(new URL('./fixtures/launches.json', import.meta.url))));
const row = () => structuredClone(fixture[0]);
async function temporary(t) {
  const dir = await mkdtemp(join(tmpdir(), 'xingtu-calendar-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return join(dir, 'archive.json');
}
test('fixed start retains history after empty refresh and restart; concurrent writes preserve both tasks', async t => {
  const file = await temporary(t), store = createArchiveStore(file);
  await Promise.all([store.merge([row()]), store.merge([fixture[1]])]);
  await store.merge([]);
  const entries = (await createArchiveStore(file).read()).entries;
  assert.equal(entries.length, 2);
  assert.equal(subscriptionEntries(entries, '2026-08-22').length, 2);
  assert.equal(subscriptionEntries(entries, '2026-09-06').length, 1);
});
test('reschedule, cancellation, loss of date and restoration reuse UID with increasing sequence', async t => {
  const store = createArchiveStore(await temporary(t)), launch = row();
  let [entry] = await store.merge([launch], '2026-09-01T00:00:00Z');
  const originalSequence = entry.sequence;
  launch.timing.net = '2026-09-07T04:30:00Z'; launch.lastUpdated = '2026-09-02T00:00:00Z';
  [entry] = await store.merge([launch], '2026-09-02T00:00:00Z');
  let ics = createSubscriptionCalendar([entry]);
  assert.match(ics, /UID:china-1@launch-calendar.local/); assert.match(ics, /DTSTART:20260907T043000Z/);
  assert.ok(entry.sequence > originalSequence);
  const sequence = entry.sequence;
  launch.timing.net = null; launch.scheduleStatus = { code: 'postponed', label: '已推迟' }; launch.lastUpdated = '2026-09-03T00:00:00Z';
  [entry] = await store.merge([launch]); ics = createSubscriptionCalendar([entry]);
  assert.match(ics, /STATUS:CANCELLED/); assert.match(ics, /DTSTART:20260907T043000Z/); assert.ok(entry.sequence > sequence);
  launch.timing.net = '2026-09-08T00:00:00Z'; launch.scheduleStatus = { code: 'confirmed', label: '已确认' }; launch.lastUpdated = '2026-09-04T00:00:00Z';
  [entry] = await store.merge([launch]); ics = createSubscriptionCalendar([entry]);
  assert.match(ics, /STATUS:CONFIRMED/); assert.match(ics, /DTSTART:20260908T000000Z/);
  // Stale cache cannot restore the original time.
  [entry] = await store.merge([row()]); assert.match(createSubscriptionCalendar([entry]), /DTSTART:20260908T000000Z/);
  launch.scheduleStatus = { code: 'cancelled', label: '已取消' }; launch.lastUpdated = '2026-09-05T00:00:00Z';
  [entry] = await store.merge([launch]); assert.match(createSubscriptionCalendar([entry]), /STATUS:CANCELLED/);
});
test('identical snapshot leaves feed stable, result update changes event metadata', async t => {
  const store = createArchiveStore(await temporary(t));
  const entries = await store.merge([row()], '2026-09-01T00:00:00Z');
  assert.equal(createSubscriptionCalendar(await store.merge([row()], '2026-10-01T00:00:00Z')), createSubscriptionCalendar(entries));
  const launch = row(); launch.result = { code: 'success', label: '发射成功' };
  const updated = await store.merge([launch], '2026-10-01T00:00:00Z');
  assert.ok(updated[0].sequence > entries[0].sequence); assert.match(createSubscriptionCalendar(updated), /发射成功/);
});
test('invalid/corrupt archive fails closed without replacing history', async t => {
  const file = await temporary(t); await writeFile(file, '{broken');
  await assert.rejects(createArchiveStore(file).merge([row()])); assert.equal(await readFile(file, 'utf8'), '{broken');
});
test('single event has positive explicit duration, no alarm or METHOD request; low precision is all-day', () => {
  const ics = createCalendar([row()]);
  assert.match(ics, /DTEND:20260905T044000Z/); assert.doesNotMatch(ics, /VALARM|METHOD:/);
  const coarse = row(); coarse.timing = { net: '2026-12-31T20:30:00Z', precision: '精确到小时' };
  const allDay = createCalendar([coarse]); assert.match(allDay, /DTSTART;VALUE=DATE:20270101/); assert.match(allDay, /DTEND;VALUE=DATE:20270102/);
  coarse.timing.precision = '仅确定月份'; assert.doesNotMatch(createCalendar([coarse]), /BEGIN:VEVENT/);
});
test('start date validates real dates, rejects future and malformed values', () => {
  const now = Date.parse('2026-09-21T00:00:00Z');
  assert.equal(validSince('2026-08-22', now), true);
  for (const value of ['2026-02-30', '2026-09-22', 'foo', null, '2026-8-2']) assert.equal(validSince(value, now), false);
});

test('newer source timestamp is retained even if rendered event is unchanged', async t => {
  const store = createArchiveStore(await temporary(t)), launch = row();
  await store.merge([launch]);
  launch.lastUpdated = '2026-09-05T00:00:00Z'; await store.merge([launch]);
  const stale = row(); stale.lastUpdated = '2026-09-03T00:00:00Z'; stale.timing.net = '2026-09-20T00:00:00Z';
  const [entry] = await store.merge([stale]);
  assert.equal(entry.launch.timing.net, launch.timing.net);
});
