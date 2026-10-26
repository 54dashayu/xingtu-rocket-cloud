"""Private, moderated observer reports. Never modifies mission or model evidence."""
import datetime as dt
from functools import lru_cache
import hashlib
import hmac
import ipaddress
import json
import math
import re
import secrets
import time
import uuid
from urllib.request import urlopen

SALT = secrets.token_bytes(32)
STATUSES = ('pending', 'reviewed', 'invalid')

class ReportError(ValueError):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


def init(c):
    c.executescript('''
    CREATE TABLE IF NOT EXISTS observations(
      id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, created REAL NOT NULL,
      launch_id TEXT NOT NULL, launch_name TEXT NOT NULL, launch_time TEXT NOT NULL,
      observed_at TEXT NOT NULL, approximate INTEGER NOT NULL, outcome TEXT NOT NULL,
      place TEXT NOT NULL, latitude REAL, longitude REAL, coordinate_system TEXT NOT NULL,
      nickname TEXT NOT NULL, notes TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending', updated REAL NOT NULL);
    CREATE INDEX IF NOT EXISTS observations_created ON observations(created);
    CREATE TABLE IF NOT EXISTS observation_limits(key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires REAL NOT NULL);
    ''')

    columns={r[1] for r in c.execute('PRAGMA table_info(observations)')}
    for name,definition in [('time_text', "TEXT NOT NULL DEFAULT ''"),('candidates', "TEXT NOT NULL DEFAULT '[]'"),('match_note', "TEXT NOT NULL DEFAULT ''")]:
        if name not in columns:c.execute(f'ALTER TABLE observations ADD COLUMN {name} {definition}')


def clean(c, now):
    c.execute('DELETE FROM observations WHERE created < ?', (now - 365 * 86400,))
    c.execute('DELETE FROM observation_limits WHERE expires < ?', (now,))


@lru_cache(maxsize=2)
def _missions(bucket):
    # Fixed local source; no user-controlled URL or third-party IP lookup.
    with urlopen('http://127.0.0.1:4179/api/launches/previous?days=365', timeout=10) as r:
        data = json.load(r)
    return {item['id']: item for item in data['results']}


def mission(launch_id):
    try:
        found = _missions(int(time.time() // 60)).get(launch_id)
    except Exception:
        raise ReportError('任务列表暂不可用，请稍后再提交。', 503)
    if not found:
        raise ReportError('请刷新页面，选择回溯一年内的发射任务。')
    return found


def text(data, key, maximum, required=False):
    value = data.get(key, '')
    if not isinstance(value, str) or len(value) > maximum or any(ord(x) < 32 and x not in '\n\t' for x in value):
        raise ReportError('填写内容过长或格式不正确。')
    value = value.strip()
    if required and not value:
        raise ReportError('请补全观测时间、结果和地点。')
    return value


def validate(data, now):
    if not isinstance(data, dict) or data.get('consent') is not True:
        raise ReportError('请确认同意将报告交给作者核对。')
    try:
        rid = str(uuid.UUID(data.get('id', '')))
    except (ValueError, TypeError, AttributeError):
        raise ReportError('报告编号无效，请重新打开填写窗口。')
    launch_id = text(data, 'launchId', 80)
    outcome = data.get('outcome', 'uncertain')
    if outcome not in ('seen', 'not_seen', 'uncertain'):
        raise ReportError('请选择是否看到火箭云。')
    time_text = text(data, 'timeText', 160)
    stamp = text(data, 'observedAt', 40)
    if not stamp and not time_text:raise ReportError('请填写大致观测时间。')
    try:
        date = dt.datetime.fromisoformat(stamp.replace('Z', '+00:00')) if stamp else None
        if date and (date.tzinfo is None or date.timestamp() > now + 300):
            raise ValueError()
    except (ValueError, OverflowError):
        raise ReportError('观测时间格式不正确，或晚于当前时间。')
    lat, lon = data.get('latitude'), data.get('longitude')
    if lat is not None or lon is not None:
        if any(type(v) not in (int, float) or not math.isfinite(v) for v in (lat, lon)) or abs(lat) > 90 or abs(lon) > 180:
            raise ReportError('请同时填写有效的纬度（−90～90）和经度（−180～180）。')
    place = text(data, 'place', 160)
    if not place and lat is None:
        raise ReportError('请填写大致地点，或填写一组经纬度。')
    system = data.get('coordinateSystem', 'unknown')
    if system not in ('WGS84', 'GCJ02', 'BD09', 'unknown'):
        raise ReportError('请选择坐标来源。')
    if type(data.get('approximate', True)) is not bool:
        raise ReportError('请确认观测时间是否为大约时间。')
    payload = dict(launch_id=launch_id, observed_at=date.astimezone(dt.timezone.utc).isoformat() if date else '', time_text=time_text,
        approximate=int(data.get('approximate', True)), outcome=outcome, place=place, latitude=lat, longitude=lon,
        coordinate_system=system if lat is not None else 'unknown', nickname=text(data, 'nickname', 40), notes=text(data, 'notes', 1500))
    digest = hashlib.sha256(json.dumps(payload, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    return rid, payload, digest


def submit(connect, data, ip, now=None, find_mission=mission):
    now = time.time() if now is None else now
    rid, p, digest = validate(data, now)
    try:
        address = str(ipaddress.ip_address(ip))
    except ValueError:
        raise ReportError('无法确认请求来源，请稍后重试。')
    with connect() as c:
        existing = c.execute('SELECT fingerprint FROM observations WHERE id=?', (rid,)).fetchone()
        if existing:
            if existing['fingerprint'] != digest:
                raise ReportError('此报告已提交，请勿修改后重复发送。', 409)
            return receipt(connect,rid)
    launch={};launch_time=''
    if p['launch_id']:
        launch=find_mission(p['launch_id']);launch_time=launch.get('timing',{}).get('net','')
        try:
            launch_ts=dt.datetime.fromisoformat(launch_time.replace('Z','+00:00')).timestamp()
            if launch_ts>now or (p['observed_at'] and abs(dt.datetime.fromisoformat(p['observed_at']).timestamp()-launch_ts)>86400):raise ValueError()
        except (ValueError,TypeError,AttributeError):raise ReportError('请核对任务与观测时间。')
    candidates,note=match_candidates(p,now)
    if p['launch_id'] and not any(x['id']==p['launch_id'] for x in candidates):
        candidates.insert(0,dict(id=p['launch_id'],name=launch.get('name','发射任务'),time=launch_time,basis='用户指定任务，待核对',distanceKm=None))
    p['candidates']=json.dumps(candidates,ensure_ascii=False);p['match_note']=note
    keys = [(hmac.new(SALT, f'{address}|{window}|{int(now//window)}'.encode(), hashlib.sha256).hexdigest(), limit, (int(now//window)+1)*window) for window,limit in ((3600,5),(86400,20))]
    with connect() as c:
        c.execute('BEGIN IMMEDIATE')
        existing=c.execute('SELECT fingerprint FROM observations WHERE id=?',(rid,)).fetchone()
        if existing:
            if existing['fingerprint'] != digest:
                raise ReportError('报告已提交。',409)
            return receipt(connect,rid)
        for key,limit,expiry in keys:
            row=c.execute('SELECT count FROM observation_limits WHERE key=?',(key,)).fetchone()
            if row and row['count']>=limit:
                raise ReportError('提交较频繁，请稍后再试（每小时最多 5 条）。',429)
        cols=['id','fingerprint','created','launch_name','launch_time',*p.keys(),'updated']
        c.execute(f'INSERT INTO observations ({",".join(cols)}) VALUES ({",".join("?" for _ in cols)})',
                  [rid,digest,now,str(launch.get('nameZh') or launch.get('name') or '待匹配任务')[:240],launch_time,*p.values(),now])
        for key,_,expiry in keys:
            c.execute('INSERT INTO observation_limits VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1',(key,expiry))
    return receipt(connect,rid)


def listing(connect, query):
    status=query.get('status','pending')
    if status not in (*STATUSES,'all'):
        raise ReportError('未知状态。')
    page=max(1,int(query.get('page',1)))
    where,args=('1=1',[]) if status=='all' else ('status=?',[status])
    with connect() as c:
        counts={r['status']:r['n'] for r in c.execute('SELECT status,count(*) n FROM observations GROUP BY status')}
        rows=[dict(r) for r in c.execute(f'SELECT * FROM observations WHERE {where} ORDER BY created DESC LIMIT 20 OFFSET ?',args+[(page-1)*20])]
    for r in rows:
        r.pop('fingerprint')
        r['candidates']=json.loads(r['candidates'])
    total=sum(counts.values()) if status=='all' else counts.get(status,0)
    return dict(results=rows,counts=counts,page=page,pages=max(1,math.ceil(total/20)),total=total)


def review(connect, data):
    if not isinstance(data,dict) or data.get('status') not in STATUSES:
        raise ReportError('未知状态。')
    with connect() as c:
        changed=c.execute('UPDATE observations SET status=?,updated=? WHERE id=?',(data['status'],time.time(),text(data,'id',40,True))).rowcount
        if not changed:
            raise ReportError('报告不存在。',404)
    return dict(ok=True)


TZ=dt.timezone(dt.timedelta(hours=8))
def time_window(p,now):
    """Conservative Beijing-time parsing; unresolved text stays unresolved."""
    if p['observed_at']:
        t=dt.datetime.fromisoformat(p['observed_at']).timestamp();return t-1800,t+1800
    v=p['time_text'].strip();today=dt.datetime.fromtimestamp(now,TZ).date()
    m=re.search(r'(?:(\d{4})[年/-])?(\d{1,2})[月/-](\d{1,2})(?:日|号)?',v)
    try:
        if m:
            day=dt.date(int(m[1] or today.year),int(m[2]),int(m[3]));rest=v[m.end():]
            if not m[1] and day>today:day=day.replace(year=day.year-1)
        elif any(x in v for x in ('今天','昨天','前天')):
            day=today-dt.timedelta(days=2 if '前天' in v else 1 if '昨天' in v else 0);rest=v
        else:return None
        h=re.search(r'(\d{1,2})(?:[:：点时])(\d{1,2})?',rest)
        if h:
            hour=int(h[1]);minute=int(h[2] or 0)
            if any(w in rest for w in ('下午','晚上','傍晚')) and hour<12:hour+=12
            t=dt.datetime.combine(day,dt.time(hour,minute),TZ).timestamp();return t-1800,t+1800
        spans=[(('凌晨',),(0,6)),(('清晨','早晨','黎明'),(4,9)),(('上午',),(6,12)),(('中午',),(11,14)),(('下午',),(12,18)),(('傍晚','日落'),(16,21)),(('晚上','夜里'),(18,24))]
        a,b=next((bounds for words,bounds in spans if any(w in rest for w in words)),(0,24))
        base=dt.datetime.combine(day,dt.time(),TZ).timestamp();return base+a*3600,base+b*3600
    except ValueError:return None

def match_candidates(p,now):
    window=time_window(p,now)
    if not window:return [],'已保存原始时间和地点；时间暂不能自动识别，等待作者核对。'
    try:launches=list(_missions(int(now//60)).values())
    except Exception:return [],'报告已保存；发射数据暂不可用，等待作者核对。'
    result=[]
    for launch in launches:
        try:t=dt.datetime.fromisoformat(launch['timing']['net'].replace('Z','+00:00')).timestamp()
        except (KeyError,ValueError,TypeError):continue
        # Search launch times from 90 minutes before an observation interval to 10 minutes after.
        if t>now or not window[0]-5400<=t<=window[1]+600:continue
        distance=None;pad=launch.get('pad') or {}
        if p['latitude'] is not None and p['coordinate_system']=='WGS84' and all(type(pad.get(k)) in (int,float) for k in ('latitude','longitude')):
            a,b,c,d=map(math.radians,(p['latitude'],p['longitude'],pad['latitude'],pad['longitude']))
            distance=round(6371*2*math.asin(math.sqrt(min(1,math.sin((a-c)/2)**2+math.cos(a)*math.cos(c)*math.sin((b-d)/2)**2))))
        result.append(dict(id=launch['id'],name=launch.get('nameZh') or launch.get('name','发射任务'),time=launch['timing']['net'],distanceKm=distance,basis='时间接近；观测点距发射场约 '+str(distance)+' km' if distance is not None else '时间接近；地点待核对'))
    # Site proximity ranks candidates, not proof of visibility or actual track.
    result.sort(key=lambda x:(x['distanceKm'] is None,x['distanceKm'] or 0,abs(dt.datetime.fromisoformat(x['time'].replace('Z','+00:00')).timestamp()-sum(window)/2)))
    return result,'按时间初筛，有 GPS 坐标时参考与发射场的距离排序；文字地点暂由作者核对。候选不代表已经确认，也不代表当时一定可见。' if result else '当前一年数据中未找到时间接近的发射，报告已保存，等待作者核对。'

def receipt(connect,rid):
    with connect() as c:r=c.execute('SELECT candidates,match_note FROM observations WHERE id=?',(rid,)).fetchone()
    return dict(id=rid,status='received',candidates=json.loads(r['candidates']),matchNote=r['match_note'])

def report_summary(connect):
    # Only aggregate task associations leave the private backend. No report ids, times or locations.
    counts={}
    with connect() as c:
        for r in c.execute("SELECT launch_id,candidates FROM observations WHERE status!='invalid'"):
            ids={x['id'] for x in json.loads(r['candidates'])}
            if r['launch_id']:ids.add(r['launch_id'])
            for key in ids:counts[key]=counts.get(key,0)+1
    return dict(counts=counts)
