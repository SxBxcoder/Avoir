import { NextResponse } from 'next/server';
import { fetchCompetitorIntel } from '@/lib/db/competitors';
import { isDemoMode, MOCK_COMPETITOR_INTEL } from '@/lib/mockShield';

export async function GET(req: Request) {
  // Demo Mock Shield
  if (isDemoMode()) {
    return NextResponse.json({ intel: MOCK_COMPETITOR_INTEL });
  }

  try {
    const { searchParams } = new URL(req.url);
    const industry = searchParams.get('industry');

    if (!industry) {
      return NextResponse.json(
        { error: 'Missing required parameter: industry' },
        { status: 400 }
      );
    }

    const intel = await fetchCompetitorIntel(industry);

    if (!intel) {
      return NextResponse.json({ intel: null, message: 'No competitor data found for this industry.' });
    }

    return NextResponse.json({ intel });
  } catch (error: any) {
    console.error('[Competitors API] GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch competitor intel' },
      { status: 500 }
    );
  }
}
