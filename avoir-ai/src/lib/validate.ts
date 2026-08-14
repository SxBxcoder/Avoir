import type { NextRequest } from 'next/server';
import type { z } from 'zod';

/**
 * Parse a JSON request body against a zod schema.
 *
 * Returns the validated, typed data or a list of human-readable issue
 * messages. A malformed/non-JSON body also yields `issues`, so routes can
 * respond 400 instead of crashing. Call AFTER authentication so a bad body
 * can't mask a 401/403.
 */
export async function parseJsonBody<TSchema extends z.ZodTypeAny>(
  req: Request | NextRequest,
  schema: TSchema
): Promise<{ ok: true; data: z.infer<TSchema> } | { ok: false; issues: string[] }> {
  const body: unknown = await req.json().catch(() => ({}));
  const result = schema.safeParse(body);
  if (result.success) return { ok: true, data: result.data };
  return { ok: false, issues: result.error.issues.map((issue) => issue.message) };
}
