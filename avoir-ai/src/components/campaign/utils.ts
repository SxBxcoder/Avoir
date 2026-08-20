import { type CampaignData } from './types';

export function extractCampaignData(text: string): { campaign: CampaignData | null; displayMessage: string } {
  try {
    let jsonStr = text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonStr = jsonMatch[0];

    const parsed = JSON.parse(jsonStr);
    const hook = parsed.plan?.hook || parsed.hook || '';
    const offer = parsed.plan?.offer || parsed.offer || '';
    const cta = parsed.plan?.cta || parsed.cta || '';
    const captions = parsed.captions || [];

    if (hook || captions.length > 0) {
      return {
        campaign: {
          plan: { hook, offer, cta },
          captions,
          image_url: parsed.imageUrl || parsed.image_url,
          campaignId: parsed.campaignId,
          status: parsed.status,
        },
        displayMessage: '✅ Strategic Campaign Compiled. See the Canvas below.',
      };
    }
  } catch { /* not JSON */ }

  return { campaign: null, displayMessage: text };
}
