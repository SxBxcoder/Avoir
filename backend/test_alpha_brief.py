"""
Tests for the Daily Alpha Brief Generator.

Run with:
    python test_alpha_brief.py          (or)    pytest test_alpha_brief.py

Covers: cache hit/miss, force refresh, Gemini parsing, Trend Sniper fallback,
Titanium Shield mock, momentum normalization, and graceful cache degradation.
"""

import json
import os
import sys
import unittest
from unittest.mock import patch, Mock

sys.path.insert(0, os.path.dirname(__file__))

from fastapi.testclient import TestClient

import alpha_brief_generator as abg
from alpha_brief_generator import AlphaBriefGenerator, RedisCache

VALID_BRIEF_JSON = {
    "trend": {
        "title": "AI Micro-Agents",
        "description": "Single-purpose agents eating SaaS.",
        "momentum": "spiking",
    },
    "brief": {
        "plan": {
            "hook": "SaaS is dead, hello micro-agents.",
            "offer": "5 agents for the price of 1 tool.",
            "cta": "Start building today.",
        },
        "captions": ["c1", "c2", "c3"],
    },
}


class RedisCacheTests(unittest.TestCase):
    def test_disabled_cache_returns_none_and_noops(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop('UPSTASH_REDIS_REST_URL', None)
            os.environ.pop('UPSTASH_REDIS_REST_TOKEN', None)
            cache = RedisCache(url='', token='')
            self.assertFalse(cache.enabled)
            self.assertIsNone(cache.get('alpha_brief:daily:2026-08-10'))
            # set() must not raise when disabled
            cache.set('k', {'a': 1}, 3600)

    def test_get_parses_rest_response(self):
        cache = RedisCache(url='https://db.upstash.io', token='tok')
        with patch.object(abg, 'urlopen') as mock_urlopen:
            cm = mock_urlopen.return_value.__enter__.return_value
            cm.read.return_value = json.dumps({"result": json.dumps(VALID_BRIEF_JSON)}).encode()
            result = cache.get('alpha_brief:daily:2026-08-10')
        self.assertEqual(result['trend']['title'], 'AI Micro-Agents')

    def test_get_handles_missing_key(self):
        cache = RedisCache(url='https://db.upstash.io', token='tok')
        with patch.object(abg, 'urlopen') as mock_urlopen:
            cm = mock_urlopen.return_value.__enter__.return_value
            cm.read.return_value = b'{"result": null}'
            self.assertIsNone(cache.get('alpha_brief:daily:2026-08-10'))

    def test_set_uses_pipeline(self):
        cache = RedisCache(url='https://db.upstash.io', token='tok')
        with patch.object(abg, 'urlopen') as mock_urlopen:
            cache.set('alpha_brief:daily:2026-08-10', VALID_BRIEF_JSON, 3600)
            mock_urlopen.assert_called_once()
        self.assertTrue(mock_urlopen.return_value.__enter__.called)

    def test_set_if_absent_sends_setnx_command(self):
        cache = RedisCache(url='https://db.upstash.io', token='tok')
        with patch.object(abg, 'urlopen') as mock_urlopen:
            cm = mock_urlopen.return_value.__enter__.return_value
            cm.read.return_value = json.dumps({"result": [["SET", "OK", None]]}).encode()
            acquired = cache.set_if_absent('alpha_brief:daily:2026-08-10:lock', '1', 180)
        self.assertTrue(acquired)
        command = json.loads(mock_urlopen.call_args[0][0].data)
        self.assertEqual(
            command,
            [["SET", "alpha_brief:daily:2026-08-10:lock", "1", "NX", "EX", 180]],
        )

    def test_set_if_absent_reports_lock_held(self):
        cache = RedisCache(url='https://db.upstash.io', token='tok')
        with patch.object(abg, 'urlopen') as mock_urlopen:
            cm = mock_urlopen.return_value.__enter__.return_value
            cm.read.return_value = json.dumps({"result": [["SET", None, None]]}).encode()
            acquired = cache.set_if_absent('k:lock', '1', 180)
        self.assertFalse(acquired)

    def test_set_if_absent_disabled_returns_none(self):
        cache = RedisCache(url='', token='')
        self.assertIsNone(cache.set_if_absent('k:lock', '1', 180))

    def test_is_valid_brief(self):
        self.assertFalse(abg.is_valid_brief(None))
        self.assertFalse(abg.is_valid_brief({'trend': {'title': 'x'}}))
        bad_momentum = dict(VALID_BRIEF_JSON)
        bad_momentum['trend'] = {'title': 'x', 'description': 'y', 'momentum': 'mooning'}
        self.assertFalse(abg.is_valid_brief(bad_momentum))
        self.assertTrue(abg.is_valid_brief(VALID_BRIEF_JSON))


class GeneratorTests(unittest.TestCase):
    def setUp(self):
        self.gen = AlphaBriefGenerator(cache=Mock())

    def test_returns_cached_brief_when_present(self):
        self.gen.cache.get.return_value = VALID_BRIEF_JSON
        result = self.gen.get_daily_brief()
        self.assertEqual(result, VALID_BRIEF_JSON)
        self.gen.cache.get.assert_called_once()

    def test_force_refresh_ignores_cache(self):
        self.gen.cache.get.return_value = VALID_BRIEF_JSON
        with patch.object(self.gen, '_generate', return_value=dict(VALID_BRIEF_JSON)) as mock_gen:
            result = self.gen.get_daily_brief(force_refresh=True)
            self.gen.cache.get.assert_not_called()
            mock_gen.assert_called_once()
            today_utc = abg.datetime.now(abg.timezone.utc).date().isoformat()
            self.assertEqual(result['date'], today_utc)
            self.assertTrue(result['generated_at'].endswith('Z'))

    def test_utc_cache_contract(self):
        """Cache key and TTL must follow the shared UTC contract used by the frontend."""
        today_utc = abg.datetime.now(abg.timezone.utc).date().isoformat()
        key = f"{abg.CACHE_PREFIX}{today_utc}"
        self.assertTrue(key.startswith('alpha_brief:daily:'))
        self.assertEqual(key, f"alpha_brief:daily:{today_utc}")
        ttl = abg.seconds_until_end_of_day()
        self.assertGreater(ttl, 0)
        self.assertLessEqual(ttl, 86400)
        generated_at = abg.datetime.now(abg.timezone.utc).isoformat().replace('+00:00', 'Z')
        self.assertTrue(generated_at.endswith('Z'))

    def test_miss_generates_and_caches(self):
        self.gen.cache.get.return_value = None
        with patch.object(self.gen, '_generate', return_value=dict(VALID_BRIEF_JSON)) as mock_gen:
            result = self.gen.get_daily_brief()
            mock_gen.assert_called_once()
            self.gen.cache.set.assert_called_once()
            args, kwargs = self.gen.cache.set.call_args
            key, value, ttl = args[0], args[1], kwargs.get('ttl_seconds') or args[2]
            self.assertTrue(key.startswith('alpha_brief:daily:'))
            self.assertGreater(ttl, 0)

    def test_stampede_lock_holder_generates(self):
        self.gen.cache.get.return_value = None
        self.gen.cache.set_if_absent.return_value = True
        with patch.object(self.gen, '_generate', return_value=dict(VALID_BRIEF_JSON)) as mock_gen:
            result = self.gen.get_daily_brief()
        mock_gen.assert_called_once()
        self.gen.cache.set.assert_called_once()
        self.gen.cache.delete.assert_called_once()

    def test_stampede_loser_waits_for_winner(self):
        self.gen.cache.get.side_effect = [None, VALID_BRIEF_JSON]
        self.gen.cache.set_if_absent.return_value = False
        with patch.object(self.gen, '_generate') as mock_gen:
            result = self.gen.get_daily_brief()
        mock_gen.assert_not_called()
        self.gen.cache.set.assert_not_called()
        self.gen.cache.delete.assert_not_called()
        self.assertEqual(result['trend']['title'], 'AI Micro-Agents')

    def test_invalid_cached_payload_is_regenerated(self):
        self.gen.cache.get.return_value = {'trend': {'title': 'x', 'momentum': 'bogus'}}
        self.gen.cache.set_if_absent.return_value = True
        with patch.object(self.gen, '_generate', return_value=dict(VALID_BRIEF_JSON)) as mock_gen:
            result = self.gen.get_daily_brief()
        mock_gen.assert_called_once()
        self.assertEqual(result['trend']['title'], 'AI Micro-Agents')

    def test_momentum_normalization(self):
        self.assertEqual(abg.AlphaBriefGenerator._normalize_momentum('Spiking (+400% in 12h)'), 'spiking')
        self.assertEqual(abg.AlphaBriefGenerator._normalize_momentum('Sustained (+120% in 48h)'), 'sustained')
        self.assertEqual(abg.AlphaBriefGenerator._normalize_momentum('peaking'), 'peaking')
        self.assertEqual(abg.AlphaBriefGenerator._normalize_momentum(''), 'rising')
        self.assertEqual(abg.AlphaBriefGenerator._normalize_momentum(None), 'rising')

    def test_normalize_brief_accepts_valid(self):
        result = self.gen._normalize_brief(dict(VALID_BRIEF_JSON))
        self.assertEqual(result['trend']['momentum'], 'spiking')
        self.assertEqual(len(result['brief']['captions']), 3)

    def test_normalize_brief_rejects_invalid(self):
        with self.assertRaises(Exception):
            self.gen._normalize_brief({'trend': {'title': 'x'}})


class FallbackTests(unittest.TestCase):
    def setUp(self):
        self.gen = AlphaBriefGenerator(cache=Mock())

    def test_trend_sniper_fallback(self):
        fake_trends = [{
            'trend_name': 'POV Main Character Transition',
            'description': 'Fast-paced whip transition with phonk music.',
            'velocity': 'Spiking (+400% in 12h)',
            'virality_score': 98,
            'suggested_hook': 'POV: You finally stopped playing it safe...',
        }]
        with patch.dict('sys.modules', {'trends_sniper': Mock(sniper=Mock(get_current_trends=lambda: fake_trends))}):
            brief = self.gen._fallback_from_sniper()
        self.assertEqual(brief['trend']['title'], 'POV Main Character Transition')
        self.assertEqual(brief['trend']['momentum'], 'spiking')
        self.assertEqual(brief['brief']['plan']['hook'], 'POV: You finally stopped playing it safe...')

    def test_gemini_success_is_used_first(self):
        with patch.dict(os.environ, {'GEMINI_API_KEY': 'fake-key'}, clear=False):
            os.environ.pop('GEMINI_API_KEY_2', None)
            with patch.object(self.gen, '_generate_with_gemini', return_value=dict(VALID_BRIEF_JSON)) as mock_gemini, \
                 patch.object(self.gen, '_fallback_from_sniper') as mock_sniper:
                result = self.gen._generate()
        mock_gemini.assert_called_once()
        mock_sniper.assert_not_called()
        self.assertEqual(result['generated_by'], 'gemini-3-flash-preview')

    def test_mock_terminus_when_everything_fails(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop('GEMINI_API_KEY', None)
            os.environ.pop('GEMINI_API_KEY_2', None)
            with patch.object(self.gen, '_fallback_from_sniper', return_value=None):
                result = self.gen._generate()
        self.assertEqual(result['generated_by'], 'mock')
        self.assertTrue(result['trend']['title'])

    def test_mock_brief_shape(self):
        brief = abg.get_mock_brief()
        self.assertIn(brief['trend']['momentum'], ('spiking', 'rising', 'peaking', 'sustained'))
        self.assertTrue(brief['brief']['plan']['hook'])
        self.assertTrue(brief['brief']['plan']['offer'])


class ServerEndpointTests(unittest.TestCase):
    """
    HTTP-level tests for GET /api/alpha-brief via FastAPI TestClient.

    Verifies the admin-token gate on ?force=true (403 without a valid
    X-Admin-Token header, 200 with one) and a normal cached read.
    """

    @classmethod
    def setUpClass(cls):
        # Stub the AWS/agent modules so server.py can be imported without
        # boto3 or other heavy deps installed (same trick as the sniper stub).
        cls._stub_modules = {}
        for name, attr in (
            ('aws_lambda_handler', 'lambda_handler'),
            ('trends_sniper', 'sniper'),
            ('shadow_clone', 'clone_engine'),
            ('authority_defender', 'defender'),
            ('agency_bridge', 'agency_bridge'),
            ('signal_decay_monitor', 'decay_monitor'),
        ):
            cls._stub_modules[name] = sys.modules.get(name)
            module = Mock()
            setattr(module, attr, Mock())
            sys.modules[name] = module

        import server as server_module
        cls.server = server_module
        cls.client = TestClient(server_module.app)

    @classmethod
    def tearDownClass(cls):
        for name, module in cls._stub_modules.items():
            if module is None:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = module

    def test_force_without_token_is_forbidden(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop('ALPHA_BRIEF_ADMIN_TOKEN', None)
            with patch.object(self.server.alpha_brief_generator, 'get_daily_brief') as mock_gen:
                res = self.client.get('/api/alpha-brief', params={'force': 'true'})
        self.assertEqual(res.status_code, 403)
        mock_gen.assert_not_called()

    def test_force_with_wrong_token_is_forbidden(self):
        with patch.dict(os.environ, {'ALPHA_BRIEF_ADMIN_TOKEN': 'correct-token'}):
            with patch.object(self.server.alpha_brief_generator, 'get_daily_brief') as mock_gen:
                res = self.client.get(
                    '/api/alpha-brief',
                    params={'force': 'true'},
                    headers={'X-Admin-Token': 'wrong-token'},
                )
        self.assertEqual(res.status_code, 403)
        mock_gen.assert_not_called()

    def test_force_with_valid_token_succeeds(self):
        with patch.dict(os.environ, {'ALPHA_BRIEF_ADMIN_TOKEN': 'correct-token'}):
            with patch.object(
                self.server.alpha_brief_generator,
                'get_daily_brief',
                return_value=dict(VALID_BRIEF_JSON),
            ) as mock_gen:
                res = self.client.get(
                    '/api/alpha-brief',
                    params={'force': 'true'},
                    headers={'X-Admin-Token': 'correct-token'},
                )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['trend']['title'], 'AI Micro-Agents')
        mock_gen.assert_called_once()

    def test_normal_call_returns_200(self):
        with patch.object(
            self.server.alpha_brief_generator,
            'get_daily_brief',
            return_value=dict(VALID_BRIEF_JSON),
        ) as mock_gen:
            res = self.client.get('/api/alpha-brief')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['trend']['title'], 'AI Micro-Agents')
        mock_gen.assert_called_once()


if __name__ == "__main__":
    unittest.main()
