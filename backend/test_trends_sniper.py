"""
Tests for the Apify TikTok trend source in TrendSniper.

Run with:
    python test_trends_sniper.py          (or)    pytest test_trends_sniper.py

Covers: actor output mapping, play-count formatting, hashtag derivation,
cascade placement (Apify before Gemini), failure fall-through, and caching.
"""

import os
import sys
import unittest
from unittest.mock import patch, Mock

sys.path.insert(0, os.path.dirname(__file__))

import trends_sniper
from trends_sniper import TrendSniper, _TREND_CACHE


def make_video(caption="viral caption", plays=500_000, author="creator1"):
    return {
        "text": caption,
        "playCount": plays,
        "authorMeta": {"name": author},
        "webVideoUrl": "https://tiktok.com/@x/video/1",
    }


class ApifyTikTokTests(unittest.TestCase):
    def setUp(self):
        _TREND_CACHE.clear()
        self.sniper = TrendSniper()
        self.sniper.serpapi_key = None
        self.sniper.youtube_api_key = None
        self.sniper.apify_api_token = "apify_tok"
        self.sniper.apify_actor = "clockworks/tiktok-scraper"

    def test_maps_actor_items_to_trend_shape(self):
        items = [make_video(caption="Big line\nsmall line", plays=2_400_000)]
        with patch.object(trends_sniper.requests, "post") as mock_post:
            mock_post.return_value = Mock(**{"raise_for_status.side_effect": None,
                                             "json.return_value": items})
            result = self.sniper._fetch_apify_tiktok_trends("fitness")

        self.assertEqual(result["source"], "apify")
        trend = result["topTrends"][0]
        self.assertEqual(trend["keyword"], "Big line")
        self.assertEqual(trend["momentum"], "peaking")
        self.assertEqual(trend["searchVolume"], "2.4M plays")
        self.assertIn("@creator1", trend["context"])
        self.assertTrue(result["viralHooks"])

        # Actor contract: sync-run endpoint, token param, hashtag input, no media downloads
        args, kwargs = mock_post.call_args
        self.assertIn("run-sync-get-dataset-items", args[0])
        self.assertEqual(kwargs["params"]["token"], "apify_tok")
        self.assertEqual(kwargs["json"]["hashtags"], ["fitness"])
        self.assertFalse(kwargs["json"]["shouldDownloadVideos"])

    def test_sorts_by_play_count_and_caps_at_six(self):
        items = [make_video(plays=p) for p in (10, 9_000_000, 50, 4_000_000, 20, 30, 40, 60)]
        with patch.object(trends_sniper.requests, "post") as mock_post:
            mock_post.return_value.json.return_value = items
            result = self.sniper._fetch_apify_tiktok_trends("fitness")

        self.assertEqual(len(result["topTrends"]), 6)
        self.assertIn("9.0M plays", [t["searchVolume"] for t in result["topTrends"]])

    def test_skips_items_without_caption(self):
        items = [{"playCount": 100}, make_video()]
        with patch.object(trends_sniper.requests, "post") as mock_post:
            mock_post.return_value.json.return_value = items
            result = self.sniper._fetch_apify_tiktok_trends("fitness")

        self.assertEqual(len(result["topTrends"]), 1)

    def test_non_list_output_raises(self):
        with patch.object(trends_sniper.requests, "post") as mock_post:
            mock_post.return_value.json.return_value = {"error": "nope"}
            with self.assertRaises(ValueError):
                self.sniper._fetch_apify_tiktok_trends("fitness")

    def test_empty_results_are_falsy_for_cascade(self):
        with patch.object(trends_sniper.requests, "post") as mock_post:
            mock_post.return_value.json.return_value = []
            result = self.sniper._fetch_apify_tiktok_trends("fitness")
        self.assertFalse(result["topTrends"])

    def test_hashtag_derivation(self):
        self.assertEqual(TrendSniper._industry_to_hashtag("Home Fitness!"), "homefitness")
        self.assertEqual(TrendSniper._industry_to_hashtag("   "), "trending")

    def test_play_formatting(self):
        f = TrendSniper._format_plays
        self.assertEqual(f(2_400_000), "2.4M plays")
        self.assertEqual(f(15_000), "15K plays")
        self.assertEqual(f(999), "999 plays")


class CascadePlacementTests(unittest.TestCase):
    def setUp(self):
        _TREND_CACHE.clear()

    def _sniper(self, **keys):
        s = TrendSniper()
        s.serpapi_key = keys.get("serpapi")
        s.youtube_api_key = keys.get("youtube")
        s.apify_api_token = keys.get("apify")
        return s

    @patch.object(trends_sniper.TrendSniper, "_generate_ai_trends")
    @patch.object(trends_sniper.TrendSniper, "_fetch_apify_tiktok_trends")
    def test_apify_wins_over_gemini_when_only_apify_key_set(self, mock_apify, mock_gemini):
        mock_apify.return_value = {"topTrends": [{"keyword": "k"}], "source": "apify"}
        result = self._sniper(apify="tok").get_trends_for_industry("fitness")

        self.assertEqual(result["source"], "apify")
        mock_gemini.assert_not_called()

    @patch.object(trends_sniper.TrendSniper, "_generate_ai_trends")
    @patch.object(trends_sniper.TrendSniper, "_fetch_apify_tiktok_trends")
    def test_apify_failure_falls_through_to_gemini(self, mock_apify, mock_gemini):
        mock_apify.side_effect = RuntimeError("actor down")
        mock_gemini.return_value = {"topTrends": [{"keyword": "g"}], "source": "gemini"}
        result = self._sniper(apify="tok").get_trends_for_industry("fitness")

        self.assertEqual(result["source"], "gemini")

    @patch.object(trends_sniper.TrendSniper, "_generate_ai_trends")
    @patch.object(trends_sniper.TrendSniper, "_fetch_apify_tiktok_trends")
    def test_no_keys_reports_sources_in_error(self, mock_apify, mock_gemini):
        mock_gemini.return_value = {}
        result = self._sniper().get_trends_for_industry("fitness")

        self.assertEqual(result["source"], "none")
        self.assertIn("APIFY_API_TOKEN", result["error"])

    @patch.object(trends_sniper.TrendSniper, "_fetch_apify_tiktok_trends")
    def test_second_call_within_ttl_hits_cache_not_apify(self, mock_apify):
        mock_apify.return_value = {"topTrends": [{"keyword": "k"}], "source": "apify"}
        s = self._sniper(apify="tok")

        s.get_trends_for_industry("fitness")
        s.get_trends_for_industry("fitness")

        mock_apify.assert_called_once()


if __name__ == "__main__":
    unittest.main()
