/**
 * Avoir — Real-Time Trend Injection Engine
 * 
 * This module fetches real-time trend data (mocked for now, but architected for Google Trends/Reddit APIs)
 * to inject cultural relevance into campaign generation.
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

// Simulated real-time trend database
const MOCK_TRENDS_DB: Record<string, IndustryTrends> = {
  fashion: {
    industry: 'fashion',
    lastUpdated: new Date().toISOString(),
    topTrends: [
      { keyword: 'sustainable luxury', momentum: 'rising', searchVolume: '+140%', sentiment: 'positive', context: 'Gen-Z moving away from fast fashion towards investment pieces.' },
      { keyword: 'Y2K revival', momentum: 'peaking', searchVolume: '2.4M', sentiment: 'mixed', context: 'Early 2000s aesthetics still dominating TikTok GRWM videos.' },
      { keyword: 'quiet outdoor', momentum: 'rising', searchVolume: '+85%', sentiment: 'positive', context: 'Gorpcore merging with quiet luxury.' }
    ],
    viralHooks: ['POV: You finally found the perfect...', 'Why everyone is ditching...', 'Unboxing the viral...']
  },
  tech: {
    industry: 'tech',
    lastUpdated: new Date().toISOString(),
    topTrends: [
      { keyword: 'AI productivity', momentum: 'peaking', searchVolume: '5.1M', sentiment: 'positive', context: 'Professionals seeking tools to automate repetitive tasks.' },
      { keyword: 'digital detox', momentum: 'rising', searchVolume: '+210%', sentiment: 'mixed', context: 'Pushback against screen time; demand for offline-first tools.' },
      { keyword: 'spatial computing', momentum: 'rising', searchVolume: '+300%', sentiment: 'neutral', context: 'Apple Vision Pro hype driving interest in mixed reality.' }
    ],
    viralHooks: ['The AI tool that saved me 10 hours...', 'Stop doing this manually...', 'Is this the end of...']
  },
  finance: {
    industry: 'finance',
    lastUpdated: new Date().toISOString(),
    topTrends: [
      { keyword: 'loud budgeting', momentum: 'peaking', searchVolume: '+450%', sentiment: 'positive', context: 'Being vocal about saving money instead of quiet luxury.' },
      { keyword: 'micro-investing', momentum: 'rising', searchVolume: '1.2M', sentiment: 'positive', context: 'Gen-Z investing spare change.' },
      { keyword: 'side hustle burnout', momentum: 'rising', searchVolume: '+120%', sentiment: 'mixed', context: 'Shift towards passive income over active secondary jobs.' }
    ],
    viralHooks: ['How I saved $10k by loud budgeting...', 'The truth about passive income...', 'What your bank isn\'t telling you...']
  }
};

export async function fetchIndustryTrends(industry: string): Promise<IndustryTrends | null> {
  // In a real app, this would hit the SERP API, Google Trends, or Reddit API
  // For now, we simulate a slight network delay and return our curated mock data
  await new Promise(resolve => setTimeout(resolve, 600));
  
  const normalizedIndustry = industry.toLowerCase().trim();
  
  // Fuzzy match
  const match = Object.keys(MOCK_TRENDS_DB).find(key => normalizedIndustry.includes(key));
  
  if (match) {
    return MOCK_TRENDS_DB[match];
  }
  
  // Fallback to a general "ecommerce/creator" trend profile if no exact match
  return {
    industry: 'general_commerce',
    lastUpdated: new Date().toISOString(),
    topTrends: [
      { keyword: 'creator economy 2.0', momentum: 'rising', searchVolume: '+90%', sentiment: 'positive', context: 'Shift from ad revenue to direct digital product sales.' },
      { keyword: 'authentic lo-fi', momentum: 'peaking', searchVolume: '+150%', sentiment: 'positive', context: 'Users ignoring highly polished ads in favor of raw, UGC-style content.' }
    ],
    viralHooks: ['Nobody is talking about this...', 'I tried the viral...', 'The secret to...']
  };
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
