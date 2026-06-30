/**
 * Avoir — Competitor Watch API
 * 
 * Simulated tracking of competitor campaigns. In a real environment, this would
 * connect to Facebook Ad Library API or a web scraper.
 */

export interface CompetitorAd {
  id: string;
  brand: string;
  hook: string;
  engagement: string;
  runTime: string;
  detectedFormat: string;
}

export interface CompetitorIntel {
  industry: string;
  topAds: CompetitorAd[];
  marketGaps: string[];
  lastUpdated: string;
}

const MOCK_COMPETITORS: Record<string, CompetitorIntel> = {
  fashion: {
    industry: 'fashion',
    lastUpdated: new Date().toISOString(),
    topAds: [
      { id: 'ad-1', brand: 'H&M', hook: 'Sustainable style that doesn\'t cost the earth.', engagement: 'High', runTime: '14 days', detectedFormat: 'Carousel' },
      { id: 'ad-2', brand: 'Zara', hook: 'The Summer Collection has arrived.', engagement: 'Medium', runTime: '5 days', detectedFormat: 'Video' }
    ],
    marketGaps: ['Focus on durability', 'Highlight local sourcing', 'User generated try-on hauls']
  },
  tech: {
    industry: 'tech',
    lastUpdated: new Date().toISOString(),
    topAds: [
      { id: 'ad-3', brand: 'Notion', hook: 'Organize your life, your way.', engagement: 'Very High', runTime: '30+ days', detectedFormat: 'UGC Video' },
      { id: 'ad-4', brand: 'Monday.com', hook: 'The platform that manages everything.', engagement: 'High', runTime: '20 days', detectedFormat: 'Animation' }
    ],
    marketGaps: ['Focus on AI automation', 'Highlight offline capabilities', 'Showcase real-world messy setups']
  }
};

export async function fetchCompetitorIntel(industry: string): Promise<CompetitorIntel | null> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 800));
  
  const normalized = industry.toLowerCase().trim();
  const match = Object.keys(MOCK_COMPETITORS).find(key => normalized.includes(key));
  
  if (match) {
    return MOCK_COMPETITORS[match];
  }
  
  // Fallback
  return {
    industry: 'general_commerce',
    lastUpdated: new Date().toISOString(),
    topAds: [
      { id: 'ad-0', brand: 'Market Leader', hook: 'The product you didn\'t know you needed.', engagement: 'High', runTime: '10 days', detectedFormat: 'Image + Text' }
    ],
    marketGaps: ['Showcase founder story', 'Highlight extreme durability test']
  };
}

export function formatCompetitorContext(intel: CompetitorIntel): string {
  if (!intel || intel.topAds.length === 0) return '';
  
  const adsText = intel.topAds.map(ad => `- **${ad.brand}**: "${ad.hook}" (${ad.detectedFormat}, ${ad.engagement} engagement)`).join('\n');
  const gapsText = intel.marketGaps.map(gap => `- ${gap}`).join('\n');
  
  return `COMPETITOR INTEL:
Current top-performing competitor ads in this space:
${adsText}

Market Gaps (Opportunities for differentiation):
${gapsText}

INSTRUCTION: Create a campaign that stands out from these competitors by leaning into the Market Gaps. Do not copy their hooks.`;
}
