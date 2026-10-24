import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { config } from './config.js';
import { calendarTiming, launchToEvent } from './ics.js';

// Single service process; serialized atomic writes prevent simultaneous upstream refreshes
// from dropping history. A missing task is never treated as a deletion/cancellation.
export function createArchiveStore(file) {
  const path = file instanceof URL ? fileURLToPath(file) : file;
  let queue = Promise.resolve();
  async function read() {
    try {
      const value = JSON.parse(await readFile(path, 'utf8'));
      if (value.schemaVersion !== 1 || !Array.isArray(value.entries)) throw Error('Invalid calendar archive');
      return value;
    } catch (error) {
      if (error.code === 'ENOENT') return { schemaVersion: 1, entries: [] };
      throw error; // Never replace a damaged archive with an empty calendar.
    }
  }
  function merge(launches, now = new Date().toISOString()) {
    const job = queue.then(async () => {
      const state = await read(), entries = new Map(state.entries.map(x => [x.launch.id, x]));
      let changed = false;
      for (const launch of launches) {
        if (!launch?.id || !launch.uid) continue;
        const previous = entries.get(launch.id);
        if (previous && (Date.parse(previous.launch.lastUpdated) || 0) > (Date.parse(launch.lastUpdated) || 0)) continue;
        // Retain the former slot only to explicitly withdraw it when the date becomes unknown.
        const timing = calendarTiming(launch) || previous?.anchor;
        const event = launchToEvent(launch, { timing, modified: '2000-01-01T00:00:00Z', sequence: 0 });
        const fingerprint = createHash('sha256').update(JSON.stringify(event)).digest('hex');
        if (previous?.fingerprint === fingerprint) {
          if (JSON.stringify(previous.launch) !== JSON.stringify(launch)) {
            entries.set(launch.id, { ...previous, launch }); changed = true;
          }
          continue;
        }
        const upstreamSequence = Math.max(0, Math.floor((Date.parse(launch.lastUpdated) || 0) / 1000));
        entries.set(launch.id, { launch, anchor: timing, fingerprint,
          firstDate: previous?.firstDate || timing?.date || null,
          sequence: Math.max(upstreamSequence, (previous?.sequence ?? -1) + 1),
          modified: now });
        changed = true;
      }
      if (changed) {
        state.entries = [...entries.values()];
        await mkdir(dirname(path), { recursive: true });
        const temporary = path + '.tmp';
        await writeFile(temporary, JSON.stringify(state));
        await rename(temporary, path);
      }
      return state.entries;
    });
    queue = job.catch(() => {});
    return job;
  }
  return { merge, read: async () => { await queue; return read(); } };
}
export const calendarArchive = createArchiveStore(config.calendarArchiveFile);
export function validSince(value, now = Date.now()) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || '') && value >= '1900-01-01' &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value &&
    value <= new Date(now + 8 * 3600000).toISOString().slice(0, 10);
}
export function subscriptionEntries(entries, since) {
  return entries.filter(x => x.anchor && (x.anchor.date >= since || x.firstDate >= since))
    .sort((a, b) => a.anchor.date.localeCompare(b.anchor.date) || a.launch.id.localeCompare(b.launch.id));
}
