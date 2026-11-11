import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch
import tempfile
import json

spec = importlib.util.spec_from_file_location('watchdog', Path(__file__).resolve().parents[1] / 'deploy/launch-watchdog.py')
w = importlib.util.module_from_spec(spec)
spec.loader.exec_module(w)
NOW = 2000000000

def snapshot(age=0, checked_age=None, retry=0):
    iso = lambda t: w.dt.datetime.fromtimestamp(t, w.dt.timezone.utc).isoformat()
    feed = {'fetchedAt': iso(NOW-age), 'checkedAt': iso(NOW-(age if checked_age is None else checked_age)), 'retryAt': retry*1000}
    return {'schemaVersion': 1, 'entries': [], 'revision': 5, 'feeds': {'upcoming': dict(feed), 'history': dict(feed)}}

class WatchdogTest(unittest.TestCase):
    def decide(self, snap=None, meta=None, prior=None, now=NOW, writer=True):
        return w.evaluate(snap, meta, prior or {}, now, writer)

    def test_fresh(self):
        r, action = self.decide(snapshot(), {'revision': 5, 'refreshing': False})
        self.assertEqual(r['status'], 'healthy'); self.assertFalse(action)

    def test_stale_two_checks(self):
        snap = snapshot(3600)
        first, action = self.decide(snap, {'revision': 5})
        self.assertFalse(action)
        second, action = self.decide(snap, {'revision': 5}, first, NOW+120)
        self.assertTrue(action); self.assertEqual(second['issue'], 'stale_without_progress')

    def test_upstream_retry_not_restart(self):
        for snap in (snapshot(86400, checked_age=60), snapshot(86400, retry=NOW+3600)):
            r, action = self.decide(snap, {'revision': 5}, {'badChecks': 99})
            self.assertFalse(action); self.assertIsNone(r['issue'])

    def test_refresh_hang_and_progress(self):
        prior = {'revision': 5, 'refreshingSince': NOW-400, 'badChecks': 1}
        r, action = self.decide(snapshot(), {'revision': 5, 'refreshing': True}, prior)
        self.assertTrue(action); self.assertEqual(r['issue'], 'refresh_stuck')
        snap = snapshot(); snap['revision'] = 6
        r, action = self.decide(snap, {'revision': 6, 'refreshing': True}, prior)
        self.assertFalse(action); self.assertEqual(r['refreshingSince'], NOW)

    def test_stale_single_range(self):
        snap = snapshot(); snap['feeds']['history'] = snapshot(3600)['feeds']['history']
        r, action = self.decide(snap, {'revision': 5}, {'badChecks': 1})
        self.assertTrue(action); self.assertEqual(r['staleFeeds'], ['history'])

    def test_reader_and_network_recovery(self):
        for meta in (None, {'revision': 4}):
            r, action = self.decide(snapshot(), meta, {'badChecks': 1}, writer=False)
            self.assertTrue(action)
        r, action = self.decide(snapshot(86400), {'revision': 5}, {'badChecks': 1}, writer=False)
        self.assertFalse(action)  # stale upstream is not reader failure

    def test_restart_budget(self):
        for history, status in (([NOW-60], 'recovery_cooldown'), ([NOW-2000, NOW-4000, NOW-6000], 'recovery_limit_reached')):
            r, action = self.decide(snapshot(), None, {'badChecks': 1, 'restarts': history})
            self.assertFalse(action); self.assertEqual(r['status'], status)

    def test_recovery_clears_bad_checks(self):
        r, action = self.decide(snapshot(), {'revision': 5}, {'badChecks': 4, 'status': 'api_unresponsive'})
        self.assertEqual(r['badChecks'], 0); self.assertEqual(r['status'], 'healthy')

    def test_runner_restart_persist_and_recovery(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); snapfile = root / 'snapshot.json'; snapfile.write_text(json.dumps(snapshot()))
            with patch.object(w, 'probe', return_value=None), patch.object(w.time, 'time', return_value=NOW), patch.object(w.subprocess, 'run') as restart:
                restart.return_value.returncode = 0
                w.run(root, snapfile); restart.assert_not_called()
                w.run(root, snapfile); self.assertEqual(restart.call_count, 2)
                w.run(root, snapfile); self.assertEqual(restart.call_count, 2)
            with patch.object(w, 'probe', return_value={'revision': 5}), patch.object(w.time, 'time', return_value=NOW+120):
                state = w.run(root, snapfile)
                self.assertEqual(state['rocket-cloud']['status'], 'healthy')
                self.assertEqual(len(state['rocket-cloud']['restarts']), 1)
                self.assertTrue(any(e.get('action') == 'restart' for e in state['events']))

if __name__ == '__main__':
    unittest.main()
