"""Private, moderated observer reports. Never modifies mission or model evidence."""
import base64
import binascii
import io
import warnings
from PIL import Image, ImageOps, UnidentifiedImageError
import datetime as dt
from functools import lru_cache
from pathlib import Path
import hashlib
import hmac
import ipaddress
import json
import math
import re
import secrets
import time
import uuid
from photo_credit import credit_image
from urllib.request import urlopen

Image.MAX_IMAGE_PIXELS = 16000000
SALT = secrets.token_bytes(32)
STATUSES = ('pending', 'reviewed', 'invalid', 'published')

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

    c.execute('CREATE TABLE IF NOT EXISTS observation_images(report_id TEXT PRIMARY KEY, image BLOB NOT NULL)')
    columns={r[1] for r in c.execute('PRAGMA table_info(observations)')}
    for name,definition in [('public_credit', "TEXT NOT NULL DEFAULT ''"),('public_place', "TEXT NOT NULL DEFAULT ''"),('publish_consent', 'INTEGER NOT NULL DEFAULT 0'),('public_caption', "TEXT NOT NULL DEFAULT ''"),('time_text', "TEXT NOT NULL DEFAULT ''"),('candidates', "TEXT NOT NULL DEFAULT '[]'"),('match_note', "TEXT NOT NULL DEFAULT ''"),('match_inputs', "TEXT NOT NULL DEFAULT '{}'"),('match_method', "TEXT NOT NULL DEFAULT ''")]:
        if name not in columns:c.execute(f'ALTER TABLE observations ADD COLUMN {name} {definition}')


def clean(c, now):
    c.execute('DELETE FROM observations WHERE created < ?', (now - 365 * 86400,))
    c.execute('DELETE FROM observation_images WHERE report_id NOT IN (SELECT id FROM observations)')
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


def photo_bytes(value):
    if value is None or value == '': return None
    if not isinstance(value, str) or not value.startswith('data:image/jpeg;base64,') or len(value) > 1400000:
        raise ReportError('图片格式无效或过大，请重新选择一张照片。')
    try:
        raw = base64.b64decode(value.split(',', 1)[1], validate=True)
        if len(raw) > 1048576: raise ValueError()
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(raw)) as image:
                if image.format != 'JPEG' or image.width * image.height > 16000000: raise ValueError()
                image.load()
                clean_image = ImageOps.exif_transpose(image).convert('RGB')
                clean_image.info.clear()
                clean_image.thumbnail((1280,1280))
                output = io.BytesIO()
                clean_image.save(output, format='JPEG', quality=85)
                return output.getvalue()
    except (ValueError, OSError, binascii.Error, UnidentifiedImageError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise ReportError('图片无法读取，请重新选择一张照片。')


def image_for_report(connect, rid):
    with connect() as c:
        row=c.execute('SELECT image FROM observation_images WHERE report_id=?',(rid,)).fetchone()
    if not row: raise ReportError('图片不存在。',404)
    return row['image']


def submit(connect, data, ip, now=None, find_mission=mission):
    now = time.time() if now is None else now
    rid, p, digest = validate(data, now)
    image = photo_bytes(data.get('photo'))
    consent = data.get('publishConsent', False)
    if type(consent) is not bool: raise ReportError('请确认照片公开选项。')
    if consent and image is None: raise ReportError('公开照片需先选择一张图片。')
    p['publish_consent'] = int(consent)
    p['public_credit'] = text(data, 'publicCredit', 60) if consent else ''
    p['public_place'] = text(data, 'publicPlace', 100) if consent else ''
    if p['public_credit'] or p['public_place']:
        digest = hashlib.sha256((digest + json.dumps([p['public_credit'], p['public_place']], ensure_ascii=False)).encode()).hexdigest()
    if consent: digest = hashlib.sha256((digest + '|publish-photo-v1').encode()).hexdigest()
    if image is not None:
        digest = hashlib.sha256((digest + hashlib.sha256(image).hexdigest()).encode()).hexdigest()
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
        if image is not None: c.execute('INSERT INTO observation_images(report_id,image) VALUES (?,?)',(rid,image))
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
        rows=[dict(r) for r in c.execute(f'SELECT observations.*, EXISTS(SELECT 1 FROM observation_images WHERE report_id=observations.id) AS has_photo FROM observations WHERE {where} ORDER BY created DESC LIMIT 20 OFFSET ?',args+[(page-1)*20])]
    for r in rows:
        r.pop('fingerprint')
        r['candidates']=json.loads(r['candidates'])
        r['match_inputs']=json.loads(r['match_inputs'])
    total=sum(counts.values()) if status=='all' else counts.get(status,0)
    return dict(results=rows,counts=counts,page=page,pages=max(1,math.ceil(total/20)),total=total)


def review(connect, data):
    if not isinstance(data,dict) or data.get('status') not in STATUSES:
        raise ReportError('未知状态。')
    rid = text(data,'id',40,True)
    with connect() as c:
        c.execute('BEGIN IMMEDIATE')
        row=c.execute('SELECT publish_consent,created FROM observations WHERE id=?',(rid,)).fetchone()
        if not row: raise ReportError('报告不存在。',404)
        caption=''
        if data['status']=='published':
            if not row['publish_consent']: raise ReportError('提交者未授权公开照片，不能发布。')
            if row['created'] < time.time()-365*86400: raise ReportError('报告已超过保留期限。')
            if not c.execute('SELECT 1 FROM observation_images WHERE report_id=?',(rid,)).fetchone(): raise ReportError('报告没有照片。')
            caption=text(data,'publicCaption',500,True)
        c.execute('UPDATE observations SET status=?,public_caption=?,updated=? WHERE id=?',(data['status'],caption,time.time(),rid))
    return dict(ok=True)


def public_reports(connect, page=1, launch_id=None):
    page=max(1,int(page))
    constraint=" AND launch_id=? AND match_method='admin'" if launch_id else ''
    args=(time.time()-365*86400,)+((launch_id,) if launch_id else ())+((page-1)*20,)
    with connect() as c:
        rows=c.execute("SELECT id,public_caption,public_credit,public_place,launch_id,launch_name,launch_time,match_method FROM observations WHERE status='published' AND publish_consent=1 AND created>=? AND EXISTS(SELECT 1 FROM observation_images WHERE report_id=observations.id) "+constraint+" ORDER BY updated DESC,id LIMIT 21 OFFSET ?",args).fetchall()
    return dict(results=[dict(id=r['id'],caption=r['public_caption'],credit=r['public_credit'],publicPlace=r['public_place'],**(dict(launchId=r['launch_id'],launchName=r['launch_name'],launchTime=r['launch_time']) if r['match_method']=='admin' and r['launch_id'] else {})) for r in rows[:20]],page=page,hasMore=len(rows)>20)


def public_image(connect, rid):
    with connect() as c:
        row=c.execute("SELECT image,public_credit FROM observation_images JOIN observations ON id=report_id WHERE id=? AND status='published' AND publish_consent=1 AND created>=?",(rid,time.time()-365*86400)).fetchone()
    if not row: raise ReportError('图片不存在或已撤下。',404)
    # Authorization is checked on every request, including a cached derivative.
    return _credited_public_image(row['image'], row['public_credit'])


@lru_cache(maxsize=12)
def _credited_public_image(raw, credit):
    return credit_image(raw, credit, '星途用户报告')


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
    window=time_window(p,p.get('created',now))
    if not window:return [],'已保存原始时间和地点；时间暂不能自动识别，等待作者核对。'
    try:launches=list(_missions(int(now//60)).values())
    except Exception:return [],'报告已保存；发射数据暂不可用，等待作者核对。'
    result=[]
    p=dict(p);location_basis=''
    if p['latitude'] is None:
        cities=json.loads((Path(__file__).with_name('matching-cities.json')).read_text())
        found=[(name,point) for name,point in cities.items() if name in p.get('place','')]
        if len(found)==1:
            name,point=found[0];p.update(latitude=point[0],longitude=point[1],coordinate_system='WGS84');location_basis=f'（{name}市中心近似位置）'
    for launch in launches:
        try:t=dt.datetime.fromisoformat(launch['timing']['net'].replace('Z','+00:00')).timestamp()
        except (KeyError,ValueError,TypeError):continue
        # Search launch times from 90 minutes before an observation interval to 10 minutes after.
        if t>now or not window[0]-5400<=t<=window[1]+600:continue
        distance=None;pad=launch.get('pad') or {}
        if p['latitude'] is not None and p['coordinate_system']=='WGS84' and all(type(pad.get(k)) in (int,float) for k in ('latitude','longitude')):
            a,b,c,d=map(math.radians,(p['latitude'],p['longitude'],pad['latitude'],pad['longitude']))
            distance=round(6371*2*math.asin(math.sqrt(min(1,math.sin((a-c)/2)**2+math.cos(a)*math.cos(c)*math.sin((b-d)/2)**2))))
        result.append(dict(id=launch['id'],name=launch.get('nameZh') or launch.get('name','发射任务'),time=launch['timing']['net'],distanceKm=distance,basis='时间接近；观测点距发射场约 '+str(distance)+' km'+location_basis if distance is not None else '时间接近；地点待核对'))
    # Site proximity ranks candidates, not proof of visibility or actual track.
    result.sort(key=lambda x:(x['distanceKm'] is None,x['distanceKm'] or 0,abs(dt.datetime.fromisoformat(x['time'].replace('Z','+00:00')).timestamp()-sum(window)/2)))
    return result,'按时间初筛，有 WGS84 坐标或明确城市名时参考与发射场的距离排序；城市使用中心近似位置，未识别或有歧义地点需人工核对。候选不代表已经确认，也不代表当时一定可见。' if result else '当前一年数据中未找到时间接近的发射，报告已保存，等待作者核对。'

def receipt(connect,rid):
    with connect() as c:r=c.execute('SELECT candidates,match_note FROM observations WHERE id=?',(rid,)).fetchone()
    return dict(id=rid,status='received',candidates=json.loads(r['candidates']),matchNote=r['match_note'])

def report_summary(connect):
    # Only aggregate task associations leave the private backend. No report ids, times or locations.
    counts={}
    with connect() as c:
        for r in c.execute("SELECT launch_id,candidates,match_method FROM observations WHERE status!='invalid'"):
            ids={x['id'] for x in json.loads(r['candidates'])} if not r['match_method'] else set()
            if r['launch_id']:ids.add(r['launch_id'])
            for key in ids:counts[key]=counts.get(key,0)+1
    return dict(counts=counts)


def search_missions(query):
    q=query.get('q','').strip().casefold()
    if len(q)>160:raise ReportError('搜索内容过长。')
    try: launches=list(_missions(int(time.time()//60)).values())
    except Exception:raise ReportError('任务列表暂不可用，请稍后重试。',503)
    results=[]
    for item in launches:
        name=item.get('nameZh') or item.get('name','发射任务');stamp=item.get('timing',{}).get('net','')
        try:
            date=dt.datetime.fromisoformat(stamp.replace('Z','+00:00'))
            if date.timestamp()>time.time():continue
        except (ValueError,TypeError):continue
        if q and q not in f"{name} {item.get('name','')} {item['id']} {date.astimezone(TZ).strftime('%Y-%m-%d')}".casefold():continue
        results.append(dict(id=item['id'],name=name,time=stamp))
    results.sort(key=lambda x:x['time'],reverse=True)
    return dict(results=results[:100],total=len(results))


def match_report(connect,data):
    if not isinstance(data,dict):raise ReportError('请求格式无效。')
    rid=text(data,'id',40,True);action=data.get('action')
    if action not in ('recommend','assign','clear'):raise ReportError('未知匹配操作。')
    with connect() as c:
        row=c.execute('SELECT * FROM observations WHERE id=?',(rid,)).fetchone()
    if not row:raise ReportError('报告不存在。',404)
    row=dict(row)
    if action=='recommend':
        values=data.get('inputs',{})
        if not isinstance(values,dict):raise ReportError('匹配条件无效。')
        report=dict(row)
        report['time_text']=text(values,'timeText',160) or row['time_text']
        if values.get('timeText'):report['observed_at']=''
        report['place']=text(values,'place',160) or row['place']
        lat,lon=values.get('latitude'),values.get('longitude')
        if lat is not None or lon is not None:
            if any(type(v) not in (int,float) or not math.isfinite(v) for v in (lat,lon)) or abs(lat)>90 or abs(lon)>180:raise ReportError('请填写完整有效的 WGS84 经纬度。')
            report.update(latitude=lat,longitude=lon,coordinate_system='WGS84')
        # Fail visibly rather than replacing existing candidates on source outages.
        try:_missions(int(time.time()//60))
        except Exception:raise ReportError('任务列表暂不可用，原匹配保留。',503)
        candidates,note=match_candidates(report,time.time())
        inputs={k:report[k] for k in ('time_text','place','latitude','longitude','coordinate_system')}
        with connect() as c:c.execute('UPDATE observations SET candidates=?,match_note=?,match_inputs=?,updated=? WHERE id=?',(json.dumps(candidates,ensure_ascii=False),note,json.dumps(inputs,ensure_ascii=False),time.time(),rid))
        return dict(ok=True,candidates=candidates,note=note)
    launch_id=text(data,'launchId',80,action=='assign') if action=='assign' else ''
    launch=mission(launch_id) if launch_id else {}
    stamp=launch.get('timing',{}).get('net','')
    if launch_id:
        try:
            if dt.datetime.fromisoformat(stamp.replace('Z','+00:00')).timestamp()>time.time():raise ValueError()
        except (ValueError,TypeError):raise ReportError('不能关联尚未发射的任务。')
    if data.get('publish'):
        if action!='assign' or not row['publish_consent']:raise ReportError('此报告未授权公开照片，不能前台展示。')
        text(data,'publicCaption',500,True)
        with connect() as c:
            if not c.execute('SELECT 1 FROM observation_images WHERE report_id=?',(rid,)).fetchone():raise ReportError('报告没有授权照片。')
        if row['created']<time.time()-365*86400:raise ReportError('报告已超过保留期限。')
    with connect() as c:
        c.execute('UPDATE observations SET launch_id=?,launch_name=?,launch_time=?,match_method=?,updated=? WHERE id=?',(launch_id,(launch.get('nameZh') or launch.get('name','发射任务'))[:240] if launch_id else '待匹配任务',stamp,'admin' if launch_id else 'cleared',time.time(),rid))
        if data.get('publish'):c.execute("UPDATE observations SET status='published',public_caption=? WHERE id=?",(text(data,'publicCaption',500,True),rid))
    return dict(ok=True)
