/**
 * Avoir — Shared Daily Alpha Brief contract.
 *
 * Single source of truth for the Daily Alpha Brief shape used by:
 *   - backend/alpha_brief_generator.py (writes to Redis)
 *   - avoir-ai/src/lib/db/cache.ts (Redis cache layer)
 *   - avoir-ai/src/app/api/alpha-brief/route.ts (API boundary)
 *   - avoir-ai/src/components/DailyAlphaBrief.tsx (UI consumer)
 *
 * Keep the field names in sync with the Python generator's cache contract.
 */

export const VALID_MOMENTUM = ['spiking', 'rising', 'peaking', 'sustained'] as const;
export type Momentum = (typeof VALID_MOMENTUM)[number];

export interface AlphaBrief {
  date?: string;
  trend: {
    title: string;
    description: string;
    momentum: Momentum;
  };
  brief: {
    plan: {
      hook: string;
      offer: string;
      cta: string;
    };
    captions?: string[];
  };
  generated_by?: string;
  generated_at?: string;
}

export function isAlphaBrief(value: unknown): value is AlphaBrief {
  if (!value || typeof value !== 'object') return false;

  const v = value as Record<string, unknown>;
  const trend = v.trend as Record<string, unknown> | undefined;
  const brief = v.brief as Record<string, unknown> | undefined;
  const plan = brief?.plan as Record<string, unknown> | undefined;

  if (!trend || typeof trend.title !== 'string' || typeof trend.description !== 'string') {
    return false;
  }
  if (!VALID_MOMENTUM.includes(trend.momentum as Momentum)) {
    return false;
  }
  if (!brief) return false;
  if (
    !plan ||
    typeof plan.hook !== 'string' ||
    typeof plan.offer !== 'string' ||
    typeof plan.cta !== 'string'
  ) {
    return false;
  }
  return true;
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'unknown error';
}
