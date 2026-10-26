// Deduplicate preloading and replay requests; explicit refresh bypasses settled data.
export function createMissionCache(fetcher = fetch, clock = Date.now) {
  const entries = new Map();
  return function read(url, {force = false} = {}) {
    const old = entries.get(url);
    if (old && (old.pending || (!force && clock() - old.at < 300000))) return old.promise;
    const entry = {at:clock(), pending:true};
    entry.promise = fetcher(url, {signal:AbortSignal.timeout(20000)}).then(async r => {
      if (!r.ok) throw Error(`HTTP ${r.status}`);
      const data=await r.json();if(!Array.isArray(data.results))throw Error('API 格式错误');
      entry.pending=false;entry.at=clock();return data;
    }).catch(e => {if(entries.get(url)===entry)entries.delete(url);throw e;});
    entries.set(url,entry);return entry.promise;
  };
}
