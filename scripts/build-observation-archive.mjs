import { readFile, writeFile } from 'node:fs/promises';

// Publish only curated source records, never private submissions or assumed site coordinates.
const source = JSON.parse(await readFile(new URL('../data/rocket-cloud-validation-cases.json', import.meta.url)));
const records = source.cases.map(c => ({
  id: c.id, launchId: c.launchId || null, evidence: c.evidence || null, name: c.name, time: c.utc, timeZone: c.site.timeZone,
  transcriptClaim: c.videoClaim, transcriptRegions: c.videoRegions,
  reportedRegions: c.publicReportRegions || [],
  observation: c.observation || null,
  sources: c.sources, notes: c.notes,
  sourceBasis: '用户提供的视频逐字稿及逐项整理的公开资料',
  trajectoryStatus: c.trajectoryStatus,
  reviewedOn: source.checkedOn
}));
await writeFile(new URL('../public/map/observation-archive.json', import.meta.url), JSON.stringify({
  schemaVersion: 1,
  scope: '首批七个参考案例，不代表完整年度资料库；逐字稿地区不是实测覆盖边界。',
  records
}, null, 2) + '\n');
