import { NextResponse } from 'next/server';
import { deductCredits } from '@/lib/db/users';
import { isDemoMode } from '@/lib/mockShield';
import { requireUser, authErrorResponse } from '@/lib/auth/requireUser';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { parseJsonBody } from '@/lib/validate';

const PUBLISH_COST = 5;

const publishSchema = z.object({
  campaign_id: z.string().min(1),
  platforms: z.array(z.string().min(1)).min(1),
});

export async function POST(request: Request) {
  // Demo Mock Shield
  if (isDemoMode()) {
    return NextResponse.json({ 
        status: 'success', 
        message: 'Successfully published! (Demo Mode)',
        cost: 0
    });
  }

  try {
    // Identity comes from the verified Cognito JWT, not the request body.
    const { userId } = await requireUser(request);

    const parsed = await parseJsonBody(request, publishSchema);
    if (!parsed.ok) {
      return NextResponse.json({ error: 'Invalid request body', issues: parsed.issues }, { status: 400 });
    }
    const { campaign_id, platforms: platformList } = parsed.data;

    logger.info('publish', 'Attempting to publish campaign', { campaignId: campaign_id, platforms: platformList });

    // Deduct credits for publishing (atomic + conditional: only succeeds when
    // the balance covers the cost)
    const { success } = await deductCredits(userId, PUBLISH_COST);
    
    if (!success) {
      return NextResponse.json({ 
        error: 'Insufficient credits',
        details: `Publishing costs ${PUBLISH_COST} credits.`
      }, { status: 402 });
    }

    // TODO: In a real environment, trigger a Zapier/Make webhook here
    // Example:
    // await fetch(process.env.ZAPIER_WEBHOOK_URL, { method: 'POST', body: JSON.stringify({ campaign_id, platforms }) });
    
    // Simulate slight delay for "Network"
    await new Promise(resolve => setTimeout(resolve, 1500));

    logger.info('publish', 'Campaign published', { creditsDeducted: PUBLISH_COST });

    return NextResponse.json({ 
        status: 'success', 
        message: 'Successfully published!',
        cost: PUBLISH_COST
    });

  } catch (error: unknown) {
    const authErr = authErrorResponse(error);
    if (authErr) return authErr;
    logger.error('publish', 'Publishing failed', { err: error });
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
