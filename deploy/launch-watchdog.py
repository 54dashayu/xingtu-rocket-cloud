#!/usr/bin/env python3
"""Independent launch-feed supervisor. Never edits launch data or quota files."""
import argparse
import datetime as dt
import fcntl
import json
import os
from pathlib import Path
import subprocess
import time
import urllib.request

STALE = 45 * 60
NO_PROGRESS = 20 * 60
HANG = 5 * 60
COOLDOWN = 30 * 60
SERVICES = {'rocket-cloud': 4179, 'launch-calendar': 4173}


def epoch(value):
    if isinstance(value, (float, int)):
        return value / 1000  # Snapshot retryAt uses JS milliseconds.
    try:
        return dt.datetime.fromisoformat(value.replace('Z', '+00:00')).timestamp()
    except (ValueError, AttributeError, TypeError):
        return 0


def evaluate(snapshot, meta, prior, now, writer):
    """Pure decision; two consecutive unhealthy checks before a restart request."""
    record = dict(prior)
    issue = None
    status = 'healthy'
    stale = []
    feeds = snapshot.get('feeds', {}) if snapshot else {}
    for name in ('upcoming', 'history'):
        if now - epoch(feeds.get(name, {}).get('fetchedAt')) > STALE:
            stale.append(name)
    if meta is None:
        issue = 'api_unresponsive'
    elif not snapshot:
        issue = 'snapshot_unreadable' if writer else None
    elif meta.get('revision', -1) < snapshot.get('revision', 0):
        issue = 'reader_behind_snapshot'
    if writer and meta is not None and snapshot:
        signature = snapshot.get('revision')
        if meta.get('refreshing'):
            if not prior.get('refreshingSince') or prior.get('revision') != signature:
                record['refreshingSince'] = now
            if now - record['refreshingSince'] >= HANG:
                issue = 'refresh_stuck'
        else:
            record.pop('refreshingSince', None)
        record['revision'] = signature
        if stale and not issue:
            status = 'upstream_retrying'
            for name in stale:
                feed = feeds.get(name, {})
                retry = max(epoch(feed.get('retryAt')), epoch(snapshot.get('globalRetryAt')))
                checked = epoch(feed.get('checkedAt') or feed.get('fetchedAt'))
                if retry > now:
                    status = 'upstream_cooldown'
                elif now - checked > NO_PROGRESS:
                    issue = 'stale_without_progress'
    record['staleFeeds'] = stale
    record['checkedAt'] = now
    record['issue'] = issue
    record['badChecks'] = prior.get('badChecks', 0) + 1 if issue else 0
    record['status'] = issue or status
    history = [t for t in prior.get('restarts', []) if now - t < 6 * 3600]
    record['restarts'] = history
    action = False
    if issue and record['badChecks'] >= 2:
        if history and now - history[-1] < COOLDOWN:
            record['status'] = 'recovery_cooldown'
        elif len(history) >= 3:
            record['status'] = 'recovery_limit_reached'
        else:
            action = True
    return record, action


def read_snapshot(path):
    try:
        value = json.loads(path.read_text())
        if value.get('schemaVersion') == 1 and isinstance(value.get('entries'), list) and isinstance(value.get('feeds'), dict):
            return value
    except (OSError, ValueError, TypeError, AttributeError):
        pass
    return None


def probe(port):
    try:
        # Loopback only, no forced refresh and no direct upstream requests.
        with urllib.request.urlopen(f'http://127.0.0.1:{port}/api/launches?days=30', timeout=12) as response:
            meta = json.load(response).get('meta')
            if isinstance(meta, dict) and isinstance(meta.get('revision'), int):
                return meta
    except (OSError, ValueError, AttributeError):
        pass
    return None


def save(path, state):
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(state, ensure_ascii=False, indent=2) + '\n')
    os.chmod(temporary, 0o600)
    temporary.replace(path)


def run(directory, snapshot_path, dry_run=False):
    directory.mkdir(parents=True, exist_ok=True)
    with (directory / 'lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        state_path = directory / 'status.json'
        try:
            state = json.loads(state_path.read_text())
        except (OSError, ValueError):
            state = {}
        events = state.setdefault('events', [])
        for service, port in SERVICES.items():
            # Read before probing to avoid mistaking a concurrently published revision for reader lag.
            snapshot = read_snapshot(snapshot_path)
            meta = probe(port)
            now = time.time()
            previous = state.get(service, {})
            record, restart = evaluate(snapshot, meta, previous, now, service == 'rocket-cloud')
            state[service] = record
            if previous.get('status') != record['status']:
                events.append({'at': now, 'service': service, 'status': record['status']})
            if restart:
                if dry_run:
                    record['wouldRestart'] = True
                else:
                    # Persist the attempt BEFORE systemctl, including failed/timed-out attempts.
                    record['restarts'].append(now)
                    events.append({'at': now, 'service': service, 'action': 'restart', 'reason': record['issue']})
                    state['events'] = events[-100:]
                    save(state_path, state)
                    try:
                        result = subprocess.run(['systemctl', 'restart', service], capture_output=True, text=True, timeout=40)
                        record['restartResult'] = 'accepted' if result.returncode == 0 else 'failed'
                    except subprocess.TimeoutExpired:
                        record['restartResult'] = 'timed_out'
                    # A successful systemctl call is not a successful data refresh. Next check verifies it.
                    record.pop('refreshingSince', None)
                    record['badChecks'] = 0
            print(json.dumps({'service': service, **record}, ensure_ascii=False), flush=True)
        state['events'] = events[-100:]
        if not dry_run:
            save(state_path, state)
        return state


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--state-dir', type=Path, default=Path('/var/lib/xingtu-launch-watchdog'))
    parser.add_argument('--snapshot', type=Path, default=Path('/opt/rocket-cloud/shared/data/launch-snapshot.json'))
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    run(args.state_dir, args.snapshot, args.dry_run)
