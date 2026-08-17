import os
import logging
import requests
import time
import json
from typing import Dict, Any

logger = logging.getLogger("trend_sniper")

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

_TREND_CACHE: Dict[str, tuple] = {}
_CACHE_TTL_SECONDS = 300


class TrendSniper:
    def __init__(self):
        self.youtube_api_key = os.environ.get("YOUTUBE_API_KEY")
        self.serpapi_key = os.environ.get("SERPAPI_KEY")

    def get_trends_for_industry(self, industry: str) -> Dict[str, Any]:
        """
        Returns real-time IndustryTrends for any industry string.
        Cascade: SerpAPI → YouTube → Gemini → empty (no fake data).
        """
        cache_key = industry.lower().strip()

        if cache_key in _TREND_CACHE:
            cached_time, cached_data = _TREND_CACHE[cache_key]
            if time.time() - cached_time < _CACHE_TTL_SECONDS:
                logger.debug("Cache hit for '%s'", industry)
                return cached_data

        # Tier 1: SerpAPI Google Trends
        if self.serpapi_key:
            try:
                result = self._fetch_serpapi_trends(industry)
                if result.get("topTrends"):
                    _TREND_CACHE[cache_key] = (time.time(), result)
                    logger.info("SerpAPI returned %d trends for '%s'", len(result["topTrends"]), industry)
                    return result
            except Exception as e:
                logger.warning("SerpAPI failed for '%s': %s", industry, e)

        # Tier 2: YouTube Data API
        if self.youtube_api_key:
            try:
                result = self._fetch_youtube_trends(industry)
                if result.get("topTrends"):
                    _TREND_CACHE[cache_key] = (time.time(), result)
                    logger.info("YouTube returned %d trends for '%s'", len(result["topTrends"]), industry)
                    return result
            except Exception as e:
                logger.warning("YouTube failed for '%s': %s", industry, e)

        # Tier 3: Gemini AI
        result = self._generate_ai_trends(industry)
        if result.get("topTrends"):
            _TREND_CACHE[cache_key] = (time.time(), result)
            logger.info("Gemini generated %d trends for '%s'", len(result["topTrends"]), industry)
            return result

        # No keys configured — return empty, not fake data
        logger.warning("No trend sources available for '%s'. Set SERPAPI_KEY, YOUTUBE_API_KEY, or GEMINI_API_KEY.", industry)
        return {
            "industry": industry,
            "topTrends": [],
            "viralHooks": [],
            "lastUpdated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "source": "none",
            "error": "No API keys configured. Set SERPAPI_KEY in backend/.env for real trend data.",
        }

    def get_current_trends(self) -> list:
        """Backward-compat wrapper for legacy callers."""
        result = self.get_trends_for_industry("general")
        return result.get("topTrends", [])

    # ── SerpAPI Google Trends ───────────────────────────────────────────────

    def _fetch_serpapi_trends(self, industry: str) -> Dict[str, Any]:
        url = "https://serpapi.com/search"
        params = {
            "engine": "google_trends",
            "q": industry,
            "geo": "US",
            "hl": "en",
            "api_key": self.serpapi_key,
        }

        resp = requests.get(url, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()

        top_trends = []
        for item in data.get("rising_queries", [])[:5]:
            value = item.get("value", 0)
            top_trends.append({
                "keyword": item.get("query", ""),
                "momentum": "rising" if value >= 5000 else "peaking",
                "searchVolume": f"+{value:,}%",
                "sentiment": "neutral",
                "context": f"Rising Google search in {industry}",
            })

        for item in data.get("top_queries", [])[:3]:
            if len(top_trends) >= 6:
                break
            top_trends.append({
                "keyword": item.get("query", ""),
                "momentum": "peaking",
                "searchVolume": f"{item.get('value', 0):,}",
                "sentiment": "neutral",
                "context": f"Top Google search related to {industry}",
            })

        viral_hooks = []
        for item in data.get("related_topics", [])[:3]:
            title = item.get("title", "")
            if title:
                viral_hooks.append(f"Why everyone is searching for '{title}'...")

        return {
            "industry": industry,
            "topTrends": top_trends,
            "viralHooks": viral_hooks,
            "lastUpdated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "source": "serpapi",
        }

    # ── YouTube Data API v3 ─────────────────────────────────────────────────

    def _fetch_youtube_trends(self, industry: str) -> Dict[str, Any]:
        url = "https://youtube.googleapis.com/youtube/v3/videos"
        params = {
            "part": "snippet,statistics",
            "chart": "mostPopular",
            "regionCode": "US",
            "maxResults": 5,
            "key": self.youtube_api_key,
        }

        resp = requests.get(url, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()

        top_trends = []
        viral_hooks = []

        for item in data.get("items", []):
            title = item["snippet"]["title"]
            desc = item["snippet"]["description"][:200]
            views = int(item["statistics"].get("viewCount", 0))

            if views >= 10_000_000:
                vol = f"{views // 1_000_000}M views"
            elif views >= 1_000_000:
                vol = f"{views // 1_000_000}M views"
            else:
                vol = f"{views // 1_000}K views"

            top_trends.append({
                "keyword": title,
                "momentum": "peaking" if views >= 10_000_000 else "rising",
                "searchVolume": vol,
                "sentiment": "positive",
                "context": desc if len(desc) > 50 else title,
            })
            viral_hooks.append(f"Secret to {title}...")

        return {
            "industry": industry,
            "topTrends": top_trends,
            "viralHooks": viral_hooks[:3],
            "lastUpdated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "source": "youtube",
        }

    # ── Gemini AI ───────────────────────────────────────────────────────────

    def _generate_ai_trends(self, industry: str) -> Dict[str, Any]:
        if not GEMINI_API_KEY:
            return {}

        url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent"
        system_prompt = (
            f"You are a Social Media Trend Analyst for the {industry} industry.\n"
            "Return valid JSON only:\n"
            '{"topTrends":[{"keyword":"...","momentum":"rising|peaking|falling",'
            '"searchVolume":"...","sentiment":"positive|neutral|mixed","context":"..."}],'
            '"viralHooks":["...","...","..."]}\n'
            "Return exactly 4 topTrends and 3 viralHooks."
        )

        try:
            payload = {
                "contents": [{"parts": [{"text": f"Current {industry} industry trends."}]}],
                "systemInstruction": {"parts": [{"text": system_prompt}]},
                "generationConfig": {"temperature": 0.9, "responseMimeType": "application/json"},
            }
            resp = requests.post(
                url, json=payload,
                headers={"x-goog-api-key": GEMINI_API_KEY},
                timeout=20,
            )
            resp.raise_for_status()
            raw = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
            parsed = json.loads(raw)

            return {
                "industry": industry,
                "topTrends": parsed.get("topTrends", []),
                "viralHooks": parsed.get("viralHooks", []),
                "lastUpdated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "source": "gemini",
            }
        except Exception as e:
            logger.warning("Gemini failed for '%s': %s", industry, e)
            return {}


sniper = TrendSniper()
