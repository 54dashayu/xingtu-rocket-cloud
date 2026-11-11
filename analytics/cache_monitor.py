"""Read-only, authenticated monitor data. No privileged recovery controls."""
import json
import os
from pathlib import Path
import subprocess
import time
import datetime as dt

STATUS_PATH = Path(os.getenv('XINGTU_WATCHDOG_STATUS', '/var/lib/xingtu-launch-watchdog/status.json'))


def timer_status():
    try:
        r = subprocess.run(['systemctl', 'show', 'xingtu-launch-watchdog.timer',
                            '--property=ActiveState,UnitFileState'], capture_output=True, text=True, timeout=2)
        if r.returncode:
            return {'active': 'unknown', 'enabled': 'unknown'}
        props = dict(line.split('=', 1) for line in r.stdout.splitlines() if '=' in line)
        return {'active': props.get('ActiveState', 'unknown'), 'enabled': props.get('UnitFileState', 'unknown')}
    except (OSError, subprocess.TimeoutExpired):
        return {'active': 'unknown', 'enabled': 'unknown'}


def timestamp(value):
    try:
        return dt.datetime.fromisoformat(value.replace('Z', '+00:00')).timestamp()
    except (AttributeError, ValueError, TypeError):
        return None


def overview(path=None, now=None, timer=None):
    now = time.time() if now is None else now
    timer = timer_status() if timer is None else timer
    try:
        state = json.loads((path or STATUS_PATH).read_text())
        if not isinstance(state, dict):
            raise ValueError()
    except (OSError, ValueError):
        state = {}
    services = []
    for key, name in [('rocket-cloud', '火箭云 / 共享数据刷新'), ('launch-calendar', '发射日历 / 小程序接口')]:
        row = state.get(key, {})
        checked = row.get('checkedAt')
        recent = isinstance(checked, (int, float)) and 0 <= now - checked <= 360
        services.append({'id': key, 'name': name, 'checkedAt': checked,
                         'status': row.get('status', 'unknown') if recent else 'check_overdue',
                         'issue': row.get('issue'), 'recent': recent,
                         'restartCount': len([x for x in row.get('restarts', []) if now - x < 21600])})
    snapshot = state.get('snapshot', {})
    feeds = []
    for key, name in [('upcoming', '未来发射数据'), ('history', '历史发射数据')]:
        row = snapshot.get('feeds', {}).get(key, {})
        fetched = timestamp(row.get('fetchedAt'))
        age = max(0, now-fetched) if fetched else None
        feeds.append({'name': name, 'fetchedAt': fetched, 'ageSeconds': age,
                      'checkedAt': timestamp(row.get('checkedAt')),
                      'stale': age is None or age > 2700,
                      'retryAt': max(row.get('retryAt') or 0, snapshot.get('globalRetryAt') or 0)/1000 or None})
    last = min((s['checkedAt'] or 0) for s in services) or None
    monitoring = 'running' if all(s['recent'] for s in services) and timer.get('active') == 'active' else (
        'stopped' if timer.get('active') == 'inactive' else 'unknown' if timer.get('active') == 'unknown' else 'overdue')
    events = [{k: e.get(k) for k in ('at', 'service', 'status', 'action', 'reason', 'result', 'recovered')}
              for e in state.get('events', []) if isinstance(e, dict)]
    return {'generatedAt': now, 'available': bool(state), 'monitoring': monitoring,
            'timer': timer, 'lastCheck': last, 'feeds': feeds, 'services': services,
            'officialSources': snapshot.get('officialSources') or {},
            'revision': snapshot.get('revision'), 'events': list(reversed(events[-100:]))}
