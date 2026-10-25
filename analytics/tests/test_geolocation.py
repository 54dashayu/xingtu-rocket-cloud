import sys
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from geolocation import GeoLocator, region_label
import server

class GeoTest(unittest.TestCase):
    def test_region_format(self):
        self.assertEqual(region_label('中国|北京市|北京市|电信|CN'), '中国 · 北京市')
        self.assertEqual(region_label('United States|California|0|Google|US'), '美国 · California')
        self.assertEqual(region_label('0|0|0|0|0'), '暂未识别')
        self.assertEqual(region_label('broken'), '暂未识别')
    def test_nonpublic_and_invalid_never_read_database(self):
        geo=GeoLocator('/missing')
        with patch.object(geo,'_search',side_effect=AssertionError('must not query')):
            self.assertEqual(geo.lookup('127.0.0.1'),'本机地址')
            self.assertEqual(geo.lookup('::1'),'本机地址')
            self.assertEqual(geo.lookup('192.168.1.1'),'内网或保留地址')
            self.assertEqual(geo.lookup('100.64.0.1'),'非公网地址')
            self.assertEqual(geo.lookup('bad'),'暂未识别')
    def test_ipv4_mapped_ipv6_and_cache(self):
        geo=GeoLocator('/missing')
        with patch.object(geo,'_search',return_value='中国|浙江省|杭州市|0|CN') as search:
            self.assertEqual(geo.lookup('::ffff:223.5.5.5'),'中国 · 浙江省 · 杭州市')
            self.assertEqual(search.call_args.args[0].version,4)
            geo.lookup('::ffff:223.5.5.5')
            self.assertEqual(search.call_count,1)
    def test_missing_database_fallback(self):
        with tempfile.TemporaryDirectory() as tmp:
            geo=GeoLocator(tmp)
            self.assertEqual(geo.lookup('8.8.8.8'),'暂未识别')
            self.assertEqual(geo.lookup('2001:4860:4860::8888'),'暂未识别')
            geo.close()
    def test_both_live_and_history_enriched(self):
        import time
        with tempfile.TemporaryDirectory() as tmp, patch.object(server,'DB',str(Path(tmp)/'db')), patch.object(server.locator,'lookup',return_value='中国 · 江苏省'):
            server.init(); now=time.time()
            server.ingest(dict(page='a'*32,session='b'*32,site='launch',path='/launch/',elapsed_ms=0,active_ms=0),'114.114.114.114','Chrome',now)
            with server.connect() as c:
                c.execute('INSERT INTO historical VALUES (?,?,?,?,?,?,?)',('h','rocket-cloud','114.114.114.114',now,'','电脑','Chrome'))
            for kind in ('live','history'):
                result=server.stats({'kind':kind})
                self.assertEqual(result['ips'][0]['region'],'中国 · 江苏省')
                self.assertEqual(result['recent'][0]['region'],'中国 · 江苏省')
                self.assertEqual(result['total']['pv'],1)

if __name__=='__main__': unittest.main()
