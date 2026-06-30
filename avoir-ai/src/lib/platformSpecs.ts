/**
 * Avoir — Platform Specification Constants & Utilities
 * 
 * Enforced character limits for every major ad platform.
 * This is what agencies charge $5K+/month for — platform-native copy.
 */

// ============================================================================
// PLATFORM SPEC CONSTANTS
// ============================================================================

export interface FieldSpec {
  maxChars: number;
  label: string;
  required?: boolean;
}

export interface PlatformSpec {
  name: string;
  icon: string; // emoji for quick rendering
  color: string; // tailwind color class
  fields: Record<string, FieldSpec>;
}

export const PLATFORM_SPECS: Record<string, PlatformSpec> = {
  meta_ads: {
    name: 'Meta Ads',
    icon: '📘',
    color: 'blue',
    fields: {
      headline: { maxChars: 40, label: 'Headline', required: true },
      primaryText: { maxChars: 125, label: 'Primary Text', required: true },
      description: { maxChars: 30, label: 'Description' },
      linkDescription: { maxChars: 30, label: 'Link Description' },
    },
  },
  google_ads: {
    name: 'Google Ads',
    icon: '🔍',
    color: 'green',
    fields: {
      headline1: { maxChars: 30, label: 'Headline 1', required: true },
      headline2: { maxChars: 30, label: 'Headline 2', required: true },
      headline3: { maxChars: 30, label: 'Headline 3' },
      description1: { maxChars: 90, label: 'Description 1', required: true },
      description2: { maxChars: 90, label: 'Description 2' },
    },
  },
  instagram: {
    name: 'Instagram',
    icon: '📸',
    color: 'pink',
    fields: {
      caption: { maxChars: 2200, label: 'Caption', required: true },
      hashtags: { maxChars: 200, label: 'Hashtags' },
      storyText: { maxChars: 200, label: 'Story Overlay' },
    },
  },
  linkedin: {
    name: 'LinkedIn',
    icon: '💼',
    color: 'sky',
    fields: {
      postText: { maxChars: 3000, label: 'Post', required: true },
      articleTitle: { maxChars: 150, label: 'Article Title' },
      adHeadline: { maxChars: 120, label: 'Ad Headline' },
    },
  },
  tiktok: {
    name: 'TikTok',
    icon: '🎵',
    color: 'purple',
    fields: {
      caption: { maxChars: 2200, label: 'Caption', required: true },
      hashtags: { maxChars: 100, label: 'Hashtags' },
      hookLine: { maxChars: 50, label: 'First 3s Hook', required: true },
    },
  },
  email: {
    name: 'Email',
    icon: '📧',
    color: 'amber',
    fields: {
      subjectLine: { maxChars: 60, label: 'Subject Line', required: true },
      preheader: { maxChars: 100, label: 'Preheader', required: true },
      bodyCTA: { maxChars: 500, label: 'Body CTA Block' },
    },
  },
};

// ============================================================================
// VALIDATION
// ============================================================================

export interface ValidationResult {
  field: string;
  status: 'ok' | 'warning' | 'error';
  charCount: number;
  maxChars: number;
  message?: string;
}

export function validatePlatformCopy(
  platform: string,
  copy: Record<string, string>
): ValidationResult[] {
  const spec = PLATFORM_SPECS[platform];
  if (!spec) return [];

  return Object.entries(spec.fields).map(([fieldKey, fieldSpec]) => {
    const text = copy[fieldKey] || '';
    const charCount = text.length;
    const ratio = charCount / fieldSpec.maxChars;

    if (charCount === 0 && fieldSpec.required) {
      return { field: fieldKey, status: 'error' as const, charCount, maxChars: fieldSpec.maxChars, message: `${fieldSpec.label} is required` };
    }
    if (charCount > fieldSpec.maxChars) {
      return { field: fieldKey, status: 'error' as const, charCount, maxChars: fieldSpec.maxChars, message: `${charCount - fieldSpec.maxChars} chars over limit` };
    }
    if (ratio > 0.9) {
      return { field: fieldKey, status: 'warning' as const, charCount, maxChars: fieldSpec.maxChars, message: 'Near character limit' };
    }
    return { field: fieldKey, status: 'ok' as const, charCount, maxChars: fieldSpec.maxChars };
  });
}

// ============================================================================
// SMART TRUNCATION
// ============================================================================

export function truncateToSpec(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;

  // Try to cut at word boundary
  const truncated = text.substring(0, maxChars - 1);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > maxChars * 0.7) {
    return truncated.substring(0, lastSpace) + '…';
  }

  return truncated + '…';
}

// ============================================================================
// GENERATE PLATFORM VARIANTS FROM CAMPAIGN DATA
// ============================================================================

export function generatePlatformVariants(
  campaign: { hook: string; offer: string; cta: string; captions?: string[] }
): Record<string, Record<string, string>> {
  const caption = campaign.captions?.[0] || '';

  return {
    meta_ads: {
      headline: truncateToSpec(campaign.hook, 40),
      primaryText: truncateToSpec(`${campaign.hook} ${campaign.offer}`, 125),
      description: truncateToSpec(campaign.cta, 30),
      linkDescription: truncateToSpec(campaign.offer, 30),
    },
    google_ads: {
      headline1: truncateToSpec(campaign.hook, 30),
      headline2: truncateToSpec(campaign.offer, 30),
      headline3: truncateToSpec(campaign.cta, 30),
      description1: truncateToSpec(`${campaign.hook} ${campaign.offer} ${campaign.cta}`, 90),
      description2: truncateToSpec(caption, 90),
    },
    instagram: {
      caption: `${campaign.hook}\n\n${campaign.offer}\n\n${campaign.cta}`,
      hashtags: '',
      storyText: truncateToSpec(campaign.hook, 200),
    },
    linkedin: {
      postText: `${campaign.hook}\n\n${campaign.offer}\n\n${campaign.cta}\n\n${caption}`,
      articleTitle: truncateToSpec(campaign.hook, 150),
      adHeadline: truncateToSpec(campaign.hook, 120),
    },
    tiktok: {
      caption: `${campaign.hook} ${campaign.offer}`,
      hashtags: '',
      hookLine: truncateToSpec(campaign.hook, 50),
    },
    email: {
      subjectLine: truncateToSpec(campaign.hook, 60),
      preheader: truncateToSpec(campaign.offer, 100),
      bodyCTA: `${campaign.hook}\n\n${campaign.offer}\n\n👉 ${campaign.cta}`,
    },
  };
}

// ============================================================================
// EXPORT HELPERS
// ============================================================================

export function exportAsCSV(variants: Record<string, Record<string, string>>): string {
  const rows: string[] = ['Platform,Field,Content,CharCount,MaxChars'];

  Object.entries(variants).forEach(([platform, fields]) => {
    const spec = PLATFORM_SPECS[platform];
    if (!spec) return;

    Object.entries(fields).forEach(([fieldKey, value]) => {
      const fieldSpec = spec.fields[fieldKey];
      if (!fieldSpec) return;
      const escaped = `"${value.replace(/"/g, '""').replace(/\n/g, ' ')}"`;
      rows.push(`${spec.name},${fieldSpec.label},${escaped},${value.length},${fieldSpec.maxChars}`);
    });
  });

  return rows.join('\n');
}

export function exportAsJSON(variants: Record<string, Record<string, string>>): string {
  return JSON.stringify(variants, null, 2);
}
