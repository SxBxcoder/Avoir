import { describe, it, expect } from 'vitest';
import { synthesizeTrendContext, type IndustryTrends, type TrendTopic } from '@/lib/trends';

function makeTrend(overrides: Partial<TrendTopic> = {}): TrendTopic {
  return {
    keyword: 'AI productivity',
    momentum: 'rising',
    searchVolume: '5.1M',
    sentiment: 'positive',
    context: 'Professionals seeking automation tools',
    ...overrides,
  };
}

function makeIntel(overrides: Partial<IndustryTrends> = {}): IndustryTrends {
  return {
    industry: 'tech',
    topTrends: [makeTrend()],
    viralHooks: ['The AI tool that saved me 10 hours...'],
    lastUpdated: new Date().toISOString(),
    source: 'serpapi',
    ...overrides,
  };
}

describe('TestSynthesizeTrendContext', () => {
  it('returns empty string for null input', () => {
    expect(synthesizeTrendContext(null as unknown as IndustryTrends)).toBe('');
  });

  it('returns empty string for empty trends', () => {
    const intel = makeIntel({ topTrends: [] });
    expect(synthesizeTrendContext(intel)).toBe('');
  });

  it('includes source tag for live data', () => {
    const intel = makeIntel({ source: 'serpapi' });
    const result = synthesizeTrendContext(intel);
    expect(result).toContain('[LIVE');
    expect(result).toContain('SerpAPI');
  });

  it('includes source tag for pytrends', () => {
    const intel = makeIntel({ source: 'pytrends' });
    const result = synthesizeTrendContext(intel);
    expect(result).toContain('Google Trends');
  });

  it('includes source tag for cache', () => {
    const intel = makeIntel({ source: 'cache' });
    const result = synthesizeTrendContext(intel);
    expect(result).toContain('[CACHED]');
  });

  it('includes source tag for mock', () => {
    const intel = makeIntel({ source: 'mock' });
    const result = synthesizeTrendContext(intel);
    expect(result).toContain('[DEMO]');
  });

  it('formats trend keywords in uppercase', () => {
    const intel = makeIntel();
    const result = synthesizeTrendContext(intel);
    expect(result).toContain('AI PRODUCTIVITY');
  });

  it('includes search volume and context', () => {
    const intel = makeIntel();
    const result = synthesizeTrendContext(intel);
    expect(result).toContain('5.1M');
    expect(result).toContain('Professionals seeking automation tools');
  });

  it('filters out falling momentum trends', () => {
    const intel = makeIntel({
      topTrends: [
        makeTrend({ keyword: 'hot trend', momentum: 'rising' }),
        makeTrend({ keyword: 'dead trend', momentum: 'falling' }),
      ],
    });
    const result = synthesizeTrendContext(intel);
    expect(result).toContain('HOT TREND');
    expect(result).not.toContain('DEAD TREND');
  });

  it('includes peaking trends', () => {
    const intel = makeIntel({
      topTrends: [makeTrend({ keyword: 'peak thing', momentum: 'peaking' })],
    });
    const result = synthesizeTrendContext(intel);
    expect(result).toContain('PEAK THING');
  });

  it('formats viral hooks with quotes', () => {
    const intel = makeIntel({
      viralHooks: ['Hook one', 'Hook two'],
    });
    const result = synthesizeTrendContext(intel);
    expect(result).toContain('"Hook one"');
    expect(result).toContain('"Hook two"');
  });

  it('includes INSTRUCTION directive', () => {
    const intel = makeIntel();
    const result = synthesizeTrendContext(intel);
    expect(result).toContain('INSTRUCTION:');
    expect(result).toContain('of the moment');
  });

  it('includes VIRAL HOOK FORMATS section', () => {
    const intel = makeIntel();
    const result = synthesizeTrendContext(intel);
    expect(result).toContain('VIRAL HOOK FORMATS');
  });
});
