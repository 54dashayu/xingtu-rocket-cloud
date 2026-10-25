#!/usr/bin/env python3
"""Private first-party analytics. Bind loopback; Nginx owns Basic authentication."""
from contextlib import contextmanager
import argparse
import datetime as dt
import gzip
import hashlib
import ipaddress
import json
import math
import os
from pathlib import Path
import re
import sqlite3
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit, parse_qs

TZ = dt.timezone(dt.timedelta(hours=8))
ROOT = Path(__file__).resolve().parent
DB = os.getenv('ANALYTICS_DB', '/var/lib/xingtu-analytics/visits.sqlite3')
ORIGIN = os.getenv('ANALYTICS_ORIGIN', 'https://space.bh1jss.net')
RETENTION_DAYS = 90
SITES = {'launch': '全球发射日历', 'rocket-cloud': '火箭云预测'}
PAGES = {'/launch/': 'launch', '/launch/index.html': 'launch',
         '/rocket-cloud/': 'rocket-cloud', '/rocket-cloud/index.html': 'rocket-cloud',
         '/rocket-cloud/map.html': 'rocket-cloud', '/launch/map.html': 'rocket-cloud'}
BOT = re.compile(r'bot|spider|crawler|headless|curl|wget|python|httpclient|monitor|uptime|preview|facebookexternalhit', re.I)
ID = re.compile(r'^[A-Za-z0-9_-]{16,80}$')
LOG = re.compile(r'^(\S+) .*?\[([^\]]+)\] "GET ([^ ]+) HTTP/[^\"]+" (\d+) \S+ "([^\"]*)" "([^\"]*)"')


@contextmanager
def connect():
    c = sqlite3.connect(DB, timeout=15)
    c.row_factory = sqlite3.Row
    try:
        with c:
            yield c
    finally:
        c.close()


def init():
    Path(DB).parent.mkdir(parents=True, exist_ok=True)
    with connect() as c:
        c.executescript('''
        PRAGMA journal_mode=WAL;
        CREATE TABLE IF NOT EXISTS visits(
          page_id TEXT PRIMARY KEY, session_id TEXT NOT NULL, site TEXT NOT NULL,
          ip TEXT NOT NULL, started REAL NOT NULL, updated REAL NOT NULL,
          active_ms INTEGER NOT NULL DEFAULT 0, referrer TEXT NOT NULL, device TEXT NOT NULL,
          browser TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS visits_started ON visits(started);
        CREATE INDEX IF NOT EXISTS visits_ip ON visits(ip,started);
        CREATE TABLE IF NOT EXISTS historical(
          id TEXT PRIMARY KEY, site TEXT NOT NULL, ip TEXT NOT NULL, started REAL NOT NULL,
          referrer TEXT NOT NULL, device TEXT NOT NULL, browser TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS historical_started ON historical(started);
        CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY, value TEXT NOT NULL);
        ''')
        c.execute('INSERT OR IGNORE INTO metadata VALUES (?,?)', ('started', str(time.time())))
    cleanup()


def cleanup():
    with connect() as c:
        cutoff = time.time() - RETENTION_DAYS * 86400
        c.execute('DELETE FROM visits WHERE started < ?', (cutoff,))
        c.execute('DELETE FROM historical WHERE started < ?', (cutoff,))


def source(value):
    try:
        p = urlsplit(str(value)[:1000])
        return (p.hostname or '')[:160] if p.scheme in ('http', 'https') else ''
    except ValueError:
        return ''


def agent(ua):
    device = '平板' if re.search(r'iPad|Tablet', ua, re.I) else ('手机' if re.search(r'iPhone|Android|Mobile', ua, re.I) else '电脑')
    browser = next((label for token, label in [('MicroMessenger', '微信'), ('Edg', 'Edge'), ('Firefox', 'Firefox'), ('CriOS', 'Chrome'), ('Chrome', 'Chrome'), ('Safari', 'Safari')] if token in ua), '其他')
    return device, browser


def ingest(data, ip, ua, now=None):
    now = time.time() if now is None else now
    if BOT.search(ua):
        return False
    if not isinstance(data, dict):
        raise ValueError('invalid event')
    ip = str(ipaddress.ip_address(ip))
    page, session, site = (data.get(k, '') for k in ('page', 'session', 'site'))
    if not isinstance(page, str) or not ID.fullmatch(page) or not isinstance(session, str) or not ID.fullmatch(session) or site not in SITES:
        raise ValueError('invalid identifiers')
    if PAGES.get(data.get('path')) != site:
        raise ValueError('invalid page')
    elapsed, active = data.get('elapsed_ms', 0), data.get('active_ms', 0)
    if any(type(v) not in (int, float) or not math.isfinite(v) or v < 0 for v in (elapsed, active)):
        raise ValueError('invalid duration')
    elapsed = min(elapsed, 86400000)
    active = int(min(active, elapsed, 21600000))
    device, browser = agent(ua)
    with connect() as c:
        old = c.execute('SELECT * FROM visits WHERE page_id=?', (page,)).fetchone()
        if old:
            if (old['site'], old['session_id']) != (site, session):
                raise ValueError('page identity changed')
            # Max makes retries and out-of-order beacons idempotent. Server wall time bounds claims.
            active = max(old['active_ms'], min(active, int(max(0, now - old['started']) * 1000 + 2000)))
            c.execute('UPDATE visits SET updated=MAX(updated,?),active_ms=? WHERE page_id=?', (now, active, page))
        else:
            c.execute('INSERT INTO visits VALUES (?,?,?,?,?,?,?,?,?,?)',
                      (page, session, site, ip, now - elapsed / 1000, now, active, source(data.get('referrer', '')), device, browser))
    return True


def dates(query):
    today = dt.datetime.now(TZ).date()
    end = dt.date.fromisoformat(query.get('end', str(today)))
    start = dt.date.fromisoformat(query.get('start', str(today - dt.timedelta(days=6))))
    if end < start or (end - start).days > 90:
        raise ValueError('日期范围应在 91 天以内')
    return start, end, dt.datetime.combine(start, dt.time(), TZ).timestamp(), dt.datetime.combine(end + dt.timedelta(days=1), dt.time(), TZ).timestamp()


def stats(query):
    start, end, lo, hi = dates(query)
    site, ip = query.get('site', ''), query.get('ip', '').strip()
    if site and site not in SITES:
        raise ValueError('未知产品')
    if ip:
        ip = str(ipaddress.ip_address(ip))
    page = max(1, min(100000, int(query.get('page', 1))))
    kind = query.get('kind', 'live')
    table = 'historical' if kind == 'history' else 'visits'
    where, args = 'started>=? AND started<?', [lo, hi]
    if site:
        where += ' AND site=?'
        args.append(site)
    if ip:
        where += ' AND ip=?'
        args.append(ip)
    live = table == 'visits'
    extra = ',COUNT(DISTINCT session_id) sessions,ROUND(AVG(active_ms)/1000) avg_seconds,SUM(active_ms)/1000 total_seconds' if live else ',NULL sessions,NULL avg_seconds,NULL total_seconds'
    with connect() as c:
        total = dict(c.execute(f'SELECT COUNT(*) pv,COUNT(DISTINCT ip) ips {extra} FROM {table} WHERE {where}', args).fetchone())
        by_site = [dict(r) for r in c.execute(f'SELECT site,COUNT(*) pv,COUNT(DISTINCT ip) ips {extra} FROM {table} WHERE {where} GROUP BY site', args)]
        daily = [dict(r) for r in c.execute(f"SELECT date(started,'unixepoch','+8 hours') day,site,COUNT(*) pv FROM {table} WHERE {where} GROUP BY day,site ORDER BY day", args)]
        top_ips = [dict(r) for r in c.execute(f'SELECT ip,COUNT(*) pv,MAX(started) latest {extra} FROM {table} WHERE {where} GROUP BY ip ORDER BY pv DESC LIMIT 15', args)]
        cols = 'site,ip,started,referrer,device,browser' + (',active_ms,updated' if live else ',NULL active_ms,NULL updated')
        recent = [dict(r) for r in c.execute(f'SELECT {cols} FROM {table} WHERE {where} ORDER BY started DESC LIMIT 30 OFFSET ?', args + [(page - 1) * 30])]
        meta = dict(c.execute('SELECT key,value FROM metadata'))
        retained_live = c.execute('SELECT COUNT(*) FROM visits').fetchone()[0]
        historical_total = c.execute('SELECT COUNT(*) FROM historical').fetchone()[0]
    return dict(total=total, products=by_site, daily=daily, ips=top_ips, recent=recent,
                page=page, pages=max(1, math.ceil(total['pv'] / 30)), start=str(start), end=str(end),
                kind=kind, metadata=meta, retained_live=retained_live, historical_total=historical_total,
                generated=time.time(), retention_days=RETENTION_DAYS)


def import_logs(paths, before):
    cutoff = time.time() - 30 * 86400
    rows = {}
    for path in paths:
        opener = gzip.open if str(path).endswith('.gz') else open
        with opener(path, 'rt', errors='replace') as f:
            for line in f:
                m = LOG.match(line)
                if not m:
                    continue
                ip, stamp, target, status, ref, ua = m.groups()
                site = PAGES.get(urlsplit(target).path)
                if not site or status not in ('200', '304') or BOT.search(ua):
                    continue
                try:
                    ts = dt.datetime.strptime(stamp, '%d/%b/%Y:%H:%M:%S %z').timestamp()
                    ip = str(ipaddress.ip_address(ip))
                except ValueError:
                    continue
                if not cutoff <= ts < before:
                    continue
                # Identical log lines across rotated/copy logs are imported once.
                key = hashlib.sha256(line.rstrip().encode()).hexdigest()
                rows[key] = (key, site, ip, ts, source(ref), *agent(ua))
    with connect() as c:
        old = c.total_changes
        c.executemany('INSERT OR IGNORE INTO historical VALUES (?,?,?,?,?,?,?)', rows.values())
        count = c.total_changes - old
        c.execute('INSERT OR REPLACE INTO metadata VALUES (?,?)', ('history_cutoff', str(before)))
        c.execute('INSERT OR REPLACE INTO metadata VALUES (?,?)', ('history_imported', str(time.time())))
    return count


class Handler(BaseHTTPRequestHandler):
    server_version = 'XingtuAnalytics'
    def setup(self):
        super().setup()
        self.connection.settimeout(10)

    def log_message(self, *args):
        pass  # Never put IPs, credentials or request bodies into journal.

    def respond(self, code, body=b'', mime='application/json; charset=utf-8'):
        self.send_response(code)
        self.send_header('Content-Type', mime)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'SAMEORIGIN')
        self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; frame-ancestors 'self'")
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if self.path != '/event':
            return self.respond(404)
        if self.headers.get('Origin') != ORIGIN:
            return self.respond(403)
        try:
            size = int(self.headers.get('Content-Length', 0))
            if not 0 < size <= 2048:
                return self.respond(413)
            data = json.loads(self.rfile.read(size))
            ingest(data, self.headers.get('X-Real-IP', ''), self.headers.get('User-Agent', '')[:512])
            self.respond(204)
        except (ValueError, TypeError, OverflowError):
            self.respond(400)

    def do_GET(self):
        path = urlsplit(self.path).path
        if path == '/health':
            return self.respond(200, b'{"ok":true}')
        # A trusted, authenticated Nginx location supplies this flag; public routes explicitly clear it.
        if path not in ('/tracker.js', '/privacy') and self.headers.get('X-Xingtu-Admin') != '1':
            return self.respond(403)
        if path == '/api/stats':
            try:
                q = {k: v[-1] for k, v in parse_qs(urlsplit(self.path).query).items()}
                return self.respond(200, json.dumps(stats(q), ensure_ascii=False).encode())
            except (ValueError, TypeError):
                return self.respond(400, b'{"error":"invalid filter"}')
        files = {'/privacy': ('privacy.html', 'text/html'), '/': ('index.html', 'text/html'), '/dashboard.js': ('dashboard.js', 'text/javascript'),
                 '/style.css': ('style.css', 'text/css'), '/tracker.js': ('tracker.js', 'text/javascript')}
        if path not in files:
            return self.respond(404)
        filename, mime = files[path]
        self.respond(200, (ROOT / 'static' / filename).read_bytes(), mime + '; charset=utf-8')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--import-logs', nargs='+')
    parser.add_argument('--before', type=float)
    args = parser.parse_args()
    init()
    if args.import_logs:
        if not args.before:
            parser.error('--before required')
        print(json.dumps({'imported': import_logs(args.import_logs, args.before)}))
        return
    # Retention also runs without traffic.
    import threading
    def housekeeper():
        while True:
            time.sleep(3600)
            cleanup()
    threading.Thread(target=housekeeper, daemon=True).start()
    ThreadingHTTPServer(('127.0.0.1', int(os.getenv('PORT', 8792))), Handler).serve_forever()


if __name__ == '__main__':
    main()
