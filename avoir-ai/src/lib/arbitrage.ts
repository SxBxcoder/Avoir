/**
 * Avoir — Arbitrage Opportunity Mapping
 *
 * Converts live IndustryTrends (TrendSniper cascade: SerpAPI → YouTube →
 * Apify → Gemini) into arbitrage opportunities for the LiveArbitrageFeed UI.
 *
 * Honesty note: topic/momentum/context come from real trend data. The
 * `competition` and `predictedRoas` numbers are DETERMINISTIC HEURISTICS
 * derived from that momentum — no ad platform reports them directly. Same
 * input always yields the same numbers; nothing is random.
 */

import type { IndustryTrends } from './trends';

export interface ArbitrageOpportunity {
  id: string;
  topic: string;
  niche: string;
  /** Estimated saturation, 0-100. Lower = more room to enter. */
  competition: number;
  /** Estimated return multiple derived from trend momentum. */
  predictedRoas: number;
  /** Normalized momentum score, 0-100. */
  momentum: number;
  directive: string;
}

const MOMENTUM_SCORES: Record<string, number> = {
  rising: 70,
  peaking: 90,
  falling: 30,
};

const DEFAULT_SCORE = 50;
const MAX_OPPORTUNITIES = 3;

/**
 * Maps a momentum label to a normalized score.
 * Unknown labels get a neutral midpoint rather than a guess.
 */
export function momentumScore(momentum: unknown): number {
  if (typeof momentum !== 'string') return DEFAULT_SCORE;
  const key = momentum.toLowerCase().trim();
  if (key.includes('peak')) return MOMENTUM_SCORES.peaking;
  if (key.includes('ris') || key.includes('spik')) return MOMENTUM_SCORES.rising;
  if (key.includes('fall') || key.includes('decay')) return MOMENTUM_SCORES.falling;
  return DEFAULT_SCORE;
}

function formatNiche(industry: string): string {
  const cleaned = industry.replace(/[_-]+/g, ' ').trim();
  if (!cleaned) return 'General';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function truncate(text: string, maxLen: number): string {
  return text.length <= maxLen ? text : `${text.slice(0, maxLen - 3)}...`;
}

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'trend';
}

/**
 * Maps live trends into feed-ready opportunities.
 * Returns at most MAX_OPPORTUNITIES items; empty input yields [].
 */
export function mapTrendsToOpportunities(
  trends: IndustryTrends | null | undefined,
  industry: string
): ArbitrageOpportunity[] {
  if (!trends || !Array.isArray(trends.topTrends)) return [];

  const niche = formatNiche(industry);

  return trends.topTrends.slice(0, MAX_OPPORTUNITIES).map((trend, idx) => {
    const mScore = momentumScore(trend.momentum);
    const topic = truncate(String(trend.keyword ?? '').trim() || 'Untitled trend', 60);

    // Heuristics (documented in PR): competition maps directly from momentum
    // saturation — a peaking trend is crowded (90), an early rising one still
    // has room to enter (70); projected ROAS scales linearly with momentum.
    const competition = Math.max(5, Math.min(95, mScore));
    const predictedRoas = Math.round((2 + mScore / 25) * 10) / 10;

    return {
      id: `arb-${slug(industry)}-${idx}-${slug(topic)}`,
      topic,
      niche,
      competition,
      predictedRoas,
      momentum: mScore,
      directive: `Create a viral ${niche} campaign capitalizing on "${topic}" before the market saturates`,
    };
  });
}
