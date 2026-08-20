import { describe, it, expect, beforeEach, vi } from 'vitest';
import { analyzeMarketGaps, formatCompetitorContext, type CompetitorAd, type CompetitorIntel } from '@/lib/db/competitors';

function makeAd(overrides: Partial<CompetitorAd> = {}): CompetitorAd {
  return {
    id: 'ad-1',
    brand: 'TestBrand',
    hook: 'Test hook for the ad',
    engagement: 'High',
    runTime: '14 days',
    detectedFormat: 'Image + Text',
    platforms: ['FACEBOOK'],
    ...overrides,
  };
}

describe('TestMarketGapAnalysis', () => {
  it('returns a placeholder when no ads exist', () => {
    const gaps = analyzeMarketGaps([]);
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toContain('No competitor data');
  });

  it('suggests missing formats', () => {
    const ads = [
      makeAd({ detectedFormat: 'Image + Text' }),
      makeAd({ detectedFormat: 'Video' }),
    ];
    const gaps = analyzeMarketGaps(ads);
    expect(gaps.some((g) => g.includes('UGC Video') || g.includes('Carousel'))).toBe(true);
  });

  it('suggests platform expansion when underserved', () => {
    const ads = [
      makeAd({ platforms: ['FACEBOOK'] }),
      makeAd({ platforms: ['FACEBOOK'] }),
    ];
    const gaps = analyzeMarketGaps(ads);
    expect(gaps.some((g) => g.toLowerCase().includes('instagram'))).toBe(true);
  });

  it('suggests urgency when no competitor uses it', () => {
    const ads = [
      makeAd({ hook: 'Buy our product today' }),
      makeAd({ hook: 'Great quality stuff' }),
    ];
    const gaps = analyzeMarketGaps(ads);
    expect(gaps.some((g) => g.toLowerCase().includes('urgency'))).toBe(true);
  });

  it('suggests social proof when missing', () => {
    const ads = [
      makeAd({ hook: 'Amazing product for you' }),
    ];
    const gaps = analyzeMarketGaps(ads);
    expect(gaps.some((g) => g.toLowerCase().includes('social proof'))).toBe(true);
  });

  it('suggests short copy when market is long-form', () => {
    const ads = [
      makeAd({ hook: 'A'.repeat(150) }),
      makeAd({ hook: 'B'.repeat(120) }),
    ];
    const gaps = analyzeMarketGaps(ads);
    expect(gaps.some((g) => g.toLowerCase().includes('short'))).toBe(true);
  });

  it('suggests long copy when market is short', () => {
    const ads = [
      makeAd({ hook: 'Short' }),
      makeAd({ hook: 'Also short' }),
    ];
    const gaps = analyzeMarketGaps(ads);
    expect(gaps.some((g) => g.toLowerCase().includes('long-form'))).toBe(true);
  });

  it('limits gaps to 5', () => {
    // Create ads that trigger multiple gap categories
    const ads = [
      makeAd({
        hook: 'Simple hook',
        detectedFormat: 'Image + Text',
        platforms: ['FACEBOOK'],
      }),
    ];
    const gaps = analyzeMarketGaps(ads);
    expect(gaps.length).toBeLessThanOrEqual(5);
  });
});

describe('TestFormatCompetitorContext', () => {
  it('returns empty string for null intel', () => {
    expect(formatCompetitorContext(null as unknown as CompetitorIntel)).toBe('');
  });

  it('returns empty string for empty ads', () => {
    const intel: CompetitorIntel = {
      industry: 'tech',
      topAds: [],
      marketGaps: ['gap'],
      lastUpdated: new Date().toISOString(),
      source: 'mock',
    };
    expect(formatCompetitorContext(intel)).toBe('');
  });

  it('formats ads and gaps into LLM context', () => {
    const intel: CompetitorIntel = {
      industry: 'tech',
      topAds: [
        makeAd({ brand: 'Notion', hook: 'Organize your life', detectedFormat: 'UGC Video', engagement: 'Very High' }),
      ],
      marketGaps: ['Try video format'],
      lastUpdated: new Date().toISOString(),
      source: 'facebook',
    };

    const result = formatCompetitorContext(intel);
    expect(result).toContain('[LIVE DATA]');
    expect(result).toContain('Notion');
    expect(result).toContain('Organize your life');
    expect(result).toContain('Try video format');
    expect(result).toContain('INSTRUCTION');
  });

  it('shows [CACHED] tag for cached data', () => {
    const intel: CompetitorIntel = {
      industry: 'tech',
      topAds: [makeAd()],
      marketGaps: ['gap'],
      lastUpdated: new Date().toISOString(),
      source: 'cache',
    };

    const result = formatCompetitorContext(intel);
    expect(result).toContain('[CACHED]');
  });

  it('shows [DEMO] tag for mock data', () => {
    const intel: CompetitorIntel = {
      industry: 'tech',
      topAds: [makeAd()],
      marketGaps: ['gap'],
      lastUpdated: new Date().toISOString(),
      source: 'mock',
    };

    const result = formatCompetitorContext(intel);
    expect(result).toContain('[DEMO]');
  });
});
