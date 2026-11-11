import importlib.util
import json
from pathlib import Path
import tempfile
import threading
import unittest
import urllib.request
import urllib.error
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('monitor_server', ROOT / 'server.py')
s = importlib.util.module_from_spec(spec); spec.loader.exec_module(s)
m = s.cache_monitor

class MonitorTest(unittest.TestCase):
    def test_missing_and_old_checks_not_healthy(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'status.json'
            d=m.overview(path, 2000, {'active':'active','enabled':'enabled'})
            self.assertFalse(d['available']); self.assertEqual(d['monitoring'],'overdue')
            path.write_text(json.dumps({'rocket-cloud':{'checkedAt':1,'status':'healthy'},'launch-calendar':{'checkedAt':1,'status':'healthy'}}))
            d=m.overview(path,2000,{'active':'active','enabled':'enabled'})
            self.assertTrue(all(x['status']=='check_overdue' for x in d['services']))

    def test_snapshot_and_events(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'status.json'
            row={'checkedAt':4000,'status':'healthy','restarts':[3900]}
            path.write_text(json.dumps({'rocket-cloud':row,'launch-calendar':row,'snapshot':{'revision':9,'feeds':{'upcoming':{'fetchedAt':'1970-01-01T01:00:00Z'},'history':{'fetchedAt':'1970-01-01T00:01:00Z'}},'globalRetryAt':5000000},'events':[{'at':3900,'action':'restart','private':'hidden'}]}))
            d=m.overview(path,4001,{'active':'active','enabled':'enabled'})
            self.assertEqual(d['monitoring'],'running');self.assertFalse(d['feeds'][0]['stale']);self.assertTrue(d['feeds'][1]['stale'])
            self.assertEqual(d['feeds'][0]['retryAt'],5000);self.assertNotIn('private',d['events'][0])
            self.assertEqual(m.overview(path,4001,{'active':'inactive','enabled':'disabled'})['monitoring'],'stopped')

    def test_http_auth_and_asset_route(self):
        server=s.ThreadingHTTPServer(('127.0.0.1',0),s.Handler)
        threading.Thread(target=server.serve_forever,daemon=True).start()
        base=f'http://127.0.0.1:{server.server_port}'
        try:
            for path in ['/cache.html','/cache.js','/api/cache-monitor']:
                with self.assertRaises(urllib.error.HTTPError) as caught: urllib.request.urlopen(base+path)
                self.assertEqual(caught.exception.code,403)
            with patch.object(m,'overview',return_value={'monitoring':'running'}):
                req=urllib.request.Request(base+'/api/cache-monitor',headers={'X-Xingtu-Admin':'1'})
                with urllib.request.urlopen(req) as response:
                    self.assertEqual(json.load(response)['monitoring'],'running')
                    self.assertIn('no-store',response.headers['Cache-Control'])
            req=urllib.request.Request(base+'/cache.html',headers={'X-Xingtu-Admin':'1'})
            with urllib.request.urlopen(req) as response:self.assertIn('恢复与巡检记录',response.read().decode())
        finally: server.shutdown();server.server_close()

if __name__=='__main__': unittest.main()
