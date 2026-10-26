// Curated sources never contribute to the count of reports submitted in this app.
export function attachArchiveEvidence(launch, records, now = Date.now()) {
  const time = Date.parse(launch.timing?.net || launch.net);
  const matches = records.filter(r => r.launchId === launch.id && Number.isFinite(time) && time <= now && Math.floor(Date.parse(r.time)/60000) === Math.floor(time/60000));
  if (!matches.length) return launch;
  const result = {...launch, archiveEvidence: matches};
  const confirmed = matches.find(r => r.evidence?.status === 'confirmed' && r.evidence.sources?.some(s => /^https:\/\//.test(s.url)));
  if (confirmed && launch.cloudEvidence?.observation?.status !== 'confirmed') result.cloudEvidence = {...launch.cloudEvidence, observation: {status:'confirmed', sources:confirmed.evidence.sources}};
  return result;
}
export function hasReplayEvidence(launch) {
  return launch.observationReportCount > 0 || launch.archiveEvidence?.length > 0 || (launch.cloudEvidence?.observation?.status === 'confirmed' && launch.cloudEvidence.observation.sources?.some(s => /^https:\/\//.test(s.url)));
}
let archivePromise;
export function loadArchiveRecords() {
  return archivePromise ||= fetch('./map/observation-archive.json', {signal:AbortSignal.timeout(8000)}).then(r => {if(!r.ok)throw Error('Archive unavailable');return r.json();}).then(data => data.records);
}
