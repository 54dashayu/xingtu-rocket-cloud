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
    def test_match_publish_and_public_launch(self):
        import base64,io
        from PIL import Image
        raw=io.BytesIO();Image.new('RGB',(8,8)).save(raw,format='JPEG')
        self.submit(dict(self.data,photo='data:image/jpeg;base64,'+base64.b64encode(raw.getvalue()).decode(),publishConsent=True))
        o.match_report(s.connect,dict(id=self.data['id'],action='assign',launchId='launch-test',publish=True,publicCaption='管理员整理说明'))
        item=o.public_reports(s.connect)['results'][0]
        self.assertEqual(item['launchId'],'launch-test')
        self.assertEqual(item['caption'],'管理员整理说明')
        self.assertNotIn('place',item)
        o.review(s.connect,dict(id=self.data['id'],status='reviewed'))
        self.assertEqual(o.public_reports(s.connect)['results'],[])
    def test_public_credit_is_explicit_and_never_legacy_identity(self):
        import base64,io
        from PIL import Image
        raw=io.BytesIO();Image.new('RGB',(8,8)).save(raw,format='JPEG')
        photo='data:image/jpeg;base64,'+base64.b64encode(raw.getvalue()).decode()
        data=dict(self.data,photo=photo,publishConsent=True,publicCredit='摄影小王',publicPlace='山东沿海')
        self.submit(data)
        o.review(s.connect,dict(id=data['id'],status='published',publicCaption='观测照片'))
        item=o.public_reports(s.connect)['results'][0]
        self.assertEqual(item['credit'],'摄影小王');self.assertEqual(item['publicPlace'],'山东沿海')
        for key in ('nickname','place','latitude','longitude','notes'):self.assertNotIn(key,item)
        with self.assertRaises(o.ReportError):self.submit(dict(data,publicCredit='改名'))
        private=dict(self.data,id=str(uuid.uuid4()),photo=photo,publishConsent=False,publicCredit='不公开',publicPlace='不公开地点')
        self.submit(private)
        with s.connect() as c:
            row=c.execute('SELECT public_credit,public_place FROM observations WHERE id=?',(private['id'],)).fetchone()
        self.assertEqual(tuple(row),('',''))

    def test_match_publish_rejects_without_consent(self):
        self.submit()
        with self.assertRaises(o.ReportError):o.match_report(s.connect,dict(id=self.data['id'],action='assign',launchId='launch-test',publish=True,publicCaption='说明'))
        self.assertEqual(o.listing(s.connect,{})['results'][0]['match_method'],'')
    def test_admin_match_assign_recommend_clear_preserves_report(self):
        self.submit()
        before=o.listing(s.connect,{})['results'][0]
        o.match_report(s.connect,dict(id=self.data['id'],action='assign',launchId='launch-test'))
        d=o.match_report(s.connect,dict(id=self.data['id'],action='recommend',inputs={'place':'浙江杭州'}))
        self.assertIn('杭州市中心',d['candidates'][0]['basis'])
        after=o.listing(s.connect,{})['results'][0]
        for key in ('notes','place','observed_at','status','fingerprint'):
            if key in before:self.assertEqual(before[key],after[key])
        self.assertEqual(after['match_method'],'admin')
        self.assertEqual(after['launch_id'],'launch-test')
        o.match_report(s.connect,dict(id=self.data['id'],action='clear'))
        self.assertEqual(o.listing(s.connect,{})['results'][0]['launch_id'],'')
        self.assertEqual(o.report_summary(s.connect)['counts'],{})
    def test_admin_matching_validation_and_source_outage(self):
        self.submit()
        for data in [dict(action='assign',launchId='missing'),dict(action='recommend',inputs={'latitude':91,'longitude':0}),dict(action='recommend',inputs={'latitude':1}),dict(action='bad')]:
            with self.assertRaises(o.ReportError):o.match_report(s.connect,dict(id=self.data['id'],**data))
        before=o.listing(s.connect,{})['results'][0]['candidates']
        with patch.object(o,'_missions',side_effect=OSError('offline')),self.assertRaises(o.ReportError):
            o.match_report(s.connect,dict(id=self.data['id'],action='recommend'))
        self.assertEqual(before,o.listing(s.connect,{})['results'][0]['candidates'])
    def test_matching_relative_date_anchor_and_city_ambiguity(self):
        p=dict(observed_at='',time_text='今天',place='杭州上海',latitude=None,longitude=None,coordinate_system='unknown',created=self.now)
        result,_=o.match_candidates(p,self.now+4*86400)
        self.assertEqual(result[0]['id'],'launch-test')
        self.assertIsNone(result[0]['distanceKm'])
        self.assertEqual(o.search_missions({'q':'测试'})['total'],1)
        self.assertEqual(o.search_missions({'q':'不存在'})['total'],0)
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
    def test_optional_photo_storage_idempotency_privacy_and_retention(self):
        import base64, io
        from PIL import Image
        raw=io.BytesIO();image=Image.new('RGB',(20,20),'blue');image.save(raw,format='JPEG',comment=b'private metadata')
        photo='data:image/jpeg;base64,'+base64.b64encode(raw.getvalue()).decode()
        result=self.submit(dict(self.data,photo=photo))
        self.assertEqual(self.submit(dict(self.data,photo=photo)),result)
        row=o.listing(s.connect,{})['results'][0]
        self.assertTrue(row['has_photo']);self.assertNotIn('image',row)
        stored=o.image_for_report(s.connect,result['id'])
        self.assertNotIn(b'private metadata',stored)
        self.assertEqual(Image.open(io.BytesIO(stored)).format,'JPEG')
        with self.assertRaises(o.ReportError):self.submit(self.data)
        self.assertNotIn('photo',json.dumps(o.report_summary(s.connect)))
        with s.connect() as c:o.clean(c,self.now+366*86400)
        with self.assertRaises(o.ReportError):o.image_for_report(s.connect,result['id'])
    def test_reject_invalid_multiple_or_oversized_photo(self):
        for photo in [[],{},['one','two'],'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/jpeg;base64,invalid', 'data:image/jpeg;base64,'+'A'*1400001]:
            with self.subTest(photo=type(photo)),self.assertRaises(o.ReportError):self.submit(dict(self.data,photo=photo))
    def test_publication_requires_consent_photo_review_and_withdrawal(self):
        import base64,io
        from PIL import Image
        raw=io.BytesIO();Image.new('RGB',(10,10),'blue').save(raw,format='JPEG')
        photo='data:image/jpeg;base64,'+base64.b64encode(raw.getvalue()).decode()
        private=self.submit(dict(self.data,photo=photo))['id']
        with self.assertRaises(o.ReportError):o.review(s.connect,dict(id=private,status='published',publicCaption='公开说明'))
        with self.assertRaises(o.ReportError):self.submit(dict(self.data,id=str(uuid.uuid4()),publishConsent=True))
        rid=str(uuid.uuid4());data=dict(self.data,id=rid,photo=photo,publishConsent=True,latitude=30,longitude=120)
        self.submit(data)
        self.assertEqual(o.public_reports(s.connect)['results'],[])
        with self.assertRaises(o.ReportError):o.public_image(s.connect,rid)
        with self.assertRaises(o.ReportError):o.review(s.connect,dict(id=rid,status='published',publicCaption=''))
        with self.assertRaises(o.ReportError):self.submit(dict(data,publishConsent=False))
        o.review(s.connect,dict(id=rid,status='published',publicCaption='经过审核的照片'))
        public=o.public_reports(s.connect)['results']
        self.assertEqual(public,[dict(id=rid,caption='经过审核的照片',credit='',publicPlace='')])
        self.assertTrue(o.public_image(s.connect,rid).startswith(b'\xff\xd8'))
        o.review(s.connect,dict(id=rid,status='reviewed'))
        self.assertEqual(o.public_reports(s.connect)['results'],[])
        with self.assertRaises(o.ReportError):o.public_image(s.connect,rid)
        o.review(s.connect,dict(id=rid,status='published',publicCaption='重新展示'))
        with s.connect() as c:c.execute('UPDATE observations SET created=? WHERE id=?',(time.time()-366*86400,rid))
        self.assertEqual(o.public_reports(s.connect)['results'],[])
        with self.assertRaises(o.ReportError):o.public_image(s.connect,rid)
        with self.assertRaises(o.ReportError):o.review(s.connect,dict(id=rid,status='published',publicCaption='过期'))
    def test_old_reports_migrate_without_publication_consent(self):
        self.submit()
        with s.connect() as c:
            o.init(c)
            row=c.execute('SELECT publish_consent,public_caption FROM observations').fetchone()
        self.assertEqual(tuple(row),(0,''))
        self.assertEqual(o.public_reports(s.connect)['results'],[])

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
            self.assertEqual(request('/public-reports')[1]['results'],[])
            self.assertEqual(request('/public-report-images/'+self.data['id'])[0],404)
            self.assertEqual(request('/api/report-images/'+self.data['id'])[0],403)
            self.assertEqual(request('/report',self.data)[0],403)
            self.assertEqual(request('/api/reports/status',{'id':'x','status':'reviewed'},{'Origin':s.ORIGIN,'Content-Type':'application/json'})[0],403)
            self.assertEqual(request('/api/reports/status',{}, {'Origin':'https://evil.example','X-Xingtu-Admin':'1','Content-Type':'application/json'})[0],403)
            self.assertEqual(request('/api/report-missions')[0],403)
            self.assertEqual(request('/api/reports/match',{}, {'Origin':s.ORIGIN,'Content-Type':'application/json'})[0],403)
            self.assertEqual(request('/api/reports/match',{}, {'Origin':'https://evil.example','X-Xingtu-Admin':'1','Content-Type':'application/json'})[0],403)
            self.submit()
            code,d=request('/api/reports',headers={'X-Xingtu-Admin':'1'})
            self.assertEqual(code,200);self.assertEqual(d['total'],1)
            headers={'Origin':'https://app.bh1jss.net','X-Xingtu-Admin':'1','Content-Type':'application/json'}
            self.assertEqual(request('/api/reports/status',{'id':self.data['id'],'status':'reviewed'},headers)[0],200)
            self.assertEqual(request('/api/reports/match',{'id':self.data['id'],'action':'assign','launchId':'launch-test'},headers)[0],200)
            self.assertEqual(request('/api/report-missions?q=launch-test',headers={'X-Xingtu-Admin':'1'})[0],200)
        finally:http.shutdown();http.server_close();thread.join()

if __name__=='__main__':unittest.main()
