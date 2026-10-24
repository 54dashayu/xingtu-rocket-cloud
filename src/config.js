import { pathToFileURL } from 'node:url';

const configuredFile = (value, fallback) => value ? pathToFileURL(value) : fallback;

export const config = {
  host: process.env.HOST || '127.0.0.1',
  port: Number(process.env.PORT || 4173),
  cacheTtlMs: Number(process.env.CACHE_TTL_MS || 30 * 60 * 1000),
  // Launch Library 2 的单页上限为 100。多取几页可减少高密度发射期的漏项，
  // 仍由 30 分钟服务端缓存约束上游请求量。
  upstreamPages: Math.max(1, Number(process.env.LAUNCH_LIBRARY_PAGES || 3)),
  upstreamUrl:
    process.env.LAUNCH_LIBRARY_URL ||
    'https://ll.thespacedevs.com/2.3.0/launches/upcoming/?format=json&limit=100&mode=normal&ordering=net&hide_recent_previous=true',
  previousUrl:
    process.env.LAUNCH_LIBRARY_PREVIOUS_URL ||
    'https://ll.thespacedevs.com/2.3.0/launches/previous/?format=json&limit=100&ordering=-net',
  // 生产环境将这两项指向 release 目录外的共享路径，版本切换不会丢失热缓存。
  cacheFile: configuredFile(process.env.CACHE_FILE, new URL('../data/cache.json', import.meta.url)),
  historyCacheFile: configuredFile(process.env.HISTORY_CACHE_FILE, new URL('../data/history-cache.json', import.meta.url)),
  calendarArchiveFile: configuredFile(process.env.CALENDAR_ARCHIVE_FILE, new URL('calendar-archive.json', configuredFile(process.env.CACHE_FILE, new URL('../data/cache.json', import.meta.url)))),
  historyResourcesFile: new URL('../data/history-resources.json', import.meta.url),
  supplementFile: new URL('../data/china-commercial-launches.json', import.meta.url),
  publicDir: new URL('../public/', import.meta.url),
  userAgent: 'YouthSpaceLaunchCalendar/0.1 (+local educational MVP)'
};
