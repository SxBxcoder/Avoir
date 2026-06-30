import { NextResponse } from 'next/server';
import { getBrandDNA, saveBrandDNA } from '@/lib/db/brandDna';
import { isDemoMode, MOCK_BRAND_DNA } from '@/lib/mockShield';

export async function GET(req: Request) {
  // Demo Mock Shield
  if (isDemoMode()) {
    return NextResponse.json({ dna: MOCK_BRAND_DNA });
  }

  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const dna = await getBrandDNA(userId);
    return NextResponse.json({ dna });
  } catch (error: any) {
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
    const { userId, ...dna } = body;

    if (!userId || !dna.brandName || !dna.industry) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const savedDNA = await saveBrandDNA(userId, dna);
    return NextResponse.json({ success: true, dna: savedDNA });
  } catch (error: any) {
    console.error('[POST /api/brand-dna] Error:', error);
    return NextResponse.json({ error: 'Failed to save Brand DNA' }, { status: 500 });
  }
}
