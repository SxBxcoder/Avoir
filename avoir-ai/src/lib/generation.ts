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

export interface ParsedCampaignRequest {
  goal: string;
  messages: unknown[];
}

export function parseCampaignRequest(body: Record<string, unknown>): ParsedCampaignRequest | null {
  const goal = typeof body.goal === 'string' ? body.goal.trim() : '';
  const business = typeof body.business === 'string' ? body.business.trim() : '';
  const topic = typeof body.topic === 'string' ? body.topic.trim() : '';
  const messages = Array.isArray(body.messages) ? body.messages : [];

  if (goal) return { goal, messages };
  if (business && topic) {
    return {
      goal: `Create a campaign for a ${business} focusing on ${topic}`,
      messages,
    };
  }
  return null;
}
