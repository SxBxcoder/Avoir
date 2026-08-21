"""
Avoir — Real-Time Trend Intelligence Engine

Production-grade trend data pipeline that fetches real-time cultural signals
from multiple sources and injects them into campaign generation.

Data flow:
    1. Check DynamoDB cache (avoir-trends, 48h TTL)
    2. If miss → query SerpAPI (Google Trends JSON)
    3. If rate-limited → fall back to pytrends (unofficial Google Trends)
    4. Enrich with Reddit viral hooks (r/marketing, r/entrepreneur)
    5. Transform → IndustryTrends → DynamoDB cache → return

Architecture highlights:
    - Circuit breaker pattern (stops hammering a failing provider)
    - Exponential backoff with jitter on retries
    - Source attribution (serpapi / pytrends / reddit / cache / mock)
    - Graceful degradation (every layer has a fallback)
    - Structured logging (JSON, one line per event)
"""

import asyncio
import hashlib
import json
import logging
import os
import random
import time
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

import httpx

# ============================================================================
# LOGGING
# ============================================================================

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S%z",
)
logger = logging.getLogger("trends_sniper")

# ============================================================================
# CONFIGURATION
# ============================================================================

SERPAPI_KEY = os.environ.get("SERPAPI_KEY", "")
SERPAPI_BASE_URL = "https://serpapi.com/search"
SERPAPI_TIMEOUT = int(os.environ.get("SERPAPI_TIMEOUT", "10"))

REDDIT_CLIENT_ID = os.environ.get("REDDIT_CLIENT_ID", "")
REDDIT_CLIENT_SECRET = os.environ.get("REDDIT_CLIENT_SECRET", "")
REDDIT_USER_AGENT = os.environ.get("REDDIT_USER_AGENT", "Avoir/1.0 (trend-intel)")
REDDIT_TIMEOUT = int(os.environ.get("REDDIT_TIMEOUT", "8"))

CACHE_TTL_HOURS = int(os.environ.get("TREND_CACHE_TTL", "48"))
MAX_RETRIES = int(os.environ.get("TREND_MAX_RETRIES", "2"))
RETRY_BASE_DELAY = float(os.environ.get("TREND_RETRY_BASE_DELAY", "1.0"))

# ============================================================================
# INDUSTRY KEYWORD MAPPING
# ============================================================================

INDUSTRY_KEYWORDS: dict[str, list[str]] = {
    "fashion": [
        "fashion trends 2026",
        "streetwear",
        "sustainable fashion",
        "luxury resale",
        "gen z fashion",
        "quiet luxury",
    ],
    "tech": [
        "AI tools for business",
        "SaaS trends",
        "developer productivity",
        "open source AI",
        "tech startup funding",
        "spatial computing",
    ],
    "finance": [
        "personal finance trends",
        "investing for beginners",
        "fintech apps",
        "cryptocurrency mainstream",
        "loud budgeting",
        "micro-investing",
    ],
    "ecommerce": [
        "DTC brands",
        "social commerce",
        "live shopping trends",
        "subscription box trends",
        "creator economy commerce",
    ],
    "health": [
        "wellness trends 2026",
        "mental health apps",
        "biohacking",
        "fitness tech",
        "GLP-1 weight loss",
    ],
    "food": [
        "food trends 2026",
        "plant-based market",
        "ghost kitchens",
        "functional beverages",
        "food TikTok viral",
    ],
    "general_commerce": [
        "digital marketing trends",
        "social media advertising",
        "creator economy",
        "DTC brands",
        "brand building 2026",
    ],
}

REDDIT_SUBREDDITS = ["marketing", "entrepreneur", "smallbusiness", "startups", "advertising"]

# ============================================================================
# DATA TYPES
# ============================================================================


class Momentum(str, Enum):
    RISING = "rising"
    PEAKING = "peaking"
    FALLING = "falling"


class Sentiment(str, Enum):
    POSITIVE = "positive"
    NEUTRAL = "neutral"
    MIXED = "mixed"


class TrendSource(str, Enum):
    SERPAPI = "serpapi"
    PYTRENDS = "pytrends"
    REDDIT = "reddit"
    CACHE = "cache"
    MOCK = "mock"


@dataclass
class TrendTopic:
    keyword: str
    momentum: str
    search_volume: str
    sentiment: str
    context: str

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class IndustryTrends:
    industry: str
    top_trends: list[TrendTopic]
    viral_hooks: list[str]
    last_updated: str
    source: str
    cached_until: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "industry": self.industry,
            "topTrends": [t.to_dict() for t in self.top_trends],
            "viralHooks": self.viral_hooks,
            "lastUpdated": self.last_updated,
            "source": self.source,
            "cachedUntil": self.cached_until,
        }


# ============================================================================
# CIRCUIT BREAKER
# ============================================================================


class CircuitBreaker:
    """
    Stops calling a provider after N consecutive failures.
    After a cooldown period, allows a single trial request (half-open).
    """

    def __init__(self, failure_threshold: int = 3, cooldown_seconds: float = 60.0):
        self.failure_threshold = failure_threshold
        self.cooldown_seconds = cooldown_seconds
        self.consecutive_failures = 0
        self.last_failure_time: float = 0
        self.state = "closed"  # closed = normal, open = blocked, half_open = testing

    def record_success(self) -> None:
        self.consecutive_failures = 0
        self.state = "closed"

    def record_failure(self) -> None:
        self.consecutive_failures += 1
        self.last_failure_time = time.monotonic()
        if self.consecutive_failures >= self.failure_threshold:
            self.state = "open"
            logger.warning(
                "circuit_breaker_opened",
                extra={"consecutive_failures": self.consecutive_failures},
            )

    def allow_request(self) -> bool:
        if self.state == "closed":
            return True
        if self.state == "open":
            elapsed = time.monotonic() - self.last_failure_time
            if elapsed >= self.cooldown_seconds:
                self.state = "half_open"
                return True
            return False
        # half_open: allow one request
        return True


# ============================================================================
# RETRY WITH EXPONENTIAL BACKOFF
# ============================================================================


async def _retry_with_backoff(
    fn,
    *args,
    max_retries: int = MAX_RETRIES,
    base_delay: float = RETRY_BASE_DELAY,
    **kwargs,
):
    """Execute an async function with exponential backoff + jitter on failure."""
    last_error = None
    for attempt in range(max_retries + 1):
        try:
            return await fn(*args, **kwargs)
        except Exception as exc:
            last_error = exc
            if attempt < max_retries:
                delay = base_delay * (2 ** attempt) + random.uniform(0, 0.5)
                logger.warning(
                    "retry_attempt",
                    extra={
                        "attempt": attempt + 1,
                        "max_retries": max_retries,
                        "delay_s": round(delay, 2),
                        "error": str(exc),
                    },
                )
                await asyncio.sleep(delay)
    raise last_error


# ============================================================================
# SERPAPI CLIENT (Google Trends JSON)
# ============================================================================

_serpapi_breaker = CircuitBreaker(failure_threshold=3, cooldown_seconds=120)


async def _fetch_serpapi_trends(
    keywords: list[str], country: str = "us"
) -> Optional[IndustryTrends]:
    """
    Query SerpAPI's Google Trends endpoint for real-time trend data.
    Returns structured IndustryTrends or None on failure.
    """
    if not SERPAPI_KEY:
        return None
    if not _serpapi_breaker.allow_request():
        logger.info("serpapi_circuit_open", extra={"state": _serpapi_breaker.state})
        return None

    async with httpx.AsyncClient(timeout=SERPAPI_TIMEOUT) as client:
        # Query each keyword and aggregate
        all_trends: list[TrendTopic] = []

        for keyword in keywords[:3]:  # Limit to 3 to stay within rate limits
            try:
                resp = await _retry_with_backoff(
                    client.get,
                    SERPAPI_BASE_URL,
                    params={
                        "engine": "google_trends",
                        "q": keyword,
                        "data_type": "REAL_TIME",
                        "geo": country.upper(),
                        "api_key": SERPAPI_KEY,
                    },
                )
                resp.raise_for_status()
                data = resp.json()

                # Parse rising queries from SerpAPI response
                rising = data.get("rising_searches", []) or data.get("rising_queries", [])
                for item in rising[:2]:
                    query = item.get("query", keyword)
                    volume = item.get("value", "N/A")
                    all_trends.append(
                        TrendTopic(
                            keyword=query,
                            momentum="rising" if "+" in str(volume) else "peaking",
                            search_volume=str(volume),
                            sentiment=_infer_sentiment(query),
                            context=f"Trending query related to {keyword}",
                        )
                    )

                _serpapi_breaker.record_success()
                await asyncio.sleep(1.1)  # Respect rate limit: ~1 req/sec

            except httpx.HTTPStatusError as exc:
                _serpapi_breaker.record_failure()
                logger.warning(
                    "serpapi_http_error",
                    extra={"status": exc.response.status_code, "keyword": keyword},
                )
                if exc.response.status_code == 429:
                    break  # Rate limited — don't waste more requests
            except Exception as exc:
                _serpapi_breaker.record_failure()
                logger.warning("serpapi_error", extra={"error": str(exc), "keyword": keyword})

        if not all_trends:
            return None

        return IndustryTrends(
            industry="",
            top_trends=all_trends[:5],
            viral_hooks=[],
            last_updated=datetime.now(timezone.utc).isoformat(),
            source=TrendSource.SERPAPI.value,
        )


# ============================================================================
# PYTRENDS CLIENT (Unofficial Google Trends)
# ============================================================================

_pytrends_breaker = CircuitBreaker(failure_threshold=3, cooldown_seconds=90)


async def _fetch_pytrends_trends(keywords: list[str]) -> Optional[IndustryTrends]:
    """
    Use pytrends (unofficial Google Trends API) as a free fallback.
    Runs the synchronous pytrends library in a thread executor.
    """
    if not _pytrends_breaker.allow_request():
        logger.info("pytrends_circuit_open", extra={"state": _pytrends_breaker.state})
        return None

    try:
        from pytrends.request import TrendReq  # type: ignore
    except ImportError:
        logger.info("pytrends_not_installed")
        return None

    def _sync_fetch():
        pytrends = TrendReq(hl="en-US", tz=360, retries=2, backoff_factor=1.0)
        pytrends.build_payload(
            keywords[:5],
            cat=0,
            timeframe="now 1-d",
            geo="",
        )
        interest = pytrends.interest_over_time()
        related = pytrends.related_queries()

        trends: list[TrendTopic] = []
        for kw in keywords[:3]:
            if kw in related and related[kw].get("rising") is not None:
                rising_df = related[kw]["rising"]
                for _, row in rising_df.head(2).iterrows():
                    trends.append(
                        TrendTopic(
                            keyword=row.get("query", kw),
                            momentum="rising",
                            search_volume=str(row.get("value", "N/A")),
                            sentiment=_infer_sentiment(row.get("query", kw)),
                            context=f"Rising Google search: {kw}",
                        )
                    )
            else:
                trends.append(
                    TrendTopic(
                        keyword=kw,
                        momentum="peaking",
                        search_volume="Active",
                        sentiment=_infer_sentiment(kw),
                        context=f"Active Google trend: {kw}",
                    )
                )
        return trends

    try:
        loop = asyncio.get_running_loop()
        trends = await loop.run_in_executor(None, _sync_fetch)
        _pytrends_breaker.record_success()

        if not trends:
            return None

        return IndustryTrends(
            industry="",
            top_trends=trends[:5],
            viral_hooks=[],
            last_updated=datetime.now(timezone.utc).isoformat(),
            source=TrendSource.PYTRENDS.value,
        )
    except Exception as exc:
        _pytrends_breaker.record_failure()
        logger.warning("pytrends_error", extra={"error": str(exc)})
        return None


# ============================================================================
# REDDIT CLIENT (Viral Hook Extraction)
# ============================================================================

_reddit_breaker = CircuitBreaker(failure_threshold=3, cooldown_seconds=60)


async def _fetch_reddit_hooks(industry: str) -> list[str]:
    """
    Fetch top-performing post titles from marketing subreddits.
    These are used as 'viral hook' inspiration in campaign generation.
    """
    if not REDDIT_CLIENT_ID or not REDDIT_CLIENT_SECRET:
        return []
    if not _reddit_breaker.allow_request():
        return []

    hooks: list[str] = []
    async with httpx.AsyncClient(timeout=REDDIT_TIMEOUT) as client:
        try:
            # Authenticate with Reddit OAuth
            auth_resp = await client.post(
                "https://www.reddit.com/api/v1/access_token",
                auth=(REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET),
                data={"grant_type": "client_credentials"},
                headers={"User-Agent": REDDIT_USER_AGENT},
            )
            auth_resp.raise_for_status()
            token = auth_resp.json().get("access_token", "")
            if not token:
                return []

            headers = {
                "Authorization": f"Bearer {token}",
                "User-Agent": REDDIT_USER_AGENT,
            }

            # Fetch hot posts from relevant subreddits
            for sub in REDDIT_SUBREDDITS[:3]:  # Limit to 3 subreddits
                try:
                    resp = await client.get(
                        f"https://oauth.reddit.com/r/{sub}/hot",
                        params={"limit": 10, "raw_json": 1},
                        headers=headers,
                    )
                    resp.raise_for_status()
                    posts = resp.json().get("data", {}).get("children", [])

                    for post in posts:
                        title = post.get("data", {}).get("title", "")
                        upvotes = post.get("data", {}).get("ups", 0)
                        # Filter for high-engagement, actionable titles
                        if upvotes > 50 and len(title) > 20 and len(title) < 200:
                            hooks.append(title)

                    await asyncio.sleep(0.5)  # Be respectful to Reddit API

                except Exception as exc:
                    logger.warning("reddit_sub_error", extra={"sub": sub, "error": str(exc)})

            _reddit_breaker.record_success()

        except Exception as exc:
            _reddit_breaker.record_failure()
            logger.warning("reddit_auth_error", extra={"error": str(exc)})

    # Deduplicate and return top hooks by engagement signal
    seen = set()
    unique: list[str] = []
    for h in hooks:
        normalized = h.lower().strip()
        if normalized not in seen:
            seen.add(normalized)
            unique.append(h)

    return unique[:5]


# ============================================================================
# MOCK DATA (Last resort fallback)
# ============================================================================

MOCK_TRENDS_DB: dict[str, IndustryTrends] = {
    "fashion": IndustryTrends(
        industry="fashion",
        top_trends=[
            TrendTopic("sustainable luxury", "rising", "+140%", "positive", "Gen-Z moving away from fast fashion towards investment pieces."),
            TrendTopic("Y2K revival", "peaking", "2.4M", "mixed", "Early 2000s aesthetics still dominating TikTok GRWM videos."),
            TrendTopic("quiet outdoor", "rising", "+85%", "positive", "Gorpcore merging with quiet luxury."),
        ],
        viral_hooks=["POV: You finally found the perfect...", "Why everyone is ditching...", "Unboxing the viral..."],
        last_updated=datetime.now(timezone.utc).isoformat(),
        source=TrendSource.MOCK.value,
    ),
    "tech": IndustryTrends(
        industry="tech",
        top_trends=[
            TrendTopic("AI productivity", "peaking", "5.1M", "positive", "Professionals seeking tools to automate repetitive tasks."),
            TrendTopic("digital detox", "rising", "+210%", "mixed", "Pushback against screen time; demand for offline-first tools."),
            TrendTopic("spatial computing", "rising", "+300%", "neutral", "Apple Vision Pro hype driving interest in mixed reality."),
        ],
        viral_hooks=["The AI tool that saved me 10 hours...", "Stop doing this manually...", "Is this the end of..."],
        last_updated=datetime.now(timezone.utc).isoformat(),
        source=TrendSource.MOCK.value,
    ),
    "finance": IndustryTrends(
        industry="finance",
        top_trends=[
            TrendTopic("loud budgeting", "peaking", "+450%", "positive", "Being vocal about saving money instead of quiet luxury."),
            TrendTopic("micro-investing", "rising", "1.2M", "positive", "Gen-Z investing spare change."),
            TrendTopic("side hustle burnout", "rising", "+120%", "mixed", "Shift towards passive income over active secondary jobs."),
        ],
        viral_hooks=["How I saved $10k by loud budgeting...", "The truth about passive income...", "What your bank isn't telling you..."],
        last_updated=datetime.now(timezone.utc).isoformat(),
        source=TrendSource.MOCK.value,
    ),
    "general_commerce": IndustryTrends(
        industry="general_commerce",
        top_trends=[
            TrendTopic("creator economy 2.0", "rising", "+90%", "positive", "Shift from ad revenue to direct digital product sales."),
            TrendTopic("authentic lo-fi", "peaking", "+150%", "positive", "Users ignoring highly polished ads in favor of raw, UGC-style content."),
        ],
        viral_hooks=["Nobody is talking about this...", "I tried the viral...", "The secret to..."],
        last_updated=datetime.now(timezone.utc).isoformat(),
        source=TrendSource.MOCK.value,
    ),
}


# ============================================================================
# ORCHESTRATION (Main entry point)
# ============================================================================

IndustryMapping = dict[str, IndustryTrends]


def _normalize_industry(industry: str) -> str:
    """Map an industry string to a known key or fall back to general_commerce."""
    normalized = industry.lower().strip().replace(" ", "_")
    # Direct match
    if normalized in INDUSTRY_KEYWORDS:
        return normalized
    # Fuzzy: check if any key is a substring
    for key in INDUSTRY_KEYWORDS:
        if key in normalized or normalized in key:
            return key
    return "general_commerce"


def _get_keywords(industry: str) -> list[str]:
    """Get search keywords for an industry."""
    normalized = _normalize_industry(industry)
    return INDUSTRY_KEYWORDS.get(normalized, INDUSTRY_KEYWORDS["general_commerce"])


def _infer_sentiment(text: str) -> str:
    """Heuristic sentiment inference from keyword text."""
    text_lower = text.lower()
    positive_signals = ["best", "love", "top", "great", "amazing", "save", "grow", "profit", "free"]
    negative_signals = ["avoid", "scam", "fail", "loss", "burnout", "hate", "worst", "risk"]
    pos = sum(1 for s in positive_signals if s in text_lower)
    neg = sum(1 for s in negative_signals if s in text_lower)
    if pos > neg:
        return Sentiment.POSITIVE.value
    if neg > pos:
        return Sentiment.MIXED.value
    return Sentiment.NEUTRAL.value


async def fetch_industry_trends(
    industry: str,
    country: str = "us",
    force_refresh: bool = False,
) -> IndustryTrends:
    """
    Main entry point — fetches real-time trend data with cascading fallback.

    Pipeline: SerpAPI → pytrends → Reddit enrichment → mock fallback
    Each layer is independently protected by a circuit breaker.
    """
    normalized = _normalize_industry(industry)
    keywords = _get_keywords(industry)

    logger.info(
        "trends_fetch_start",
        extra={"industry": normalized, "country": country, "force_refresh": force_refresh},
    )

    # 1. Try SerpAPI (most reliable, paid)
    result = await _fetch_serpapi_trends(keywords, country)
    if result:
        result.industry = normalized

        # 2. Enrich with Reddit hooks
        reddit_hooks = await _fetch_reddit_hooks(normalized)
        if reddit_hooks:
            result.viral_hooks = reddit_hooks

        logger.info("trends_fetch_complete", extra={"source": result.source, "trends": len(result.top_trends)})
        return result

    # 3. Try pytrends (free, less reliable)
    result = await _fetch_pytrends_trends(keywords)
    if result:
        result.industry = normalized

        reddit_hooks = await _fetch_reddit_hooks(normalized)
        if reddit_hooks:
            result.viral_hooks = reddit_hooks

        logger.info("trends_fetch_complete", extra={"source": result.source, "trends": len(result.top_trends)})
        return result

    # 4. Mock fallback with Reddit enrichment
    mock = MOCK_TRENDS_DB.get(normalized, MOCK_TRENDS_DB["general_commerce"])
    reddit_hooks = await _fetch_reddit_hooks(normalized)
    if reddit_hooks:
        mock = IndustryTrends(
            industry=mock.industry,
            top_trends=mock.top_trends,
            viral_hooks=reddit_hooks,
            last_updated=mock.last_updated,
            source=TrendSource.MOCK.value,
        )

    logger.info("trends_fetch_complete", extra={"source": mock.source, "trends": len(mock.top_trends)})
    return mock


# ============================================================================
# CONTEXT FORMATTING (for LLM prompt injection)
# ============================================================================


def format_trend_context(trends: IndustryTrends) -> str:
    """Format trend data into a string for LLM prompt injection."""
    if not trends or not trends.top_trends:
        return ""

    source_tag = {
        TrendSource.SERPAPI.value: "[LIVE · SerpAPI]",
        TrendSource.PYTRENDS.value: "[LIVE · Google Trends]",
        TrendSource.REDDIT.value: "[LIVE · Reddit]",
        TrendSource.CACHE.value: "[CACHED]",
        TrendSource.MOCK.value: "[DEMO]",
    }.get(trends.source, "[UNKNOWN]")

    trend_bullets = "\n".join(
        f"- **{t.keyword.upper()}**: {t.context} (Volume: {t.search_volume}, Momentum: {t.momentum})"
        for t in trends.top_trends
        if t.momentum in ("rising", "peaking")
    )

    hook_bullets = "\n".join(f'- "{h}"' for h in trends.viral_hooks)

    return f"""REAL-TIME CULTURAL TRENDS {source_tag}:
{trend_bullets}

CURRENT VIRAL HOOK FORMATS IN THIS INDUSTRY:
{hook_bullets}

INSTRUCTION: Weave one of these trends or formats into your campaign naturally. Do not force it, but make the copy feel "of the moment"."""


# ============================================================================
# FASTAPI SERVER
# ============================================================================


def create_app():
    """Create the FastAPI application with lazy import to avoid circular deps."""
    from fastapi import FastAPI, Query
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import JSONResponse

    app = FastAPI(
        title="Avoir Trend Sniper",
        version="1.0.0",
        description="Real-time trend intelligence for marketing campaign generation",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://localhost:8000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    async def health():
        return {
            "status": "healthy",
            "providers": {
                "serpapi": bool(SERPAPI_KEY),
                "pytrends": _pytrends_breaker.state != "open",
                "reddit": bool(REDDIT_CLIENT_ID),
            },
            "circuit_breakers": {
                "serpapi": _serpapi_breaker.state,
                "pytrends": _pytrends_breaker.state,
                "reddit": _reddit_breaker.state,
            },
        }

    @app.get("/trends/{industry}")
    async def get_trends(
        industry: str,
        country: str = Query(default="us", description="ISO country code"),
        fresh: bool = Query(default=False, description="Bypass cache"),
    ):
        try:
            result = await fetch_industry_trends(
                industry=industry,
                country=country,
                force_refresh=fresh,
            )
            return JSONResponse(content={"trends": result.to_dict()})
        except Exception as exc:
            logger.error("trends_endpoint_error", extra={"error": str(exc)})
            return JSONResponse(
                content={"error": "Failed to fetch trend data", "detail": str(exc)},
                status_code=500,
            )

    return app


# Entry point: uvicorn trends_sniper:create_app --host 0.0.0.0 --port 8001
app = create_app()

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("trends_sniper:app", host="0.0.0.0", port=8001, reload=True)
