import { NextResponse } from 'next/server';
import { getBrandDNA, saveBrandDNA, type BrandDNA } from '@/lib/db/brandDna';
import { isDemoMode, MOCK_BRAND_DNA } from '@/lib/mockShield';
import { requireUser, authErrorResponse } from '@/lib/auth/requireUser';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { parseJsonBody } from '@/lib/validate';

// Only these fields are ever accepted — zod strips unknown keys, so a client
// can't mass-assign arbitrary columns onto the record.
const brandDnaSchema = z.object({
  brandName: z.string().optional(),
  industry: z.string().optional(),
  targetAudience: z.string().optional(),
  toneOfVoice: z.string().optional(),
  coreValues: z.string().optional(),
  uniqueSellingProposition: z.string().optional(),
  referenceUrl: z.string().optional(),
});

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

    const parsed = await parseJsonBody(req, brandDnaSchema);
    if (!parsed.ok) {
      return NextResponse.json({ error: 'Invalid request body', issues: parsed.issues }, { status: 400 });
    }
    const dna: Partial<Omit<BrandDNA, 'userId' | 'updatedAt'>> = parsed.data;

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
