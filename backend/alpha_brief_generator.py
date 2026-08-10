"""
Avoir - Daily Alpha Brief Generator
Generates a daily trend anomaly + tactical campaign hook using Gemini,
then caches it in Upstash Redis (HTTP-based, serverless) for the whole day.

Architecture:
- Tier 1: Google Gemini 3 Flash Preview (Primary Key 1)
- Tier 2: Google Gemini 3 Flash Preview (Key 2 - Rotation)
- Tier 3: Trend Sniper (live trend data synthesized into a brief)
- Tier 4: Titanium Shield Mock Data (100% reliability)

Transport:
- Pure REST via Python standard library (urllib) - zero 3rd-party SDKs.
- Redis via the Upstash REST API (GET /get, POST /pipeline) so it works
  in Lambda without TCP dependencies. Falls back gracefully if unconfigured.

Cache contract (matches DailyAlphaBrief.tsx):
{
  "date": "YYYY-MM-DD",
  "trend": {"title": "...", "description": "...", "momentum": "spiking|rising|peaking|sustained"},
  "brief": {"plan": {"hook": "...", "offer": "...", "cta": "..."}, "captions": ["..."]},
  "generated_by": "gemini-3-flash-preview | trends_sniper | mock",
  "generated_at": "ISO-8601 UTC"
}

Usage:
    python alpha_brief_generator.py
    python alpha_brief_generator.py --force-refresh

Author: Team NEONX
Project: Avoir - AI-Native Agency + AI Hedge Fund
"""

import json
import os
import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from urllib.request import Request, urlopen
from urllib.parse import quote

# ============================================================================
# LOGGING
# ============================================================================

logger = logging.getLogger()
logging.basicConfig(level=logging.INFO, format='%(message)s')
logger.setLevel(logging.INFO)

# ============================================================================
# ENVIRONMENT / MODEL CONFIG
# ============================================================================

GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')
GEMINI_API_KEY_2 = os.environ.get('GEMINI_API_KEY_2', '')

# Upgraded Gemini model - same production model used by the Diamond Cascade
GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent"

CACHE_PREFIX = "alpha_brief:daily:"

VALID_MOMENTUM = ("spiking", "rising", "peaking", "sustained")

# ============================================================================
# SYSTEM PERSONA - THE ALPHA BRIEF ANALYST
# ============================================================================

ALPHA_BRIEF_PROMPT = """You are the Avoir Alpha Brief Analyst - an elite hedge-fund-grade trend hunter.

TONE: Aggressive, hyper-relevant, high-conviction. Think the best quant desk + the savviest growth marketer fused into one.
LANGUAGE: Global Viral English (modern, punchy, high-converting).

Your job: each day you identify ONE trend anomaly that most marketers have NOT yet capitalized on,
then build a precision campaign hook around it.

OUTPUT FORMAT: You MUST return valid JSON with this exact structure:
{
  "trend": {
    "title": "Short, punchy name of the trend anomaly (2-5 words)",
    "description": "Why it is exploding and what the opportunity is (English, 100-160 chars)",
    "momentum": "one of: spiking | rising | peaking | sustained"
  },
  "brief": {
    "plan": {
      "hook": "Attention-grabbing viral hook optimized for this trend (50-80 chars)",
      "offer": "Value proposition disguised as entertainment (80-120 chars)",
      "cta": "Clear action with urgency (30-50 chars)"
    },
    "captions": ["Caption 1 matching the trend vibe (150-200 chars)", "Caption 2 high-engagement angle", "Caption 3 alternative angle"]
  }
}

CRITICAL: The trend must feel like a genuine anomaly - specific, timely, and not generic.
Return ONLY valid JSON. No markdown fences."""

# ============================================================================
# TITANIUM SHIELD - CURATED MOCK BRIEFS (Daily rotation)
# ============================================================================

MOCK_BRIEFS: List[Dict[str, Any]] = [
    {
        "trend": {
            "title": "AI Micro-Agents",
            "description": "Explosive growth in single-purpose AI agents replacing complex SaaS.",
            "momentum": "peaking",
        },
        "brief": {
            "plan": {
                "hook": "The era of bloated SaaS is dead. Say hello to Micro-Agents.",
                "offer": "Deploy 5 highly-specialized AI agents for the cost of 1 generic tool.",
                "cta": "Start building your automated army today",
            },
            "captions": [
                "One tool, one job, zero bloat. Micro-agents are eating SaaS alive and early movers are printing.",
                "Your SaaS stack is overpaying for 80% of features you never open. The Micro-Agent era just began.",
                "5 specialists beat 1 bloated suite, every single time. This is the biggest workflow arbitrage of the year.",
            ],
        },
    },
    {
        "trend": {
            "title": "Creator-Led Commerce",
            "description": "Brands shifting spend from ads to revenue-sharing creator partnerships.",
            "momentum": "spiking",
        },
        "brief": {
            "plan": {
                "hook": "Ads are dead. Revenue-share with creators is the new funnel.",
                "offer": "Flip your ad budget into 100 creator deals that pay only on results.",
                "cta": "Claim your creator roster today",
            },
            "captions": [
                "The brands winning right now don't buy attention, they rent trust. Creator-led commerce is that shift.",
                "Pay for performance, not reach. Creator deals are the only funnel where your cost goes down as you scale.",
                "Your CPM is rising and your CTR is dying. The arbitrage is standing right there with 1M followers.",
            ],
        },
    },
    {
        "trend": {
            "title": "Anti-Corporate Aesthetic",
            "description": "Gen-Z prefers raw, unpolished brand content that feels human.",
            "momentum": "rising",
        },
        "brief": {
            "plan": {
                "hook": "Your brand is too polished. That's exactly why it's ignored.",
                "offer": "A 60-second raw, unpolished content system that feels human, not corporate.",
                "cta": "Go imperfect. Start today.",
            },
            "captions": [
                "Polished = invisible. Raw = relatable. The algorithm now rewards brands that stop performing.",
                "We ran the numbers: grainy phone footage is beating 4K studio ads by 3x CTR. Don't fight it.",
                "Perfection is the enemy of attention. Your next post should look shot on a phone and feel off-the-cuff.",
            ],
        },
    },
]


def get_mock_brief() -> Dict[str, Any]:
    """Rotate through curated mock briefs deterministically by day-of-year."""
    day_of_year = date.today().timetuple().tm_yday
    return json.loads(json.dumps(MOCK_BRIEFS[day_of_year % len(MOCK_BRIEFS)]))


# ============================================================================
# UPSTASH REDIS CACHE (HTTP REST - Serverless friendly, graceful fallback)
# ============================================================================

class RedisCache:
    """
    Minimal Upstash Redis client over its HTTP REST API.
    Uses zero third-party dependencies so it runs in Lambda cold starts.

    Degrades gracefully: if UPSTASH_REDIS_REST_URL / TOKEN are missing,
    get() returns None and set() is a no-op (mirrors the frontend cache.ts).
    """

    def __init__(self, url: Optional[str] = None, token: Optional[str] = None):
        self.base_url = (url or os.environ.get('UPSTASH_REDIS_REST_URL', '')).rstrip('/')
        self.token = token or os.environ.get('UPSTASH_REDIS_REST_TOKEN', '')
        self.enabled = bool(self.base_url and self.token)

    def get(self, key: str) -> Optional[Dict[str, Any]]:
        """Fetch a JSON object stored under key, or None on miss/error."""
        if not self.enabled:
            return None
        try:
            url = f"{self.base_url}/get/{quote(key, safe='')}"
            req = Request(url, headers={'Authorization': f'Bearer {self.token}'})
            with urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode('utf-8'))
            result = data.get('result')
            if result is None or result == 'null':
                return None
            return json.loads(result)
        except Exception as e:
            logger.warning(f"[Redis] GET failed for {key}: {e}")
            return None

    def set(self, key: str, value: Dict[str, Any], ttl_seconds: int) -> None:
        """Store a JSON object with an expiry. Best-effort; never raises."""
        if not self.enabled:
            return
        try:
            command = [["SET", key, json.dumps(value), "EX", ttl_seconds]]
            url = f"{self.base_url}/pipeline"
            req = Request(
                url,
                data=json.dumps(command).encode('utf-8'),
                headers={
                    'Authorization': f'Bearer {self.token}',
                    'Content-Type': 'application/json',
                },
                method='POST',
            )
            with urlopen(req, timeout=10) as resp:
                resp.read()
        except Exception as e:
            logger.warning(f"[Redis] SET failed for {key}: {e}")


def seconds_until_end_of_day() -> int:
    """Seconds remaining until local midnight (self-healing daily cache)."""
    now = datetime.now()
    end = datetime.combine(now.date() + timedelta(days=1), datetime.min.time())
    seconds = int((end - now).total_seconds())
    return seconds if seconds > 0 else 3600


# ============================================================================
# ALPHA BRIEF GENERATOR
# ============================================================================

class AlphaBriefGenerator:
    """Generates and caches the daily alpha brief with a resilience cascade."""

    def __init__(self, cache: Optional[RedisCache] = None):
        self.cache = cache if cache is not None else RedisCache()

    # ------------------------------------------------------------------
    # MAIN ENTRY POINT
    # ------------------------------------------------------------------

    def get_daily_brief(self, force_refresh: bool = False) -> Dict[str, Any]:
        """
        Return today's alpha brief, reading from Redis when possible.

        Args:
            force_refresh: bypass the cache and regenerate (used by the daily cron).

        Returns:
            Full brief dict matching the DailyAlphaBrief.tsx contract.
        """
        today = date.today().isoformat()
        cache_key = f"{CACHE_PREFIX}{today}"

        if not force_refresh:
            cached = self.cache.get(cache_key)
            if cached:
                logger.info(f"[AlphaBrief] CACHE HIT: {cache_key}")
                return cached

        logger.info(f"[AlphaBrief] CACHE MISS: generating fresh brief for {today}")
        brief = self._generate()
        brief['date'] = today
        brief['generated_at'] = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')

        self.cache.set(cache_key, brief, ttl_seconds=seconds_until_end_of_day())
        return brief

    # ------------------------------------------------------------------
    # RESILIENCE CASCADE
    # ------------------------------------------------------------------

    def _generate(self) -> Dict[str, Any]:
        """Try Gemini (2 keys) -> Trend Sniper -> Titanium Shield mock."""
        for attempt, api_key in enumerate(('GEMINI_API_KEY', 'GEMINI_API_KEY_2'), start=1):
            key_value = os.environ.get(api_key, '')
            if not key_value:
                continue
            try:
                brief = self._generate_with_gemini(key_value)
                if brief:
                    brief['generated_by'] = 'gemini-3-flash-preview'
                    logger.info(f"[AlphaBrief] TIER {attempt} SUCCESS: Gemini delivered")
                    return brief
            except Exception as e:
                logger.warning(f"[AlphaBrief] TIER {attempt} FAILED ({api_key}): {e}")

        try:
            brief = self._fallback_from_sniper()
            if brief:
                brief['generated_by'] = 'trends_sniper'
                logger.info("[AlphaBrief] TIER 3 SUCCESS: Trend Sniper delivered")
                return brief
        except Exception as e:
            logger.warning(f"[AlphaBrief] TIER 3 FAILED (Trend Sniper): {e}")

        logger.info("[AlphaBrief] TIER 4: TITANIUM SHIELD MOCK ACTIVATED")
        brief = get_mock_brief()
        brief['generated_by'] = 'mock'
        return brief

    # ------------------------------------------------------------------
    # TIER 1/2: GEMINI
    # ------------------------------------------------------------------

    def _generate_with_gemini(self, api_key: str) -> Optional[Dict[str, Any]]:
        """Call Gemini 3 Flash Preview via REST and parse the brief JSON."""
        payload = {
            "contents": [{"role": "user", "parts": [{"text": ALPHA_BRIEF_PROMPT}]}],
            "generationConfig": {
                "responseMimeType": "application/json",
                "temperature": 0.9,
                "maxOutputTokens": 1024,
            },
        }

        req = Request(
            GEMINI_ENDPOINT,
            data=json.dumps(payload).encode('utf-8'),
            headers={'Content-Type': 'application/json', 'x-goog-api-key': api_key},
            method='POST',
        )

        with urlopen(req, timeout=60) as resp:
            result = json.loads(resp.read().decode('utf-8'))

        candidates = result.get('candidates') or []
        if not candidates:
            raise Exception("Gemini returned no candidates")

        text = candidates[0]['content']['parts'][0]['text']
        data = json.loads(text)  # responseMimeType guarantees raw JSON

        return self._normalize_brief(data)

    # ------------------------------------------------------------------
    # TIER 3: TREND SNIPER FALLBACK (live trends, no paid call)
    # ------------------------------------------------------------------

    def _fallback_from_sniper(self) -> Optional[Dict[str, Any]]:
        """Synthesize a brief from live trend data when Gemini is unavailable."""
        try:
            from trends_sniper import sniper
            trends = sniper.get_current_trends()
        except Exception as e:
            logger.warning(f"[AlphaBrief] Trend Sniper fetch failed: {e}")
            return None

        if not trends:
            return None

        # Pick the highest-velocity anomaly
        top = max(trends, key=lambda t: int(t.get('virality_score') or 0))

        title = top.get('trend_name', 'Undefined trend')
        description = top.get('description', '')[:200]
        momentum = self._normalize_momentum(top.get('velocity'))
        suggested_hook = top.get('suggested_hook') or f"Nobody is talking about {title} yet."

        return {
            "trend": {
                "title": title,
                "description": description,
                "momentum": momentum,
            },
            "brief": {
                "plan": {
                    "hook": suggested_hook[:80],
                    "offer": f"Capitalize on the {title} wave before it peaks.",
                    "cta": "Ride this trend while it lasts",
                },
                "captions": [
                    f"The {title} wave is building and most brands haven't noticed. Be early.",
                    f"Velocity is up on {title}. Early movers are already printing attention.",
                    f"Trend anomaly detected: {title}. Position before the masses pile in.",
                ],
            },
        }

    # ------------------------------------------------------------------
    # VALIDATION / NORMALIZATION
    # ------------------------------------------------------------------

    def _normalize_brief(self, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Validate Gemini output against the contract and normalize momentum."""
        trend = data.get('trend') or {}
        plan = (data.get('brief') or {}).get('plan') or {}

        if not trend.get('title') or not trend.get('description'):
            raise Exception("Gemini brief missing trend title/description")
        if not plan.get('hook') or not plan.get('offer') or not plan.get('cta'):
            raise Exception("Gemini brief missing plan hook/offer/cta")

        return {
            "trend": {
                "title": str(trend['title']).strip(),
                "description": str(trend['description']).strip(),
                "momentum": self._normalize_momentum(trend.get('momentum')),
            },
            "brief": {
                "plan": {
                    "hook": str(plan['hook']).strip(),
                    "offer": str(plan['offer']).strip(),
                    "cta": str(plan['cta']).strip(),
                },
                "captions": [
                    str(c).strip() for c in (data.get('brief') or {}).get('captions', [])[:3]
                ],
            },
        }

    @staticmethod
    def _normalize_momentum(value: Any) -> str:
        """Map arbitrary momentum/velocity strings to the contract vocabulary."""
        if not value:
            return "rising"
        text = str(value).lower()
        if "peak" in text:
            return "peaking"
        if "spik" in text:
            return "spiking"
        if "break" in text:
            return "spiking"
        if "sustain" in text:
            return "sustained"
        if "ris" in text:
            return "rising"
        for valid in VALID_MOMENTUM:
            if valid in text:
                return valid
        return "rising"


# Module-level singleton (matches trends_sniper.sniper pattern)
alpha_brief_generator = AlphaBriefGenerator()


def generate_daily_brief(force_refresh: bool = False) -> Dict[str, Any]:
    """Module-level convenience wrapper."""
    return alpha_brief_generator.get_daily_brief(force_refresh=force_refresh)


# ============================================================================
# CLI
# ============================================================================

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Generate the Daily Alpha Brief")
    parser.add_argument("--force-refresh", action="store_true", help="Bypass Redis cache and regenerate")
    args = parser.parse_args()

    logger.info(f"Generating Daily Alpha Brief (force_refresh={args.force_refresh})...")
    brief = generate_daily_brief(force_refresh=args.force_refresh)
    print(json.dumps(brief, indent=2))
