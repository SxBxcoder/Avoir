import { NextResponse } from 'next/server';
import { getBrandDNA, saveBrandDNA, type BrandDNA } from '@/lib/db/brandDna';
import { isDemoMode, MOCK_BRAND_DNA } from '@/lib/mockShield';
import { requireUser, authErrorResponse } from '@/lib/auth/requireUser';
import { logger } from '@/lib/logger';

// Only these fields are ever persisted — a client can't mass-assign unknown
// columns onto the record.
const DNA_FIELDS = [
  'brandName',
  'industry',
  'targetAudience',
  'toneOfVoice',
  'coreValues',
  'uniqueSellingProposition',
  'referenceUrl',
] as const;

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
    logger.error('brand-dna', 'GET failed', { err: error });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  // Demo Mock Shield
  if (isDemoMode()) {
    return NextResponse.json({ success: true, dna: MOCK_BRAND_DNA });
  }

  try {
    // Identity comes from the verified Cognito JWT, not the request body.
    const { userId } = await requireUser(req);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    // Allowlist: copy only known string fields, ignoring everything else.
    const dna: Partial<Omit<BrandDNA, 'userId' | 'updatedAt'>> = {};
    for (const field of DNA_FIELDS) {
      const value = body[field];
      if (typeof value === 'string') {
        (dna as Record<string, unknown>)[field] = value;
      }
    }

    if (!dna.brandName || !dna.industry) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const savedDNA = await saveBrandDNA(userId, dna as Omit<BrandDNA, 'userId' | 'updatedAt'>);
    return NextResponse.json({ success: true, dna: savedDNA });
  } catch (error: any) {
    const authErr = authErrorResponse(error);
    if (authErr) return authErr;
    logger.error('brand-dna', 'POST failed', { err: error });
    return NextResponse.json({ error: 'Failed to save Brand DNA' }, { status: 500 });
  }
}
