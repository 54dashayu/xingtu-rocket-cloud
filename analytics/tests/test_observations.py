import json
from pathlib import Path
import sys
import tempfile
import threading
import time
import unittest
import uuid
from unittest.mock import patch
from urllib.request import Request,urlopen
from urllib.error import HTTPError
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import server as s
import observations as o

class ObservationTest(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.db=patch.object(s,'DB',str(Path(self.tmp.name)/'test.db'));self.db.start();s.init()
        self.now=time.time();self.stamp=o.dt.datetime.fromtimestamp(self.now-120,o.dt.timezone.utc).isoformat()
        self.data=dict(id=str(uuid.uuid4()),launchId='launch-test',observedAt=self.stamp,outcome='seen',approximate=True,place='测试观测地点',latitude=None,longitude=None,coordinateSystem='unknown',nickname='<img src=x>',notes='<script>test</script>',consent=True)
        self.launch=dict(id='launch-test',name='测试任务',timing={'net':self.stamp},pad={'latitude':30,'longitude':120})
        self.missions=patch.object(o,'_missions',return_value={'launch-test':self.launch});self.missions.start()
    def tearDown(self):self.missions.stop();self.db.stop();self.tmp.cleanup()
    def submit(self,data=None):return o.submit(s.connect,data or self.data,'203.0.113.1',now=self.now,find_mission=lambda _:self.launch)
    def test_persistence_idempotency_and_moderation(self):
        a=self.submit();self.assertEqual(self.submit(),a)
        listing=o.listing(s.connect,{})
        self.assertEqual(listing['total'],1);self.assertNotIn('fingerprint',listing['results'][0]);self.assertNotIn('ip',listing['results'][0])
        with self.assertRaises(o.ReportError):self.submit(dict(self.data,notes='changed'))
        o.review(s.connect,dict(id=a['id'],status='reviewed'))
        self.assertEqual(o.listing(s.connect,{})['total'],0)
        self.assertEqual(o.listing(s.connect,{'status':'reviewed'})['results'][0]['notes'],'<script>test</script>')
    def test_coordinates_required_pair_limits_and_unknown_system(self):
        for changes in [dict(place=''),dict(latitude=1),dict(latitude=91,longitude=0),dict(latitude=True,longitude=0),dict(latitude=float('nan'),longitude=0),dict(consent=False),dict(coordinateSystem='madeup'),dict(outcome='verified'),dict(observedAt='2026-01-01T00:00'),dict(notes='x'*1501)]:
            with self.subTest(changes=changes),self.assertRaises(o.ReportError):self.submit(dict(self.data,**changes))
        self.submit(dict(self.data,place='',latitude=0,longitude=0,coordinateSystem='WGS84'))
    def test_wrong_task_time_and_rate_limit(self):
        with self.assertRaises(o.ReportError):self.submit(dict(self.data,observedAt='2001-01-01T00:00:00+08:00'))
        for _ in range(5):self.submit(dict(self.data,id=str(uuid.uuid4())))
        with self.assertRaises(o.ReportError) as err:self.submit(dict(self.data,id=str(uuid.uuid4())))
        self.assertEqual(err.exception.status,429)
    def test_retention_independent_from_analytics(self):
        self.submit()
        with s.connect() as c:
            c.execute('UPDATE observations SET created=?',(self.now-100*86400,))
        s.cleanup();self.assertEqual(o.listing(s.connect,{})['total'],1)
        with s.connect() as c:o.clean(c,self.now+366*86400)
        self.assertEqual(o.listing(s.connect,{})['total'],0)
    def test_independent_fuzzy_report_and_candidate_replay(self):
        data=dict(self.data,timeText=o.dt.datetime.fromtimestamp(self.now,o.TZ).strftime('%Y年%m月%d日'),latitude=30,longitude=120,coordinateSystem='WGS84')
        for key in ('launchId','observedAt','outcome','approximate'):data.pop(key)
        result=self.submit(data)
        self.assertEqual(result['candidates'][0]['id'],'launch-test')
        self.assertEqual(result['candidates'][0]['distanceKm'],0)
        self.assertEqual(o.report_summary(s.connect)['counts'],{'launch-test':1})
        o.review(s.connect,dict(id=result['id'],status='invalid'))
        self.assertEqual(o.report_summary(s.connect)['counts'],{})
    def test_unparsed_fuzzy_time_still_saves_without_invented_match(self):
        data=dict(self.data,timeText='前几天傍晚')
        data.pop('launchId');data.pop('observedAt')
        result=self.submit(data)
        self.assertEqual(result['candidates'],[])
        self.assertEqual(o.listing(s.connect,{})['results'][0]['time_text'],'前几天傍晚')
    def test_matching_source_unavailable_still_accepts_report(self):
        data=dict(self.data,timeText='昨天晚上');data.pop('launchId');data.pop('observedAt')
        with patch.object(o,'_missions',side_effect=OSError('offline')):result=self.submit(data)
        self.assertIn('暂不可用',result['matchNote'])
    def test_time_parser_uses_beijing_and_does_not_guess(self):
        now=o.dt.datetime(2026,10,27,12,tzinfo=o.TZ).timestamp()
        lo,hi=o.time_window({'observed_at':'','time_text':'10月23日晚上6点20'},now)
        self.assertEqual(o.dt.datetime.fromtimestamp((lo+hi)/2,o.TZ).hour,18)
        self.assertIsNone(o.time_window({'observed_at':'','time_text':'之前'},now))
    def test_http_auth_origin_and_public_no_read(self):
        http=s.ThreadingHTTPServer(('127.0.0.1',0),s.Handler);thread=threading.Thread(target=http.serve_forever,daemon=True);thread.start()
        base=f'http://127.0.0.1:{http.server_port}'
        def request(path,data=None,headers=None):
            req=Request(base+path,data=json.dumps(data).encode() if data is not None else None,headers=headers or {})
            try:
                with urlopen(req) as r:return r.status,json.loads(r.read() or '{}')
            except HTTPError as e:
                code=e.code;e.close();return code,{}
        try:
            self.assertEqual(request('/api/reports')[0],403)
            self.assertEqual(request('/report')[0],403)
            self.assertEqual(request('/report',self.data)[0],403)
            self.assertEqual(request('/api/reports/status',{'id':'x','status':'reviewed'},{'Origin':s.ORIGIN,'Content-Type':'application/json'})[0],403)
            self.assertEqual(request('/api/reports/status',{}, {'Origin':'https://evil.example','X-Xingtu-Admin':'1','Content-Type':'application/json'})[0],403)
            self.submit()
            code,d=request('/api/reports',headers={'X-Xingtu-Admin':'1'})
            self.assertEqual(code,200);self.assertEqual(d['total'],1)
            headers={'Origin':'https://app.bh1jss.net','X-Xingtu-Admin':'1','Content-Type':'application/json'}
            self.assertEqual(request('/api/reports/status',{'id':self.data['id'],'status':'reviewed'},headers)[0],200)
        finally:http.shutdown();http.server_close();thread.join()

if __name__=='__main__':unittest.main()
