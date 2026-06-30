/**
 * Avoir — Intelligence Brief Repository
 * 
 * The Campaign Memory Flywheel.
 * This stores the compounding "brain" for a user's brand. It learns what they like,
 * what formats work best, and what to avoid, aggregating over time.
 * 
 * Table: avoir-intelligence
 *   PK: userId (string)
 */

import { PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { getDynamoClient, TABLES } from './dynamodb';

// ============================================================================
// TYPES
// ============================================================================

export interface IntelligenceBrief {
  userId: string;
  level: 'BRONZE' | 'SILVER' | 'GOLD' | 'DIAMOND';
  totalCampaignsGenerated: number;
  successfulFormats: string[];
  avoidedFormats: string[];
  audienceInsights: string[];
  lastUpdated: string;
}

// ============================================================================
// READ — Get Intelligence Brief
// ============================================================================

export async function getIntelligenceBrief(userId: string): Promise<IntelligenceBrief | null> {
  const client = getDynamoClient();

  try {
    const result = await client.send(
      new GetCommand({
        TableName: TABLES.INTELLIGENCE,
        Key: { userId },
      })
    );

    return (result.Item as IntelligenceBrief) || null;
  } catch (err: any) {
    console.error(`[DB] Fetch intelligence brief failed: ${err.message}`);
    return null;
  }
}

// ============================================================================
// WRITE — Update Intelligence Brief
// ============================================================================

export async function updateIntelligenceBrief(
  userId: string,
  updates: Partial<Omit<IntelligenceBrief, 'userId'>>
): Promise<IntelligenceBrief> {
  const client = getDynamoClient();
  const current = await getIntelligenceBrief(userId);
  const now = new Date().toISOString();

  const brief: IntelligenceBrief = {
    userId,
    level: updates.level || current?.level || 'BRONZE',
    totalCampaignsGenerated: (current?.totalCampaignsGenerated || 0) + (updates.totalCampaignsGenerated || 0),
    successfulFormats: Array.from(new Set([...(current?.successfulFormats || []), ...(updates.successfulFormats || [])])),
    avoidedFormats: Array.from(new Set([...(current?.avoidedFormats || []), ...(updates.avoidedFormats || [])])),
    audienceInsights: Array.from(new Set([...(current?.audienceInsights || []), ...(updates.audienceInsights || [])])),
    lastUpdated: now,
  };

  // Determine Level based on total campaigns
  if (brief.totalCampaignsGenerated >= 50) brief.level = 'DIAMOND';
  else if (brief.totalCampaignsGenerated >= 20) brief.level = 'GOLD';
  else if (brief.totalCampaignsGenerated >= 5) brief.level = 'SILVER';
  else brief.level = 'BRONZE';

  try {
    await client.send(
      new PutCommand({
        TableName: TABLES.INTELLIGENCE,
        Item: brief,
      })
    );
  } catch (err: any) {
    console.error(`[DB] Update intelligence brief failed: ${err.message}`);
  }

  return brief;
}

// ============================================================================
// FORMAT FOR LLM
// ============================================================================

export function formatIntelligenceForPrompt(brief: IntelligenceBrief): string {
  if (!brief || brief.level === 'BRONZE') return '';

  const formats = brief.successfulFormats.length > 0
    ? `\n- PROVEN FORMATS (Use these): ${brief.successfulFormats.join(', ')}`
    : '';

  const avoids = brief.avoidedFormats.length > 0
    ? `\n- AVOID THESE (They failed previously): ${brief.avoidedFormats.join(', ')}`
    : '';

  const insights = brief.audienceInsights.length > 0
    ? `\n- AUDIENCE PSYCHOLOGY: ${brief.audienceInsights.join(' | ')}`
    : '';

  return `INTELLIGENCE BRIEF (Level: ${brief.level}):
This brand has generated ${brief.totalCampaignsGenerated} campaigns. We have learned the following about their audience:${formats}${avoids}${insights}`;
}
