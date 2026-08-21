/**
 * Avoir — Shared campaign-generation request parsing.
 *
 * Both /api/generate and /api/generate/stream accept the legacy
 * (business + topic) format and the current (goal + messages) format. A valid
 * request must supply either a non-empty `goal` or both a non-empty `business`
 * and `topic`; anything else (including an empty or malformed body) is
 * rejected BEFORE credits are reserved, so an invalid body can never mint a
 * paid generation.
 */

export interface CampaignMessage {
  role: string;
  content: string;
  displayContent?: string;
}

export interface ParsedCampaignRequest {
  goal: string;
  messages: CampaignMessage[];
}

function isCampaignMessage(value: unknown): value is CampaignMessage {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.role === 'string' && typeof record.content === 'string';
}

export function parseCampaignRequest(body: Record<string, unknown>): ParsedCampaignRequest | null {
  const goal = typeof body.goal === 'string' ? body.goal.trim() : '';
  const business = typeof body.business === 'string' ? body.business.trim() : '';
  const topic = typeof body.topic === 'string' ? body.topic.trim() : '';
  const messages = Array.isArray(body.messages) ? body.messages.filter(isCampaignMessage) : [];

  if (goal) return { goal, messages };
  if (business && topic) {
    return {
      goal: `Create a campaign for a ${business} focusing on ${topic}`,
      messages,
    };
  }
  return null;
}
