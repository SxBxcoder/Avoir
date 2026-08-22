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
        self.apify_api_token = os.environ.get("APIFY_API_TOKEN")
        self.apify_actor = os.environ.get("APIFY_TIKTOK_ACTOR", "clockworks~tiktok-scraper")

    def get_trends_for_industry(self, industry: str) -> Dict[str, Any]:
        """
        Returns real-time IndustryTrends for any industry string.
        Cascade: SerpAPI → YouTube → Apify TikTok → Gemini → empty (no fake data).
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

        # Tier 3: Apify TikTok hashtag scrape
        if self.apify_api_token:
            try:
                result = self._fetch_apify_tiktok_trends(industry)
                if result.get("topTrends"):
                    _TREND_CACHE[cache_key] = (time.time(), result)
                    logger.info("Apify returned %d trends for '%s'", len(result["topTrends"]), industry)
                    return result
            except Exception as e:
                logger.warning("Apify failed for '%s': %s", industry, e)

        # Tier 4: Gemini AI
        result = self._generate_ai_trends(industry)
        if result.get("topTrends"):
            _TREND_CACHE[cache_key] = (time.time(), result)
            logger.info("Gemini generated %d trends for '%s'", len(result["topTrends"]), industry)
            return result

        # No keys configured — return empty, not fake data
        logger.warning(
            "No trend sources available for '%s'. Set SERPAPI_KEY, YOUTUBE_API_KEY, "
            "APIFY_API_TOKEN, or GEMINI_API_KEY.",
            industry,
        )
        return {
            "industry": industry,
            "topTrends": [],
            "viralHooks": [],
            "lastUpdated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "source": "none",
            "error": "No API keys configured. Set SERPAPI_KEY, YOUTUBE_API_KEY, APIFY_API_TOKEN, or GEMINI_API_KEY in backend/.env for real trend data.",
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
            "data_type": "RELATED_QUERIES",
            "api_key": self.serpapi_key,
        }

        resp = requests.get(url, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()

        top_trends = []
        related = data.get("related_queries", {})

        for item in related.get("rising", [])[:5]:
            value_str = str(item.get("value", "Breakout"))
            top_trends.append({
                "keyword": item.get("query", ""),
                "momentum": "rising",
                "searchVolume": value_str,
                "sentiment": "neutral",
                "context": f"Rising Google search in {industry}",
            })

        for item in related.get("top", [])[:3]:
            if len(top_trends) >= 6:
                break
            top_trends.append({
                "keyword": item.get("query", ""),
                "momentum": "peaking",
                "searchVolume": str(item.get("value", "0")),
                "sentiment": "neutral",
                "context": f"Top Google search related to {industry}",
            })

        viral_hooks = []
        for trend in top_trends[:3]:
            keyword = trend["keyword"]
            if keyword:
                viral_hooks.append(f"Why everyone is searching for '{keyword}'...")

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
                vol = f"{views / 1_000_000:.1f}M views"
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

    # ── Apify TikTok hashtag scrape ─────────────────────────────────────────

    # Actor run latency (scrape ~20 videos) — only reached when SerpAPI and
    # YouTube are absent or failed, so the slow path is acceptable.
    APIFY_TIMEOUT_SECONDS = 90
    APIFY_MAX_RESULTS = 20

    def _fetch_apify_tiktok_trends(self, industry: str) -> Dict[str, Any]:
        """
        Scrapes TikTok hashtag feeds via an Apify actor and maps the top
        videos into the shared trend shape.

        Uses the run-sync-get-dataset-items endpoint: one HTTP call that
        starts the actor, waits for it to finish, and returns dataset items.
        """
        # Apify requires '~' between username and actor name; sanitize in case
        # someone configured the actor with a '/' (which 404s on the API).
        actor_id = self.apify_actor.replace("/", "~")
        url = f"https://api.apify.com/v2/actors/{actor_id}/run-sync-get-dataset-items"
        params = {"token": self.apify_api_token}
        payload = {
            "hashtags": [self._industry_to_hashtag(industry)],
            "resultsPerPage": self.APIFY_MAX_RESULTS,
            "shouldDownloadCovers": False,
            "shouldDownloadSlideshowImages": False,
            "shouldDownloadSubtitles": False,
            "shouldDownloadVideos": False,
        }

        resp = requests.post(url, params=params, json=payload, timeout=self.APIFY_TIMEOUT_SECONDS)
        resp.raise_for_status()
        items = resp.json()
        if not isinstance(items, list):
            raise ValueError(f"Unexpected actor output type: {type(items).__name__}")

        videos = [v for v in items if isinstance(v, dict) and v.get("text")]
        videos.sort(key=lambda v: int(v.get("playCount") or 0), reverse=True)

        top_trends = []
        viral_hooks = []
        for video in videos[:6]:
            caption = str(video["text"]).strip().split("\n")[0][:120]
            plays = int(video.get("playCount") or 0)
            author = (video.get("authorMeta") or {}).get("name", "unknown")

            top_trends.append({
                "keyword": caption,
                "momentum": "peaking" if plays >= 1_000_000 else "rising",
                "searchVolume": self._format_plays(plays),
                "sentiment": "positive",
                "context": f"TikTok #{self._industry_to_hashtag(industry)} by @{author}",
            })
            if len(viral_hooks) < 3:
                viral_hooks.append(f"POV: {caption}...")

        return {
            "industry": industry,
            "topTrends": top_trends,
            "viralHooks": viral_hooks,
            "lastUpdated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "source": "apify",
        }

    @staticmethod
    def _industry_to_hashtag(industry: str) -> str:
        """'Home Fitness' → 'homefitness' (TikTok hashtags have no spaces)."""
        cleaned = "".join(ch for ch in industry.lower() if ch.isalnum())
        return cleaned or "trending"

    @staticmethod
    def _format_plays(plays: int) -> str:
        if plays >= 1_000_000:
            return f"{plays / 1_000_000:.1f}M plays"
        if plays >= 1_000:
            return f"{plays // 1_000}K plays"
        return f"{plays} plays"

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
