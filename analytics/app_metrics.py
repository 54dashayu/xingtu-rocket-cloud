"""Anonymous foreground sessions and download-entry requests; no device identifiers."""
import datetime as dt
import math
import re
import time

ID=re.compile(r'^[a-zA-Z0-9_-]{16,80}$')
VERSION=re.compile(r'^\d{1,3}\.\d{1,3}(?:\.\d{1,3})?$')
TZ=dt.timezone(dt.timedelta(hours=8))

def init(c):
    c.executescript('''CREATE TABLE IF NOT EXISTS app_usage(
      page TEXT PRIMARY KEY,session TEXT NOT NULL,platform TEXT NOT NULL,version TEXT NOT NULL,
      build INTEGER NOT NULL,started REAL NOT NULL,updated REAL NOT NULL,active_ms INTEGER NOT NULL,
      foreground INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS app_usage_started ON app_usage(started);
      CREATE TABLE IF NOT EXISTS app_downloads(day TEXT NOT NULL,version TEXT NOT NULL,requests INTEGER NOT NULL,PRIMARY KEY(day,version));''')

def clean(c, now):
    c.execute('DELETE FROM app_usage WHERE started<?',(now-90*86400,))
    c.execute('DELETE FROM app_downloads WHERE day<?',(dt.datetime.fromtimestamp(now-90*86400,TZ).date().isoformat(),))

def ingest(connect,d,now=None):
    now=time.time() if now is None else now
    if not isinstance(d,dict):raise ValueError('invalid event')
    if any(not isinstance(d.get(k),str) or not ID.fullmatch(d[k]) for k in ('page','session')):raise ValueError('invalid id')
    if d.get('platform') not in ('android','ios') or not isinstance(d.get('version'),str) or not VERSION.fullmatch(d['version']):raise ValueError('invalid app')
    if type(d.get('build')) is not int or not 1<=d['build']<=99999999 or type(d.get('foreground')) is not bool:raise ValueError('invalid build')
    a=d.get('active_ms');e=d.get('elapsed_ms')
    if any(type(v) not in (int,float) or not math.isfinite(v) or v<0 for v in (a,e)):raise ValueError('invalid time')
    with connect() as c:
        old=c.execute('SELECT * FROM app_usage WHERE page=?',(d['page'],)).fetchone()
        identity=(d['session'],d['platform'],d['version'],d['build'])
        if old:
            if tuple(old[k] for k in ('session','platform','version','build'))!=identity:raise ValueError('changed identity')
            active=max(old['active_ms'],int(min(a,e,21600000,max(0,now-old['started'])*1000+2000)))
            c.execute('UPDATE app_usage SET updated=?,active_ms=?,foreground=? WHERE page=?',(now,active,int(d['foreground']),d['page']))
        else:
            # First message establishes server time; never trust an arbitrary historical start.
            c.execute('INSERT INTO app_usage VALUES (?,?,?,?,?,?,?,?,?)',(d['page'],*identity,now,now,0,int(d['foreground'])))

def download(connect,version,now=None):
    now=time.time() if now is None else now
    day=dt.datetime.fromtimestamp(now,TZ).date().isoformat()
    with connect() as c:c.execute('INSERT INTO app_downloads VALUES (?,?,1) ON CONFLICT(day,version) DO UPDATE SET requests=requests+1',(day,version))

def stats(connect,lo,hi):
    now=time.time()
    with connect() as c:
        rows=[dict(r) for r in c.execute('SELECT platform,version,build,COUNT(DISTINCT session) sessions,COUNT(*) pages,SUM(active_ms)/1000.0 seconds,MAX(updated) latest FROM app_usage WHERE started>=? AND started<? GROUP BY platform,version,build ORDER BY latest DESC',(lo,hi))]
        online=c.execute('SELECT COUNT(DISTINCT session) FROM app_usage WHERE updated>? AND foreground=1',(now-90,)).fetchone()[0]
        days=[dict(r) for r in c.execute("SELECT date(started,'unixepoch','+8 hours') day,platform,COUNT(DISTINCT session) sessions,SUM(active_ms)/1000.0 seconds FROM app_usage WHERE started>=? AND started<? GROUP BY day,platform ORDER BY day DESC",(lo,hi))]
        downloads=[dict(r) for r in c.execute('SELECT * FROM app_downloads WHERE day>=? AND day<? ORDER BY day DESC',(dt.datetime.fromtimestamp(lo,TZ).date().isoformat(),dt.datetime.fromtimestamp(hi,TZ).date().isoformat()))]
    return dict(apps=rows,daily=days,online=online,downloads=downloads)
