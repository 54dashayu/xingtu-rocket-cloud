import importlib.util
import tempfile
import unittest
import time
from pathlib import Path

spec = importlib.util.spec_from_file_location('analytics_server', Path(__file__).resolve().parents[1] / 'server.py')
s = importlib.util.module_from_spec(spec)
spec.loader.exec_module(s)

class AnalyticsTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        s.DB = str(Path(self.temp.name) / 'test.sqlite3')
        s.init()
        self.now = time.time()
        self.event = dict(page='a' * 32, session='s' * 32, site='launch', path='/launch/', elapsed_ms=0, active_ms=0, referrer='https://example.org/page?private=secret')
    def tearDown(self):
        self.temp.cleanup()
    def emit(self, **changes):
        e = dict(self.event, **changes)
        s.ingest(e, '203.0.113.7', 'Mozilla/5.0 Chrome/120', now=self.now + e['elapsed_ms'] / 1000)
    def test_idempotent_and_out_of_order(self):
        self.emit()
        self.emit(elapsed_ms=30000, active_ms=20000)
        self.emit(elapsed_ms=15000, active_ms=10000)
        d = s.stats({})
        self.assertEqual(d['total']['pv'], 1)
        self.assertEqual(d['total']['avg_seconds'], 20)
        self.assertEqual(d['recent'][0]['referrer'], 'example.org')
    def test_two_products_one_session_and_ip(self):
        self.emit()
        self.emit(page='b' * 32, site='rocket-cloud', path='/rocket-cloud/')
        d = s.stats({})
        self.assertEqual((d['total']['pv'], d['total']['sessions'], d['total']['ips']), (2, 1, 1))
        self.assertEqual(s.stats({'site':'rocket-cloud'})['total']['pv'], 1)
        self.assertEqual(s.stats({'ip':'203.0.113.8'})['total']['pv'], 0)
    def test_bounds_and_identity(self):
        self.emit()
        s.ingest(dict(self.event, elapsed_ms=10000000, active_ms=10000000), '203.0.113.7', 'Chrome', now=self.now+30)
        self.assertLessEqual(s.stats({})['recent'][0]['active_ms'], 32000)
        with self.assertRaises(ValueError):
            self.emit(site='rocket-cloud', path='/rocket-cloud/')
        for field in ['active_ms', 'elapsed_ms']:
            with self.assertRaises(ValueError): self.emit(**{field:float('nan')})
        with self.assertRaises(ValueError): self.emit(path='/admin/')
    def test_bot_and_retention(self):
        self.assertFalse(s.ingest(self.event, '203.0.113.7', 'Googlebot', now=self.now))
        s.ingest(self.event, '203.0.113.7', 'Chrome', now=self.now - 91*86400)
        s.cleanup()
        with s.connect() as c: self.assertEqual(c.execute('SELECT COUNT(*) FROM visits').fetchone()[0], 0)
    def test_history_separate_and_repeatable(self):
        stamp = time.strftime('%d/%b/%Y:%H:%M:%S +0000', time.gmtime(self.now - 60))
        def line(target, code=200, ua='Chrome'):
            return f'203.0.113.8 - - [{stamp}] "GET {target} HTTP/2.0" {code} 80 "https://example.org/private?q=s" "{ua}"\n'
        p = Path(self.temp.name) / 'access.log'
        p.write_text(line('/launch/')+line('/rocket-cloud/?v=4')+line('/launch/app.js')+line('/rocket-cloud/api/launches')+line('/launch/',301)+line('/launch/',ua='Googlebot'))
        self.assertEqual(s.import_logs([str(p)],self.now), 2)
        self.assertEqual(s.import_logs([str(p)],self.now), 0)
        d = s.stats({'kind':'history'})
        self.assertEqual(d['total']['pv'],2)
        self.assertIsNone(d['total']['avg_seconds'])
        self.assertEqual(s.stats({})['total']['pv'],0)
    def test_dashboard_product_options(self):
        from html.parser import HTMLParser
        class Options(HTMLParser):
            def __init__(self):
                super().__init__(); self.in_site=False; self.values=[]
            def handle_starttag(self,tag,attrs):
                a=dict(attrs)
                if tag=='select': self.in_site=a.get('id')=='site'
                if tag=='option' and self.in_site: self.values.append(a.get('value'))
            def handle_endtag(self,tag):
                if tag=='select': self.in_site=False
        parser=Options()
        parser.feed((s.ROOT / 'static/index.html').read_text())
        self.assertEqual(parser.values,['','launch','rocket-cloud'])

    def test_dates_and_pagination(self):
        with self.assertRaises(ValueError): s.stats({'start':'2026-10-20','end':'2026-10-01'})
        for i in range(32): self.emit(page=f'{i:032d}')
        self.assertEqual(len(s.stats({})['recent']),30)
        self.assertEqual(len(s.stats({'page':'2'})['recent']),2)

if __name__ == '__main__': unittest.main()
