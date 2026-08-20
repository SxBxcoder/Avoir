"""
Avoir — pytest Tests for Trend Intelligence Engine

Tests the SerpAPI client, circuit breaker, retry logic, Reddit enrichment,
mock fallback, context formatting, and industry keyword mapping.

Run: pytest scripts/tests/test_trends_sniper.py -v
"""

import asyncio
import os
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# Ensure scripts/ is importable
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from trends_sniper import (
    CircuitBreaker,
    IndustryTrends,
    Momentum,
    Sentiment,
    TrendSource,
    TrendTopic,
    _fetch_pytrends_trends,
    _fetch_reddit_hooks,
    _fetch_serpapi_trends,
    _get_keywords,
    _infer_sentiment,
    _normalize_industry,
    fetch_industry_trends,
    format_trend_context,
)


# ============================================================================
# FIXTURES
# ============================================================================


@pytest.fixture
def sample_trends() -> IndustryTrends:
    return IndustryTrends(
        industry="fashion",
        top_trends=[
            TrendTopic("sustainable luxury", "rising", "+140%", "positive", "Gen-Z investing in quality."),
            TrendTopic("Y2K revival", "peaking", "2.4M", "mixed", "Early 2000s aesthetics on TikTok."),
            TrendTopic("quiet outdoor", "rising", "+85%", "positive", "Gorpcore meets quiet luxury."),
        ],
        viral_hooks=["POV: You finally found...", "Why everyone is ditching..."],
        last_updated="2026-08-20T12:00:00Z",
        source=TrendSource.SERPAPI.value,
    )


@pytest.fixture
def empty_trends() -> IndustryTrends:
    return IndustryTrends(
        industry="unknown",
        top_trends=[],
        viral_hooks=[],
        last_updated="2026-08-20T12:00:00Z",
        source=TrendSource.MOCK.value,
    )


# ============================================================================
# CIRCUIT BREAKER TESTS
# ============================================================================


class TestCircuitBreaker:
    def test_starts_closed(self):
        cb = CircuitBreaker(failure_threshold=3, cooldown_seconds=60)
        assert cb.state == "closed"
        assert cb.allow_request() is True

    def test_opens_after_threshold_failures(self):
        cb = CircuitBreaker(failure_threshold=2, cooldown_seconds=60)
        cb.record_failure()
        assert cb.state == "closed"
        cb.record_failure()
        assert cb.state == "open"
        assert cb.allow_request() is False

    def test_resets_on_success(self):
        cb = CircuitBreaker(failure_threshold=3, cooldown_seconds=60)
        cb.record_failure()
        cb.record_failure()
        cb.record_success()
        assert cb.state == "closed"
        assert cb.consecutive_failures == 0

    def test_half_open_after_cooldown(self):
        cb = CircuitBreaker(failure_threshold=1, cooldown_seconds=0.1)
        cb.record_failure()
        assert cb.state == "open"
        # Wait for cooldown
        import time
        time.sleep(0.15)
        assert cb.allow_request() is True
        assert cb.state == "half_open"

    def test_half_open_closes_on_success(self):
        cb = CircuitBreaker(failure_threshold=1, cooldown_seconds=0.01)
        cb.record_failure()
        import time
        time.sleep(0.02)
        cb.allow_request()  # half_open
        cb.record_success()
        assert cb.state == "closed"


# ============================================================================
# KEYWORD MAPPING TESTS
# ============================================================================


class TestKeywordMapping:
    def test_exact_match(self):
        assert _normalize_industry("fashion") == "fashion"
        assert _normalize_industry("tech") == "tech"

    def test_fuzzy_match(self):
        assert _normalize_industry("fashion retail") == "fashion"
        assert _normalize_industry("artificial intelligence tech") == "tech"

    def test_unknown_falls_back(self):
        assert _normalize_industry("xyz_unknown") == "general_commerce"

    def test_get_keywords_returns_list(self):
        keywords = _get_keywords("fashion")
        assert isinstance(keywords, list)
        assert len(keywords) > 0
        assert all(isinstance(k, str) for k in keywords)

    def test_general_commerce_fallback(self):
        keywords = _get_keywords("nonexistent_industry_xyz")
        assert "digital marketing trends" in keywords


# ============================================================================
# SENTIMENT INFERENCE TESTS
# ============================================================================


class TestSentimentInference:
    def test_positive_signals(self):
        assert _infer_sentiment("best tools for business") == Sentiment.POSITIVE.value
        assert _infer_sentiment("top growing brands") == Sentiment.POSITIVE.value

    def test_negative_signals(self):
        assert _infer_sentiment("avoid these scams") == Sentiment.MIXED.value
        assert _infer_sentiment("burnout is real") == Sentiment.MIXED.value

    def test_neutral_default(self):
        assert _infer_sentiment("some random keyword") == Sentiment.NEUTRAL.value


# ============================================================================
# SERPAPI CLIENT TESTS
# ============================================================================


class TestSerpAPIClient:
    @pytest.mark.asyncio
    async def test_returns_none_without_api_key(self):
        with patch.dict(os.environ, {"SERPAPI_KEY": ""}):
            result = await _fetch_serpapi_trends(["test keyword"])
            assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_when_circuit_open(self):
        with patch.dict(os.environ, {"SERPAPI_KEY": "test-key"}):
            from trends_sniper import _serpapi_breaker
            _serpapi_breaker.state = "open"
            result = await _fetch_serpapi_trends(["test keyword"])
            assert result is None
            _serpapi_breaker.state = "closed"  # cleanup

    @pytest.mark.asyncio
    async def test_parses_rising_queries(self):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.raise_for_status = MagicMock()
        mock_response.json.return_value = {
            "rising_searches": [
                {"query": "sustainable fashion brands", "value": "+250%"},
                {"query": "thrift flip tutorial", "value": "+180%"},
            ]
        }

        with patch.dict(os.environ, {"SERPAPI_KEY": "test-key"}):
            with patch("httpx.AsyncClient.get", new_callable=AsyncMock, return_value=mock_response):
                result = await _fetch_serpapi_trends(["fashion trends"], country="us")
                assert result is not None
                assert len(result.top_trends) == 2
                assert result.source == TrendSource.SERPAPI.value
                assert result.top_trends[0].keyword == "sustainable fashion brands"

    @pytest.mark.asyncio
    async def test_handles_rate_limit(self):
        import httpx
        mock_response = MagicMock()
        mock_response.status_code = 429
        mock_response.raise_for_status = MagicMock(side_effect=httpx.HTTPStatusError(
            "429", request=MagicMock(), response=mock_response
        ))

        with patch.dict(os.environ, {"SERPAPI_KEY": "test-key"}):
            with patch("httpx.AsyncClient.get", new_callable=AsyncMock, return_value=mock_response):
                result = await _fetch_serpapi_trends(["fashion"])
                assert result is None  # Falls through to next provider


# ============================================================================
# PYTRENDS CLIENT TESTS
# ============================================================================


class TestPyTrendsClient:
    @pytest.mark.asyncio
    async def test_returns_none_when_not_installed(self):
        with patch.dict("sys.modules", {"pytrends": None}):
            result = await _fetch_pytrends_trends(["test"])
            assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_when_circuit_open(self):
        from trends_sniper import _pytrends_breaker
        _pytrends_breaker.state = "open"
        result = await _fetch_pytrends_trends(["test"])
        assert result is None
        _pytrends_breaker.state = "closed"


# ============================================================================
# REDDIT CLIENT TESTS
# ============================================================================


class TestRedditClient:
    @pytest.mark.asyncio
    async def test_returns_empty_without_credentials(self):
        with patch.dict(os.environ, {"REDDIT_CLIENT_ID": "", "REDDIT_CLIENT_SECRET": ""}):
            result = await _fetch_reddit_hooks("fashion")
            assert result == []

    @pytest.mark.asyncio
    async def test_returns_empty_when_circuit_open(self):
        from trends_sniper import _reddit_breaker
        _reddit_breaker.state = "open"
        result = await _fetch_reddit_hooks("fashion")
        assert result == []
        _reddit_breaker.state = "closed"


# ============================================================================
# ORCHESTRATION TESTS
# ============================================================================


class TestOrchestration:
    @pytest.mark.asyncio
    async def test_mock_fallback_when_all_providers_fail(self):
        with patch.dict(os.environ, {"SERPAPI_KEY": "", "REDDIT_CLIENT_ID": "", "REDDIT_CLIENT_SECRET": ""}):
            with patch("trends_sniper._fetch_pytrends_trends", new_callable=AsyncMock, return_value=None):
                result = await fetch_industry_trends("fashion")
                assert result is not None
                assert result.source == TrendSource.MOCK.value
                assert len(result.top_trends) > 0

    @pytest.mark.asyncio
    async def test_mock_fallback_for_unknown_industry(self):
        with patch.dict(os.environ, {"SERPAPI_KEY": "", "REDDIT_CLIENT_ID": "", "REDDIT_CLIENT_SECRET": ""}):
            with patch("trends_sniper._fetch_pytrends_trends", new_callable=AsyncMock, return_value=None):
                result = await fetch_industry_trends("xyz_unknown")
                assert result is not None
                assert result.industry == "general_commerce"

    @pytest.mark.asyncio
    async def test_serpapi_success_path(self):
        mock_serpapi = IndustryTrends(
            industry="tech",
            top_trends=[TrendTopic("AI tools", "rising", "5M", "positive", "AI adoption")],
            viral_hooks=["The AI tool that..."],
            last_updated="2026-08-20T12:00:00Z",
            source=TrendSource.SERPAPI.value,
        )
        with patch("trends_sniper._fetch_serpapi_trends", new_callable=AsyncMock, return_value=mock_serpapi):
            with patch("trends_sniper._fetch_reddit_hooks", new_callable=AsyncMock, return_value=["Reddit hook 1"]):
                result = await fetch_industry_trends("tech")
                assert result.source == TrendSource.SERPAPI.value
                assert result.industry == "tech"
                assert "Reddit hook 1" in result.viral_hooks

    @pytest.mark.asyncio
    async def test_pytrends_fallback_when_serpapi_fails(self):
        mock_pytrends = IndustryTrends(
            industry="finance",
            top_trends=[TrendTopic("loud budgeting", "peaking", "+450%", "positive", "Saving out loud")],
            viral_hooks=[],
            last_updated="2026-08-20T12:00:00Z",
            source=TrendSource.PYTRENDS.value,
        )
        with patch("trends_sniper._fetch_serpapi_trends", new_callable=AsyncMock, return_value=None):
            with patch("trends_sniper._fetch_pytrends_trends", new_callable=AsyncMock, return_value=mock_pytrends):
                result = await fetch_industry_trends("finance")
                assert result.source == TrendSource.PYTRENDS.value


# ============================================================================
# CONTEXT FORMATTING TESTS
# ============================================================================


class TestContextFormatting:
    def test_formats_with_live_source(self, sample_trends):
        result = format_trend_context(sample_trends)
        assert "[LIVE" in result
        assert "SUSTAINABLE LUXURY" in result
        assert "Y2K REVIVAL" in result
        assert "INSTRUCTION:" in result

    def test_formats_with_mock_source(self):
        trends = IndustryTrends(
            industry="test",
            top_trends=[TrendTopic("test keyword", "rising", "100", "positive", "Test context")],
            viral_hooks=["Test hook"],
            last_updated="2026-08-20T12:00:00Z",
            source=TrendSource.MOCK.value,
        )
        result = format_trend_context(trends)
        assert "[DEMO]" in result

    def test_returns_empty_for_null(self):
        assert format_trend_context(None) == ""  # type: ignore

    def test_returns_empty_for_empty_trends(self, empty_trends):
        result = format_trend_context(empty_trends)
        assert result == ""

    def test_filters_falling_momentum(self, sample_trends):
        sample_trends.top_trends.append(
            TrendTopic("dead trend", "falling", "100", "neutral", "Nobody cares")
        )
        result = format_trend_context(sample_trends)
        assert "DEAD TREND" not in result
        assert "SUSTAINABLE LUXURY" in result


# ============================================================================
# DATA TYPE TESTS
# ============================================================================


class TestDataTypes:
    def test_trend_topic_to_dict(self):
        t = TrendTopic("keyword", "rising", "100", "positive", "context")
        d = t.to_dict()
        assert d["keyword"] == "keyword"
        assert d["momentum"] == "rising"
        assert d["search_volume"] == "100"

    def test_industry_trends_to_dict(self, sample_trends):
        d = sample_trends.to_dict()
        assert d["industry"] == "fashion"
        assert len(d["topTrends"]) == 3
        assert d["topTrends"][0]["keyword"] == "sustainable luxury"
        assert "viralHooks" in d
        assert "source" in d
