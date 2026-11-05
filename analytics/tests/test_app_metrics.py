import tempfile,time,unittest
from pathlib import Path
from unittest.mock import patch
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import server as s
import app_metrics as a
class AppMetricsTest(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.p=patch.object(s,'DB',str(Path(self.tmp.name)/'db'));self.p.start();s.init();self.now=time.time();self.d=dict(page='a'*32,session='b'*32,platform='android',version='0.03',build=10,foreground=True,active_ms=0,elapsed_ms=0)
 def tearDown(self):self.p.stop();self.tmp.cleanup()
 def test_heartbeat_idempotency_and_pause(self):
  a.ingest(s.connect,self.d,self.now);a.ingest(s.connect,dict(self.d,active_ms=30000,elapsed_ms=30000),self.now+30);a.ingest(s.connect,dict(self.d,foreground=False,active_ms=30000,elapsed_ms=60000),self.now+60)
  result=a.stats(s.connect,self.now-1,self.now+100);self.assertEqual(result['apps'][0]['sessions'],1);self.assertEqual(result['apps'][0]['seconds'],30);self.assertEqual(result['online'],0)
 def test_invalid_identity_and_duration(self):
  a.ingest(s.connect,self.d,self.now)
  for c in [dict(platform='web'),dict(build=True),dict(active_ms=float('nan')),dict(session='c'*32),dict(version='bad')]:
   with self.assertRaises(ValueError):a.ingest(s.connect,dict(self.d,**c),self.now+1)
  a.ingest(s.connect,dict(self.d,active_ms=999999,elapsed_ms=999999),self.now+1)
  self.assertLessEqual(a.stats(s.connect,self.now-1,self.now+2)['apps'][0]['seconds'],3)
 def test_download_daily_and_retention(self):
  a.download(s.connect,'0.03-0010',self.now);a.download(s.connect,'0.03-0010',self.now)
  self.assertEqual(a.stats(s.connect,self.now-86400,self.now+86400)['downloads'][0]['requests'],2)
  with s.connect() as c:a.clean(c,self.now+92*86400)
  self.assertEqual(a.stats(s.connect,self.now-86400,self.now+86400)['downloads'],[])
 def test_no_persistent_identity_columns(self):
  with s.connect() as c:cols={r[1] for r in c.execute('pragma table_info(app_usage)')}
  self.assertFalse(cols & {'ip','device_id','latitude','longitude','notes'})
