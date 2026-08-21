export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  displayContent?: string;
}

export interface CampaignReasoning {
  hook_rationale: string;
  offer_rationale: string;
  cta_rationale: string;
  confidence_score: number;
  audience_insight: string;
}

export interface CampaignAsset {
  hook: string;
  offer: string;
  cta: string;
  reasoning?: CampaignReasoning;
  funnel?: {
    top: string;
    bottom: string;
  };
}

export interface GenomePredictedScores {
  virality: number;
  conversion: number;
  retention: number;
  brand_trust: number;
  shareability: number;
}

export interface GenomeVariant {
  genome_type: 'virality' | 'conversion' | 'authority';
  plan: CampaignAsset;
  captions: string[];
  predicted_scores: GenomePredictedScores;
}

export interface CampaignData {
  campaignId?: string;
  plan: CampaignAsset;
  captions: string[];
  image_url?: string;
  messages?: Message[];
  status?: string;
}

export interface CampaignHistoryItem {
  campaignId: string;
  goal: string;
  plan: CampaignAsset;
  captions: string[];
  imageUrl?: string;
  image_url?: string;
  messages: Array<{ role: string; content: string; displayContent?: string }>;
  tier: string;
  status: 'completed' | 'failed' | 'pending';
  createdAt: string;
  updatedAt: string;
  isWinner?: boolean;
}

export interface CampaignDashboardProps {
  accessToken: string;
  userEmail: string;
  onLogout?: () => void;
  embedded?: boolean;
}
