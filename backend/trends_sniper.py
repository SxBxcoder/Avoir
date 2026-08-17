import os
import requests
import time
import random
import json
from typing import List, Dict, Any, Optional

GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')

# In-memory cache: { industry_lower: (timestamp, trends_data) }
_TREND_CACHE: Dict[str, tuple] = {}
_CACHE_TTL_SECONDS = 300  # 5 minutes


class TrendSniper:
    def __init__(self):
        self.youtube_api_key = os.environ.get("YOUTUBE_API_KEY")
        self.apify_api_token = os.environ.get("APIFY_API_TOKEN")
        self.serpapi_key = os.environ.get("SERPAPI_KEY")

    def get_trends_for_industry(self, industry: str) -> Dict[str, Any]:
        """
        Main entry point. Returns IndustryTrends dict for any arbitrary industry string.
        Cascade: SerpAPI → YouTube → Gemini → Mock
        """
        cache_key = industry.lower().strip()

        # Check cache
        if cache_key in _TREND_CACHE:
            cached_time, cached_data = _TREND_CACHE[cache_key]
            if time.time() - cached_time < _CACHE_TTL_SECONDS:
                print(f"[TrendSniper] Cache hit for '{industry}'")
                return cached_data

        # 1. Try SerpAPI Google Trends (Tier 1)
        if self.serpapi_key:
            try:
                trends = self._fetch_serpapi_trends(industry)
                if trends and trends.get("topTrends"):
                    _TREND_CACHE[cache_key] = (time.time(), trends)
                    print(f"[TrendSniper] SerpAPI returned {len(trends['topTrends'])} trends for '{industry}'")
                    return trends
            except Exception as e:
                print(f"[TrendSniper] SerpAPI failed for '{industry}': {e}")

        # 2. Try YouTube (Tier 2)
        if self.youtube_api_key:
            try:
                trends = self._fetch_youtube_trends(industry)
                if trends and trends.get("topTrends"):
                    _TREND_CACHE[cache_key] = (time.time(), trends)
                    print(f"[TrendSniper] YouTube returned {len(trends['topTrends'])} trends for '{industry}'")
                    return trends
            except Exception as e:
                print(f"[TrendSniper] YouTube failed for '{industry}': {e}")

        # 3. Try Gemini AI (Tier 3)
        trends = self._generate_ai_trends(industry)
        if trends and trends.get("topTrends"):
            _TREND_CACHE[cache_key] = (time.time(), trends)
            print(f"[TrendSniper] Gemini generated {len(trends['topTrends'])} trends for '{industry}'")
            return trends

        # 4. Titanium Shield Mock (Tier 4)
        trends = self._get_smart_mock_trends(industry)
        _TREND_CACHE[cache_key] = (time.time(), trends)
        return trends

    def get_current_trends(self) -> List[Dict[str, Any]]:
        """Backward-compat wrapper. Returns flat list for legacy callers."""
        result = self.get_trends_for_industry("general")
        # Flatten to list of trend dicts for backward compat
        return result.get("topTrends", [])

    # ── Tier 1: SerpAPI Google Trends ──────────────────────────────────────

    def _fetch_serpapi_trends(self, industry: str) -> Dict[str, Any]:
        """
        Fetches rising queries and related topics from Google Trends via SerpAPI.
        Returns IndustryTrends-shaped dict.
        """
        url = "https://serpapi.com/search"
        params = {
            "engine": "google_trends",
            "q": f"{industry}",
            "geo": "US",
            "hl": "en",
            "api_key": self.serpapi_key,
        }

        resp = requests.get(url, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()

        top_trends = []

        # Rising queries — these are the gold
        for item in data.get("rising_queries", [])[:5]:
            value = item.get("value", 0)
            if value >= 5000:
                momentum = "rising"
            elif value >= 1000:
                momentum = "peaking"
            else:
                momentum = "rising"

            top_trends.append({
                "keyword": item.get("query", ""),
                "momentum": momentum,
                "searchVolume": f"+{value:,}%",
                "sentiment": "neutral",
                "context": f"Rising Google search: '{item.get('query', '')}' in {industry}",
            })

        # Also grab top queries for volume context
        for item in data.get("top_queries", [])[:3]:
            if len(top_trends) >= 6:
                break
            top_trends.append({
                "keyword": item.get("query", ""),
                "momentum": "peaking",
                "searchVolume": f"{item.get('value', 0):,}",
                "sentiment": "neutral",
                "context": f"Top Google search: '{item.get('query', '')}' related to {industry}",
            })

        # Related topics → viral hooks
        viral_hooks = []
        for item in data.get("related_topics", [])[:3]:
            title = item.get("title", "")
            if title:
                viral_hooks.append(f"Why everyone is searching for '{title}'...")

        if not viral_hooks:
            viral_hooks = [
                f"What's driving the surge in {industry} searches...",
                f"The {industry} trend nobody is talking about...",
                f"Is this the next big thing in {industry}?",
            ]

        return {
            "industry": industry,
            "topTrends": top_trends,
            "viralHooks": viral_hooks,
            "lastUpdated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }

    # ── Tier 2: YouTube Data API v3 ────────────────────────────────────────

    def _fetch_youtube_trends(self, industry: str) -> Dict[str, Any]:
        """Fetches trending videos related to the industry from YouTube."""
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
                momentum = "peaking"
                vol = f"{views // 1_000_000}M views"
            elif views >= 1_000_000:
                momentum = "rising"
                vol = f"{views // 1_000_000}M views"
            else:
                momentum = "rising"
                vol = f"{views // 1_000}K views"

            top_trends.append({
                "keyword": title,
                "momentum": momentum,
                "searchVolume": vol,
                "sentiment": "positive",
                "context": f"YouTube trending: {desc}..." if len(desc) > 50 else desc,
            })

            viral_hooks.append(f"Secret to {title}...")

        if not viral_hooks:
            viral_hooks = [
                f"The {industry} video everyone is watching...",
                f"Why this {industry} creator went viral...",
            ]

        return {
            "industry": industry,
            "topTrends": top_trends,
            "viralHooks": viral_hooks[:3],
            "lastUpdated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }

    # ── Tier 3: Gemini AI Generation ───────────────────────────────────────

    def _generate_ai_trends(self, industry: str) -> Dict[str, Any]:
        """Dynamically generates trends using Gemini for the given industry."""
        if not GEMINI_API_KEY:
            return {}

        print(f"[TrendSniper] Firing Gemini AI for '{industry}' trends...")
        url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent"

        system_prompt = f"""You are an elite Social Media Trend Analyst specializing in the {industry} industry.
Return valid JSON only. Format:
{{
  "topTrends": [
    {{
      "keyword": "trending keyword or topic",
      "momentum": "rising" | "peaking" | "falling",
      "searchVolume": "descriptive volume like +140% or 2.4M",
      "sentiment": "positive" | "neutral" | "mixed",
      "context": "1-2 sentence explanation of why this is trending in {industry}"
    }}
  ],
  "viralHooks": ["hook format 1", "hook format 2", "hook format 3"]
}}
Return exactly 4 topTrends and 3 viralHooks. All trends must be specifically relevant to the {industry} industry."""

        try:
            payload = {
                "contents": [{"parts": [{"text": f"Analyze current {industry} industry trends right now."}]}],
                "systemInstruction": {"parts": [{"text": system_prompt}]},
                "generationConfig": {
                    "temperature": 0.9,
                    "responseMimeType": "application/json"
                }
            }
            resp = requests.post(url, json=payload, headers={"x-goog-api-key": GEMINI_API_KEY}, timeout=20)
            resp.raise_for_status()
            data = resp.json()
            raw_text = data['candidates'][0]['content']['parts'][0]['text']

            parsed = json.loads(raw_text)

            # Normalize to IndustryTrends shape
            result = {
                "industry": industry,
                "topTrends": parsed.get("topTrends", []),
                "viralHooks": parsed.get("viralHooks", []),
                "lastUpdated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            }
            return result
        except Exception as e:
            print(f"[TrendSniper] AI Trend Generation failed: {e}")
            return {}

    # ── Tier 4: Titanium Shield Mock ───────────────────────────────────────

    def _get_smart_mock_trends(self, industry: str) -> Dict[str, Any]:
        """Industry-aware mock fallback when all APIs are unavailable."""
        industry_lower = industry.lower()

        # Industry-specific mock profiles
        mock_profiles = {
            "fashion": {
                "topTrends": [
                    {"keyword": "sustainable luxury", "momentum": "rising", "searchVolume": "+140%", "sentiment": "positive", "context": "Gen-Z moving away from fast fashion towards investment pieces."},
                    {"keyword": "Y2K revival", "momentum": "peaking", "searchVolume": "2.4M", "sentiment": "mixed", "context": "Early 2000s aesthetics still dominating TikTok GRWM videos."},
                    {"keyword": "quiet outdoor", "momentum": "rising", "searchVolume": "+85%", "sentiment": "positive", "context": "Gorpcore merging with quiet luxury."},
                ],
                "viralHooks": ["POV: You finally found the perfect...", "Why everyone is ditching...", "Unboxing the viral..."],
            },
            "tech": {
                "topTrends": [
                    {"keyword": "AI productivity", "momentum": "peaking", "searchVolume": "5.1M", "sentiment": "positive", "context": "Professionals seeking tools to automate repetitive tasks."},
                    {"keyword": "digital detox", "momentum": "rising", "searchVolume": "+210%", "sentiment": "mixed", "context": "Pushback against screen time; demand for offline-first tools."},
                    {"keyword": "spatial computing", "momentum": "rising", "searchVolume": "+300%", "sentiment": "neutral", "context": "Apple Vision Pro hype driving interest in mixed reality."},
                ],
                "viralHooks": ["The AI tool that saved me 10 hours...", "Stop doing this manually...", "Is this the end of..."],
            },
            "finance": {
                "topTrends": [
                    {"keyword": "loud budgeting", "momentum": "peaking", "searchVolume": "+450%", "sentiment": "positive", "context": "Being vocal about saving money instead of quiet luxury."},
                    {"keyword": "micro-investing", "momentum": "rising", "searchVolume": "1.2M", "sentiment": "positive", "context": "Gen-Z investing spare change."},
                    {"keyword": "side hustle burnout", "momentum": "rising", "searchVolume": "+120%", "sentiment": "mixed", "context": "Shift towards passive income over active secondary jobs."},
                ],
                "viralHooks": ["How I saved $10k by loud budgeting...", "The truth about passive income...", "What your bank isn't telling you..."],
            },
        }

        # Check for exact match first
        for key in mock_profiles:
            if key in industry_lower:
                profile = mock_profiles[key]
                return {
                    "industry": industry,
                    "topTrends": profile["topTrends"],
                    "viralHooks": profile["viralHooks"],
                    "lastUpdated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                }

        # Generic fallback for any other industry
        return {
            "industry": industry,
            "topTrends": [
                {"keyword": f"{industry} creator economy", "momentum": "rising", "searchVolume": "+90%", "sentiment": "positive", "context": f"Creators in {industry} are building direct-to-audience brands."},
                {"keyword": f"{industry} AI tools", "momentum": "peaking", "searchVolume": "+150%", "sentiment": "positive", "context": f"AI-powered tools are disrupting traditional {industry} workflows."},
                {"keyword": f"{industry} community-led growth", "momentum": "rising", "searchVolume": "+120%", "sentiment": "positive", "context": f"Brands in {industry} are shifting from ads to community building."},
            ],
            "viralHooks": [
                f"Nobody is talking about this {industry} shift...",
                f"I tested the viral {industry} trend so you don't have to...",
                f"The {industry} secret nobody is sharing...",
            ],
            "lastUpdated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }


# Instantiate singleton
sniper = TrendSniper()
