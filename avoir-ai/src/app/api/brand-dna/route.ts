import { NextResponse } from 'next/server';
import { getBrandDNA, saveBrandDNA } from '@/lib/db/brandDna';
import { isDemoMode, MOCK_BRAND_DNA } from '@/lib/mockShield';
import { requireUser, authErrorResponse } from '@/lib/auth/requireUser';

export async function GET(req: Request) {
  // Demo Mock Shield
  if (isDemoMode()) {
    return NextResponse.json({ dna: MOCK_BRAND_DNA });
  }

  try {
    // Identity comes from the verified Cognito JWT, not the query string.
    const { userId } = await requireUser(req);

    const dna = await getBrandDNA(userId);
    return NextResponse.json({ dna });
  } catch (error: any) {
    const authErr = authErrorResponse(error);
    if (authErr) return authErr;
    console.error('[GET /api/brand-dna] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  // Demo Mock Shield
  if (isDemoMode()) {
    return NextResponse.json({ success: true, dna: MOCK_BRAND_DNA });
  }

  try {
    const body = await req.json();
    const { ...dna } = body;

    if (!dna.brandName || !dna.industry) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Identity comes from the verified Cognito JWT, not the request body.
    const { userId } = await requireUser(req);

    const savedDNA = await saveBrandDNA(userId, dna);
    return NextResponse.json({ success: true, dna: savedDNA });
  } catch (error: any) {
    const authErr = authErrorResponse(error);
    if (authErr) return authErr;
    console.error('[POST /api/brand-dna] Error:', error);
    return NextResponse.json({ error: 'Failed to save Brand DNA' }, { status: 500 });
  }
}
