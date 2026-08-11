/**
 * Avoir — Link email to the verified Cognito sub.
 *
 * POST /api/auth/link-email
 * Body: { email }
 *
 * The frontend calls this once per authenticated session. The verified sub
 * comes from the JWT; the email comes from the client's ID token (access
 * tokens don't carry email by default). It stores a sub → email alias and
 * runs the one-time legacy migration (email-keyed → sub-keyed rows).
 *
 * The email is only used as a lookup key to find the user's own legacy rows —
 * it is never trusted for authorization.
 */

import { NextResponse } from 'next/server';
import { isDemoMode } from '@/lib/mockShield';
import { requireUser, authErrorResponse } from '@/lib/auth/requireUser';
import { setEmailAlias } from '@/lib/db/aliases';
import { migrateLegacyUser } from '@/lib/auth/migrateUser';

export async function POST(req: Request) {
  if (isDemoMode()) {
    return NextResponse.json({ success: true, migrated: false, demo: true });
  }

  try {
    // Identity always comes from the verified Cognito JWT.
    const { userId } = await requireUser(req);

    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim() : '';

    if (!email || email.length > 254 || !email.includes('@')) {
      return NextResponse.json({ error: 'Missing or invalid email' }, { status: 400 });
    }

    await setEmailAlias(userId, email);
    const migrated = await migrateLegacyUser(userId, email);

    return NextResponse.json({ success: true, migrated });
  } catch (error: any) {
    const authErr = authErrorResponse(error);
    if (authErr) return authErr;
    console.error('[Link Email] Error:', error);
    return NextResponse.json({ error: 'Failed to link email' }, { status: 500 });
  }
}
