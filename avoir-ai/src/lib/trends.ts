/**
 * Avoir — Real-Time Trend Injection Engine
 *
 * Fetches real-time trend data from the Python backend (SerpAPI Google Trends →
 * YouTube → Gemini → Mock fallback). The backend is the single source of truth;
 * this module is a thin HTTP client.
 */

export interface TrendTopic {
  keyword: string;
  momentum: 'rising' | 'peaking' | 'falling';
  searchVolume: string;
  sentiment: 'positive' | 'neutral' | 'mixed';
  context: string;
}

export interface IndustryTrends {
  industry: string;
  topTrends: TrendTopic[];
  viralHooks: string[];
  lastUpdated: string;
}

export async function fetchIndustryTrends(industry: string): Promise<IndustryTrends | null> {
  const pythonApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  try {
    const res = await fetch(
      `${pythonApiUrl}/api/trends?industry=${encodeURIComponent(industry)}`,
      { cache: 'no-store' }
    );

    if (!res.ok) {
      console.warn(`[trends] Backend returned ${res.status} for industry="${industry}"`);
      return null;
    }

    const data = await res.json();
    return data.trends || null;
  } catch (err) {
    console.warn(`[trends] Failed to reach Python backend at ${pythonApiUrl}:`, err);
    return null;
  }
}

export function synthesizeTrendContext(trends: IndustryTrends): string {
  if (!trends || !trends.topTrends.length) return '';

  const trendBullets = trends.topTrends
    .filter(t => t.momentum === 'rising' || t.momentum === 'peaking')
    .map(t => `- **${t.keyword.toUpperCase()}**: ${t.context} (Search Volume: ${t.searchVolume})`)
    .join('\n');

  const hookBullets = trends.viralHooks
    .map(h => `- "${h}"`)
    .join('\n');

  return `REAL-TIME CULTURAL TRENDS (Inject these angles to make the campaign relevant right now):
${trendBullets}

CURRENT VIRAL HOOK FORMATS IN THIS INDUSTRY:
${hookBullets}

INSTRUCTION: Weave one of these trends or formats into your campaign naturally. Do not force it, but make the copy feel "of the moment".`;
}
