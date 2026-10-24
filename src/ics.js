function escapeText(value = '') {
  return String(value).replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}
function stamp(value) { return new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z'); }
function fold(line) {
  const chunks = []; let current = '';
  for (const char of line) {
    if (Buffer.byteLength(current + char, 'utf8') > 73) { chunks.push(current); current = ` ${char}`; } else current += char;
  }
  chunks.push(current); return chunks.join('\r\n');
}
export function calendarTiming(launch) {
  const ms = Date.parse(launch.timing?.net);
  if (!Number.isFinite(ms) || ['tbd', 'approximate', 'postponed'].includes(launch.scheduleStatus?.code)) return null;
  const precision = launch.timing.precision || '';
  if (!/分钟|秒|小时|日期|到日|minute|second|hour|^day$/i.test(precision)) return null;
  const date = new Date(ms + 8 * 3600000).toISOString().slice(0, 10);
  return { net: launch.timing.net, date, allDay: !/分钟|秒|minute|second/i.test(precision) };
}
export function launchToEvent(launch, options = {}) {
  const current = calendarTiming(launch), timing = current || options.timing;
  if (!timing) return [];
  const withdrawn = !current && launch.scheduleStatus.code !== 'cancelled';
  const cancelled = withdrawn || launch.scheduleStatus.code === 'cancelled';
  const result = launch.result?.code && launch.result.code !== 'pending' ? launch.result.label : '';
  const label = withdrawn ? '日期待定·原日程已撤销' : cancelled ? '已取消' : result || (timing.allDay ? '时刻待定' : '');
  const description = [
    launch.mission?.description,
    `计划状态：${launch.scheduleStatus.label}`, result && `发射结果：${result}`,
    `时间精度：${launch.timing?.precision || '未知'}；按北京时间归属日期。`,
    withdrawn ? '该任务已推迟或日期待定，此条仅用于撤销旧时间；原日期不再有效。' :
      timing.allDay ? '全天显示用于标记计划日期，不表示全天发射。' : '日历占位为10分钟，仅用于显示发射时刻，不代表任务或发射窗口时长。',
    `机构：${launch.agency?.name || '待定'}｜火箭：${launch.rocket || '待定'}`,
    `地点：${launch.pad?.name || launch.pad?.location || '待定'}`,
    '网址订阅会在日历软件刷新后更新；下载导入为一次性副本。发射前请再次核对。',
    ...(launch.sources || []).map(source => `${source.name}: ${source.url}`)
  ].filter(Boolean).join('\n');
  const modified = options.modified || launch.lastUpdated || launch.timing.net;
  const sequence = options.sequence ?? Math.max(0, Math.floor(Date.parse(modified) / 1000));
  const dates = timing.allDay
    ? [`DTSTART;VALUE=DATE:${timing.date.replace(/-/g, '')}`,
      `DTEND;VALUE=DATE:${new Date(Date.parse(timing.date) + 86400000).toISOString().slice(0, 10).replace(/-/g, '')}`]
    : [`DTSTART:${stamp(timing.net)}`, `DTEND:${stamp(Date.parse(timing.net) + 10 * 60000)}`];
  return ['BEGIN:VEVENT', `UID:${escapeText(launch.uid)}`, `DTSTAMP:${stamp(modified)}`,
    `LAST-MODIFIED:${stamp(modified)}`, `SEQUENCE:${sequence}`, ...dates,
    `SUMMARY:${escapeText((label ? `【${label}】` : '') + launch.name)}`,
    `DESCRIPTION:${escapeText(description)}`, `LOCATION:${escapeText(launch.pad?.location || launch.pad?.name || '')}`,
    `STATUS:${cancelled ? 'CANCELLED' : timing.allDay || ['tentative', 'net'].includes(launch.scheduleStatus.code) ? 'TENTATIVE' : 'CONFIRMED'}`,
    'TRANSP:TRANSPARENT', 'END:VEVENT'];
}
export function isCalendarEligible(launch) { return Boolean(calendarTiming(launch)); }
function calendar(events, name, subscription) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Xingtu//Launch Calendar//ZH-CN',
    'CALSCALE:GREGORIAN', `X-WR-CALNAME:${escapeText(name)}`, 'X-WR-TIMEZONE:Asia/Shanghai'];
  // Hints only: refresh timing remains controlled by each calendar client.
  if (subscription) lines.push('REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H');
  lines.push(...events.flat(), 'END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
export function createCalendar(launches, name = '全球航天发射日历') {
  return calendar(launches.map(x => launchToEvent(x)), name, false);
}
export function createSubscriptionCalendar(entries) {
  return calendar(entries.map(x => launchToEvent(x.launch, { timing: x.anchor, modified: x.modified, sequence: x.sequence })), '星途·全球航天发射日历', true);
}
