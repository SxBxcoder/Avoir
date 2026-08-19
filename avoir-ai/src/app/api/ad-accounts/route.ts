/**
 * Avoir — Ad Account Linking API
 *
 * POST /api/ad-accounts   — Link a Meta or Google ad account
 * GET  /api/ad-accounts   — List all linked ad accounts
 * DELETE /api/ad-accounts — Unlink an ad account
 *
 * Auth: Cognito JWT via Authorization header.
 */

import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/requireUser';
import { linkAdAccount, getLinkedAccounts, unlinkAdAccount, type AdPlatform } from '@/lib/db/adAccounts';
import { isDemoMode } from '@/lib/mockShield';
import { logger } from '@/lib/logger';

const VALID_PLATFORMS: AdPlatform[] = ['meta', 'google'];

// ============================================================================
// POST — Link an ad account
// ============================================================================

export async function POST(req: Request) {
  if (isDemoMode()) {
    return NextResponse.json({ error: 'Ad account linking is not available in demo mode' }, { status: 400 });
  }

  const auth = await requireUser(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { userId } = auth;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { platform, accountId, accountName, accessToken } = body;

  if (!platform || !VALID_PLATFORMS.includes(platform)) {
    return NextResponse.json({ error: `platform must be one of: ${VALID_PLATFORMS.join(', ')}` }, { status: 400 });
  }
  if (!accountId || typeof accountId !== 'string') {
    return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
  }
  if (!accountName || typeof accountName !== 'string') {
    return NextResponse.json({ error: 'accountName is required' }, { status: 400 });
  }

  try {
    const account = await linkAdAccount(userId, platform, accountId, accountName, accessToken);
    return NextResponse.json({ ok: true, account });
  } catch (err) {
    logger.error('api.ad-accounts', 'Link failed', { err });
    return NextResponse.json({ error: 'Failed to link account' }, { status: 500 });
  }
}

// ============================================================================
// GET — List linked accounts
// ============================================================================

export async function GET(req: Request) {
  if (isDemoMode()) {
    return NextResponse.json({ accounts: [] });
  }

  const auth = await requireUser(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { userId } = auth;

  try {
    const accounts = await getLinkedAccounts(userId);
    // Strip access tokens from response
    const safe = accounts.map(({ accessToken, ...rest }) => rest);
    return NextResponse.json({ accounts: safe });
  } catch (err) {
    logger.error('api.ad-accounts', 'List failed', { err });
    return NextResponse.json({ error: 'Failed to list accounts' }, { status: 500 });
  }
}

// ============================================================================
// DELETE — Unlink an ad account
// ============================================================================

export async function DELETE(req: Request) {
  if (isDemoMode()) {
    return NextResponse.json({ error: 'Not available in demo mode' }, { status: 400 });
  }

  const auth = await requireUser(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { userId } = auth;

  const url = new URL(req.url);
  const platformAccountId = url.searchParams.get('id');
  if (!platformAccountId) {
    return NextResponse.json({ error: 'id query param is required' }, { status: 400 });
  }

  try {
    const ok = await unlinkAdAccount(userId, platformAccountId);
    return NextResponse.json({ ok });
  } catch (err) {
    logger.error('api.ad-accounts', 'Unlink failed', { err });
    return NextResponse.json({ error: 'Failed to unlink account' }, { status: 500 });
  }
}
