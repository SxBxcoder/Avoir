/**
 * Avoir — Link email to the verified Cognito sub.
 *
 * POST /api/auth/link-email
 *
 * The frontend calls this once per authenticated session, sending the Cognito
 * ID token in the Authorization header. The email comes from the VERIFIED ID
 * token claim (`email_verified === true`) — the request body is ignored, so a
 * caller can never run the legacy migration under an email that is not their
 * own (which would copy another user's email-keyed rows into their sub and
 * delete the originals).
 *
 * It stores a sub → email alias and runs the one-time legacy migration
 * (email-keyed → sub-keyed rows).
 */

import { NextResponse } from 'next/server';
import { isDemoMode } from '@/lib/mockShield';
import { requireUserEmail, authErrorResponse } from '@/lib/auth/requireUser';
import { setEmailAlias } from '@/lib/db/aliases';
import { migrateLegacyUser } from '@/lib/auth/migrateUser';

export async function POST(req: Request) {
  if (isDemoMode()) {
    return NextResponse.json({ success: true, migrated: false, demo: true });
  }

  try {
    const { userId, email } = await requireUserEmail(req);

    await setEmailAlias(userId, email);
    const migrated = await migrateLegacyUser(userId, email);

    return NextResponse.json({ success: true, migrated });
  } catch (error: unknown) {
    const authErr = authErrorResponse(error);
    if (authErr) return authErr;
    console.error('[Link Email] Error:', error);
    return NextResponse.json({ error: 'Failed to link email' }, { status: 500 });
  }
}
