// One bounded update per dataset per document. Explicit refresh bypasses settled data;
// concurrent callers share the entire update, including a finite SWR completion window.
export function createMissionCache(fetcher = fetch, clock = Date.now, {
  delays = [3000, 6000, 12000], sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
} = {}) {
  const entries = new Map();
  return function read(url, {force = false, onSnapshot} = {}) {
    const old = entries.get(url);
    if (old && (old.pending || !force)) return old.promise;
    const entry = {pending:true};
    entry.promise = (async () => {
      let latest;
      for (let attempt = 0; attempt <= delays.length; attempt++) {
        try {
          const r = await fetcher(url, {cache:'no-store', signal:AbortSignal.timeout(20000)});
          if (!r.ok) throw Error(`HTTP ${r.status}`);
          const data = await r.json();
          if (!Array.isArray(data.results) || !data.meta) throw Error('API 格式错误');
          latest = data;
        } catch (error) {
          if (!latest) throw error;
          return {...latest, meta:{...latest.meta, clientUpdate:'failed'}};
        }
        if (!latest.meta.refreshing && !latest.meta.stale) return latest;
        // Respect upstream backoff; background ingestion continues independently.
        if (Date.parse(latest.meta.retryAt) > clock() || attempt === delays.length)
          return {...latest, meta:{...latest.meta, clientUpdate:'pending'}};
        if (attempt === 0) onSnapshot?.(latest);
        await sleep(delays[attempt]);
      }
    })().then(data => {entry.pending=false; return data;}).catch(error => {
      if (entries.get(url) === entry) entries.delete(url);
      throw error;
    });
    entries.set(url, entry);
    return entry.promise;
  };
}

// Keep completed assessments only for exactly unchanged mission inputs. Changed
// time, trajectory, fuel, evidence or task data creates a fresh object for re-evaluation.
export function reconcileMissions(previous, incoming) {
  const signature = launch => JSON.stringify(launch, (key, value) => key === 'cloudAssessment' ? undefined : value);
  const byId = new Map(previous.map(launch => [launch.id, launch]));
  return incoming.map(launch => {
    const old = byId.get(launch.id);
    return old && signature(old) === signature(launch) ? old : launch;
  });
}
