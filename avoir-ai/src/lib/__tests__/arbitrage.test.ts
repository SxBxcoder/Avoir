import { describe, it, expect } from 'vitest';
import {
  momentumScore,
  mapTrendsToOpportunities,
  type ArbitrageOpportunity,
} from '../arbitrage';
import type { IndustryTrends } from '../trends';

function makeTrends(overrides: Partial<IndustryTrends> = {}): IndustryTrends {
  return {
    industry: 'fitness',
    topTrends: [
      { keyword: '12-3-30 workout', momentum: 'rising', searchVolume: '+250%', sentiment: 'positive', context: 'Rising Google search in fitness' },
      { keyword: 'Creatine for women', momentum: 'peaking', searchVolume: '500K', sentiment: 'positive', context: 'Top Google search related to fitness' },
      { keyword: 'Gym anxiety content', momentum: 'rising', searchVolume: '+180%', sentiment: 'neutral', context: 'Rising Google search in fitness' },
      { keyword: 'Fourth trend that must be dropped', momentum: 'falling', searchVolume: '-40%', sentiment: 'mixed', context: 'Falling' },
    ],
    viralHooks: ['Why everyone is searching for 12-3-30...'],
    lastUpdated: '2026-08-21T00:00:00Z',
    source: 'serpapi',
    ...overrides,
  };
}

describe('momentumScore', () => {
  it('maps known labels to their scores', () => {
    expect(momentumScore('rising')).toBe(70);
    expect(momentumScore('peaking')).toBe(90);
    expect(momentumScore('falling')).toBe(30);
  });

  it('handles variants containing the keywords', () => {
    expect(momentumScore('Spiking')).toBe(70);
    expect(momentumScore('Peaking (+120% in 48h)')).toBe(90);
    expect(momentumScore('decaying fast')).toBe(30);
  });

  it('returns neutral midpoint for unknown or non-string input', () => {
    expect(momentumScore('weird label')).toBe(50);
    expect(momentumScore(undefined)).toBe(50);
    expect(momentumScore(42)).toBe(50);
  });
});

describe('mapTrendsToOpportunities', () => {
  it('is deterministic — same input, same output', () => {
    const a = mapTrendsToOpportunities(makeTrends(), 'fitness');
    const b = mapTrendsToOpportunities(makeTrends(), 'fitness');
    expect(a).toEqual(b);
  });

  it('caps at 3 opportunities', () => {
    const result = mapTrendsToOpportunities(makeTrends(), 'fitness');
    expect(result).toHaveLength(3);
  });

  it('derives metrics deterministically from momentum', () => {
    const [first] = mapTrendsToOpportunities(makeTrends(), 'fitness');
    // rising = 70 → competition 70 (saturation maps directly), roas 2 + 70/25 = 4.8
    expect(first.momentum).toBe(70);
    expect(first.competition).toBe(70);
    expect(first.predictedRoas).toBe(4.8);
  });

  it('ranks peaking trends as more saturated than rising ones', () => {
    const trends = makeTrends({
      topTrends: [
        { keyword: 'Old news', momentum: 'peaking', searchVolume: '1M', sentiment: 'neutral', context: '' },
        { keyword: 'Fresh spike', momentum: 'rising', searchVolume: '+300%', sentiment: 'positive', context: '' },
      ],
    });
    const [peaking, rising] = mapTrendsToOpportunities(trends, 'fitness');
    expect(peaking.competition).toBe(90);
    expect(rising.competition).toBe(70);
    expect(peaking.competition).toBeGreaterThan(rising.competition);
  });

  it('keeps competition and roas within sane bounds for all scores', () => {
    const result = mapTrendsToOpportunities(makeTrends(), 'fitness');
    for (const opp of result as ArbitrageOpportunity[]) {
      expect(opp.competition).toBeGreaterThanOrEqual(5);
      expect(opp.competition).toBeLessThanOrEqual(95);
      expect(opp.predictedRoas).toBeGreaterThanOrEqual(2);
      expect(opp.predictedRoas).toBeLessThanOrEqual(6);
    }
  });

  it('builds directive and niche from the industry', () => {
    const [first] = mapTrendsToOpportunities(makeTrends(), 'general_commerce');
    expect(first.niche).toBe('General commerce');
    expect(first.directive).toContain(first.topic);
    expect(first.directive).toContain('General commerce');
  });

  it('truncates long topics and keeps ids stable', () => {
    const trends = makeTrends({
      topTrends: [{ keyword: 'A'.repeat(200), momentum: 'rising', searchVolume: '+1%', sentiment: 'neutral', context: '' }],
    });
    const [opp] = mapTrendsToOpportunities(trends, 'tech');
    expect(opp.topic.length).toBeLessThanOrEqual(60);
    expect(opp.id).toBe(mapTrendsToOpportunities(trends, 'tech')[0].id);
  });

  it('returns [] for null trends or empty topTrends', () => {
    expect(mapTrendsToOpportunities(null, 'fitness')).toEqual([]);
    expect(mapTrendsToOpportunities(undefined, 'fitness')).toEqual([]);
    expect(mapTrendsToOpportunities({ ...makeTrends(), topTrends: [] }, 'fitness')).toEqual([]);
  });
});
