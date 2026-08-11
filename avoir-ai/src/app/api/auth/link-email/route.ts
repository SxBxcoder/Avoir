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
import { getEmailAlias, setEmailAlias } from '@/lib/db/aliases';
import { migrateLegacyUser } from '@/lib/auth/migrateUser';
import { logger } from '@/lib/logger';

export async function POST(req: Request) {
  if (isDemoMode()) {
    return NextResponse.json({ success: true, migrated: false, demo: true });
  }

  try {
    const { userId, email } = await requireUserEmail(req);

    // Early-return when this sub is already linked to the same email. Without
    // this, every page load fires 5+ DynamoDB reads (and a write) for users
    // who were never legacy users or migrated long ago.
    const existing = await getEmailAlias(userId);
    if (existing && existing.toLowerCase() === email.toLowerCase()) {
      return NextResponse.json({ success: true, migrated: false, alreadyLinked: true });
    }

    await setEmailAlias(userId, email);
    const migrated = await migrateLegacyUser(userId, email);

    return NextResponse.json({ success: true, migrated });
  } catch (error: unknown) {
    const authErr = authErrorResponse(error);
    if (authErr) return authErr;
    logger.error('link-email', 'Link email failed', { err: error });
    return NextResponse.json({ error: 'Failed to link email' }, { status: 500 });
  }
}
