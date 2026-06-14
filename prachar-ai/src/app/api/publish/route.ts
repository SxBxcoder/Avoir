import { NextResponse } from 'next/server';
import { deductCredits } from '@/lib/db/users';

const PUBLISH_COST = 5;

export async function POST(request: Request) {
  try {
    const { userId, campaign_id, platforms } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!platforms || platforms.length === 0) {
        return NextResponse.json({ error: 'No platforms selected' }, { status: 400 });
    }

    console.log(`[AutoPublish] Attempting to publish campaign ${campaign_id} to ${platforms.join(', ')} for user ${userId}`);

    // Deduct credits for publishing
    const success = await deductCredits(userId, PUBLISH_COST);
    
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

    console.log(`[AutoPublish] ✅ Successfully published! Deducted ${PUBLISH_COST} credits.`);

    return NextResponse.json({ 
        status: 'success', 
        message: 'Successfully published!',
        cost: PUBLISH_COST
    });

  } catch (error: any) {
    console.error('Publishing error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
