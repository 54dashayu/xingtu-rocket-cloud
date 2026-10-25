/* First-party page counts and foreground duration. No fingerprint or persistent visitor ID. */
(() => {
  const pages = { '/launch/': 'launch', '/launch/index.html': 'launch', '/launch/map.html': 'rocket-cloud', '/rocket-cloud/': 'rocket-cloud', '/rocket-cloud/index.html': 'rocket-cloud', '/rocket-cloud/map.html': 'rocket-cloud' };
  const site = pages[location.pathname];
  if (!site || window.__xingtuTracked || navigator.doNotTrack === '1') return;
  window.__xingtuTracked = true;
  const uid = () => crypto.randomUUID().replaceAll('-', '');
  let session;
  try {
    const saved = JSON.parse(sessionStorage.getItem('xingtu-visit') || 'null');
    session = saved && Date.now() - saved.at < 30 * 60 * 1000 ? saved.id : uid();
  } catch { session = uid(); }
  let referrer = '';
  try { referrer = new URL(document.referrer).origin; } catch {}
  const page = uid(), began = performance.now();
  let active = 0, visibleSince = document.visibilityState === 'visible' ? began : null;
  const accrue = () => {
    const now = performance.now();
    if (visibleSince !== null) active += Math.max(0, now - visibleSince);
    visibleSince = document.visibilityState === 'visible' ? now : null;
  };
  const send = () => {
    accrue();
    try { sessionStorage.setItem('xingtu-visit', JSON.stringify({ id: session, at: Date.now() })); } catch { /* storage may be blocked */ }
    const payload = JSON.stringify({ page, session, site, path: location.pathname, referrer,
      elapsed_ms: Math.round(performance.now() - began), active_ms: Math.round(active) });
    const url = '/xingtu-analytics/event';
    if (!navigator.sendBeacon?.(url, new Blob([payload], { type: 'text/plain' }))) {
      fetch(url, { method: 'POST', body: payload, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(() => {});
    }
  };
  send();
  setInterval(() => { if (document.visibilityState === 'visible') send(); }, 15000);
  document.addEventListener('visibilitychange', send);
  window.addEventListener('pagehide', () => { send(); visibleSince = null; });
  window.addEventListener('pageshow', e => { if (e.persisted) { visibleSince = document.visibilityState === 'visible' ? performance.now() : null; send(); } });
})();
