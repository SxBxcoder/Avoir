/**
 * Avoir — Demo Mock Shield
 * 
 * When NEXT_PUBLIC_DEMO_MODE=true, all API routes return this curated mock data
 * instead of calling real DynamoDB, Redis, Lambda, or Stripe services.
 * 
 * This lets you record a flawless demo video without any external APIs configured.
 */

// ============================================================================
// DEMO MODE CHECK
// ============================================================================

export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
}

// ============================================================================
// MOCK SUBSCRIPTION (Enterprise Tier — looks impressive on camera)
// ============================================================================

export const MOCK_SUBSCRIPTION = {
  userId: 'demo-commander',
  tier: 'enterprise' as const,
  status: 'active',
  credits: 847,
  campaignsUsedThisMonth: 153,
  currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  cancelAtPeriodEnd: false,
  stripeCustomerId: 'cus_demo_enterprise',
  stripeSubscriptionId: 'sub_demo_enterprise',
  lastResetDate: new Date().toISOString(),
};

// ============================================================================
// MOCK CAMPAIGN HISTORY (5 realistic campaigns)
// ============================================================================

export const MOCK_CAMPAIGNS = [
  {
    campaignId: 'camp-demo-001',
    userId: 'demo-commander',
    goal: 'Launch a viral Gen-Z campaign for a sustainable fashion brand targeting Instagram and TikTok',
    plan: {
      hook: 'Your closet is a landfill. We made the exit.',
      offer: 'First 500 members get lifetime access to our Capsule Exchange — trade, swap, never waste.',
      cta: 'Join the Capsule →',
    },
    captions: [
      '🌍 Your style shouldn\'t cost the planet. Capsule Exchange is here — swap, trade, repeat. Link in bio.',
      'POV: You just traded 3 pieces you never wore for a vintage Acne Studios jacket. That\'s Capsule. #SustainableFashion',
      'Gen-Z is done with fast fashion. We built the alternative. 500 spots left →',
    ],
    imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800',
    status: 'completed',
    tier: 'TIER_3_CRUCIBLE',
    isWinner: true,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    campaignId: 'camp-demo-002',
    userId: 'demo-commander',
    goal: 'Create a high-converting ad for an AI productivity tool aimed at solopreneurs',
    plan: {
      hook: 'You\'re not lazy. You\'re just doing 47 jobs manually.',
      offer: 'Automate your entire back-office in 11 minutes. No code. No meetings. Just results.',
      cta: 'Start Automating Free →',
    },
    captions: [
      '⚡ Solopreneurs: stop burning hours on invoices, follow-ups, and scheduling. Let AI handle it while you build.',
      'I replaced 3 freelancers with one tool. Here\'s the honest breakdown 🧵 #Solopreneur #AI',
      'The average solopreneur wastes 23 hours/week on admin. We cut that to 2. Try it free →',
    ],
    imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800',
    status: 'completed',
    tier: 'TIER_3_CRUCIBLE',
    isWinner: false,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    campaignId: 'camp-demo-003',
    userId: 'demo-commander',
    goal: 'Design a premium launch campaign for a new fintech micro-investing app',
    plan: {
      hook: 'Wall Street doesn\'t want you investing $5. That\'s exactly why you should.',
      offer: 'Round up every purchase. Auto-invest the change. Watch $3/day become $14,000 in 5 years.',
      cta: 'Start With $1 →',
    },
    captions: [
      '💰 Imagine if every coffee you bought also bought you stock. That\'s micro-investing. That\'s us.',
      'Your spare change built a portfolio worth $14K. Not a drill. Here\'s the math 📊 #FinTok',
      'The barrier to investing was always the minimum. We made it $1. Your move →',
    ],
    imageUrl: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800',
    status: 'completed',
    tier: 'TIER_3_CRUCIBLE',
    isWinner: true,
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    campaignId: 'camp-demo-004',
    userId: 'demo-commander',
    goal: 'Build a brand awareness campaign for an artisanal Indian spice D2C brand going global',
    plan: {
      hook: 'Your "curry powder" is a lie. Real spice has a name, a village, and a farmer.',
      offer: 'Single-origin spice boxes from 12 Indian regions. Sourced directly. No middlemen. Pure flavor.',
      cta: 'Taste the Difference →',
    },
    captions: [
      '🌶️ The spice in your pantry has traveled through 6 middlemen. Ours traveled from one farmer\'s hands to yours.',
      'We visited 12 Indian villages to bring you spices that supermarkets can\'t. Unboxing video dropping tomorrow 📦',
      'From Kashmiri saffron to Guntur chillies — meet the farmers behind your flavor. #FarmToFork #IndianSpices',
    ],
    imageUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=800',
    status: 'completed',
    tier: 'TIER_3_CRUCIBLE',
    isWinner: false,
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    campaignId: 'camp-demo-005',
    userId: 'demo-commander',
    goal: 'Create a viral TikTok campaign for a mental health journaling app',
    plan: {
      hook: 'Therapy is $200/hour. Your notes app is free but chaotic. We\'re the middle ground.',
      offer: 'AI-guided journaling that actually tracks your patterns. 5 minutes a day. Real insights, not vibes.',
      cta: 'Start Your First Entry →',
    },
    captions: [
      '🧠 Your therapist sees you once a week. Your journal sees you every day. Make it count.',
      'I journaled for 30 days with AI guidance. Here\'s what I learned about my own patterns 🧵 #MentalHealth',
      'Not a replacement for therapy. A supplement that works at 3am when your therapist is asleep →',
    ],
    imageUrl: 'https://images.unsplash.com/photo-1517842645767-c639042777db?w=800',
    status: 'completed',
    tier: 'TIER_3_CRUCIBLE',
    isWinner: false,
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// ============================================================================
// MOCK INTELLIGENCE BRIEF
// ============================================================================

export const MOCK_INTELLIGENCE = {
  userId: 'demo-commander',
  level: 'DIAMOND',
  totalCampaignsGenerated: 153,
  successfulFormats: ['carousel-hook', 'ugc-style', 'controversy-bait', 'social-proof-stack'],
  avoidedFormats: ['long-form-essay', 'corporate-speak'],
  audienceInsights: [
    'Responds 3.2x better to questions vs statements in hooks',
    'Gen-Z audience prefers "anti-brand" positioning',
    'Conversion peaks on Thursdays 6-9pm IST',
    'Video content outperforms static by 2.8x on Instagram',
  ],
  lastUpdated: new Date().toISOString(),
};

// ============================================================================
// MOCK BRAND DNA
// ============================================================================

export const MOCK_BRAND_DNA = {
  userId: 'demo-commander',
  brandName: 'Avoir Demo Brand',
  industry: 'AI Marketing Technology',
  targetAudience: 'Gen-Z and Millennial entrepreneurs, solopreneurs, and D2C founders',
  toneOfVoice: 'Bold, irreverent, premium — like if Apple and Wendy\'s Twitter had a child',
  coreValues: 'Authenticity, Speed, Data-Driven Creativity',
  uniqueSellingProposition: 'The only AI that backtests your campaigns against synthetic focus groups before you spend a single dollar',
  createdAt: new Date().toISOString(),
};

// ============================================================================
// MOCK COMPETITOR INTEL
// ============================================================================

export const MOCK_COMPETITOR_INTEL = {
  industry: 'AI Marketing',
  competitors: [
    {
      name: 'Jasper AI',
      strategy: 'High-volume content generation, SEO-focused',
      weaknesses: ['Generic output', 'No campaign strategy layer', 'No performance feedback loop'],
      estimatedSpend: '$2.4M/mo on paid acquisition',
    },
    {
      name: 'Copy.ai',
      strategy: 'Freemium funnel, template-based workflows',
      weaknesses: ['Template fatigue', 'No multi-platform optimization', 'No synthetic testing'],
      estimatedSpend: '$1.8M/mo on paid acquisition',
    },
    {
      name: 'AdCreative.ai',
      strategy: 'Visual-first ad creative generation',
      weaknesses: ['No copy strategy engine', 'No campaign memory', 'Limited to display ads'],
      estimatedSpend: '$950K/mo on paid acquisition',
    },
  ],
  lastUpdated: new Date().toISOString(),
};

// ============================================================================
// MOCK PERFORMANCE DATA
// ============================================================================

export const MOCK_PERFORMANCE_HISTORY = [
  { campaignId: 'camp-demo-001', platform: 'instagram', metrics: { impressions: 145200, clicks: 8712, ctr: 6.0, conversions: 423, roas: 4.2, spend: 1250 }, reportedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() },
  { campaignId: 'camp-demo-001', platform: 'tiktok', metrics: { impressions: 312000, clicks: 18720, ctr: 6.0, conversions: 892, roas: 5.1, spend: 800 }, reportedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
  { campaignId: 'camp-demo-002', platform: 'linkedin', metrics: { impressions: 42000, clicks: 3360, ctr: 8.0, conversions: 156, roas: 3.8, spend: 620 }, reportedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
  { campaignId: 'camp-demo-003', platform: 'instagram', metrics: { impressions: 89000, clicks: 5340, ctr: 6.0, conversions: 312, roas: 4.5, spend: 950 }, reportedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString() },
  { campaignId: 'camp-demo-003', platform: 'twitter', metrics: { impressions: 67000, clicks: 2680, ctr: 4.0, conversions: 89, roas: 2.1, spend: 400 }, reportedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() },
];

export const MOCK_PERFORMANCE_INSIGHTS = {
  bestPlatform: 'TikTok',
  bestCTR: 8.0,
  avgROAS: 3.94,
  totalSpend: 4020,
  totalConversions: 1872,
  topPerformingHook: 'Your closet is a landfill. We made the exit.',
  recommendation: 'Double down on TikTok UGC-style content. Your Gen-Z audience responds 3.2x better to question-format hooks.',
};

// ============================================================================
// MOCK SSE STREAM — The heart of the demo
// ============================================================================

/** Creates a pre-scripted SSE ReadableStream that simulates the Diamond Cascade generation */
export function createMockSSEStream(genomeMode: boolean = false): ReadableStream {
  const encoder = new TextEncoder();

  const send = (controller: ReadableStreamDefaultController, event: string, data: any) => {
    controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
  };

  return new ReadableStream({
    async start(controller) {
      const statusMessages = [
        '🔥 Initializing Diamond Cascade Engine...',
        '📡 Establishing connection to Global Ad Exchanges...',
        '🔍 Scraping TikTok API for trending audio anomalies...',
        '📊 Analyzing Reddit sentiment on subcultures...',
        '🧠 Formulating Investment Thesis...',
        '⚡ Tier 1: Gemini Flash — Generating raw strategy...',
        '✍️ Crafting high-converting viral hooks...',
        '🎨 Composing visual assets with AI Director...',
        '🌌 Spawning Synthetic Focus Group...',
      ];

      // Stream cooking messages
      for (const msg of statusMessages) {
        send(controller, 'status', { message: msg, timestamp: Date.now() });
        await new Promise(r => setTimeout(r, 650));
      }

      // Simulation
      send(controller, 'simulation_start', { timestamp: Date.now() });
      await new Promise(r => setTimeout(r, 800));

      send(controller, 'simulation_result', {
        simulation: [
          { name: 'Priya S.', role: 'Gen-Z Consumer (Mumbai)', critique: 'The hook is genuinely disruptive. I\'d stop scrolling for this.', approved: true },
          { name: 'Marcus T.', role: 'D2C Brand Strategist', critique: 'Strong positioning against generic competitors. CTA could be more urgent.', approved: true },
          { name: 'Elena R.', role: 'Media Buyer ($2M/mo spend)', critique: 'This would scale on TikTok. The hook creates immediate pattern interrupt.', approved: true },
          { name: 'Raj K.', role: 'Skeptical CMO', critique: 'Bold claims need proof points. But the framework is solid for A/B testing.', approved: false },
        ],
        predicted_score: 91,
      });

      await new Promise(r => setTimeout(r, 600));
      send(controller, 'status', { message: '🎯 Backtesting complete. Compiling final validated assets...', timestamp: Date.now() });
      await new Promise(r => setTimeout(r, 400));

      if (genomeMode) {
        send(controller, 'genome', {
          variants: [
            {
              genome_type: 'virality',
              plan: {
                hook: 'Everyone\'s faking it on LinkedIn. We built the tool that actually works.',
                offer: '10,000 creators switched this month. The waitlist closes Friday.',
                cta: 'Skip the Line →',
                reasoning: { hook_rationale: 'Controversy + specificity = viral trigger', confidence_score: 94 },
              },
              captions: ['🔥 LinkedIn is a highlight reel. This is the real playbook.', 'POV: Your content actually converts now', 'The creator economy just got its cheat code →'],
              predicted_scores: { virality: 94, conversion: 72, authority: 61 },
            },
            {
              genome_type: 'conversion',
              plan: {
                hook: '3 campaigns. 47 minutes. $12,400 in revenue. Here\'s how.',
                offer: 'AI builds your campaign, tests it against synthetic focus groups, and deploys — all before your coffee gets cold.',
                cta: 'Generate Your First Campaign Free →',
                reasoning: { hook_rationale: 'Specific numbers + time frame = credibility engine', confidence_score: 89 },
              },
              captions: ['⚡ 47 minutes from idea to revenue. No agency. No guessing.', 'The ROI math: $0 → $12,400 in one afternoon', 'Your next campaign is one prompt away →'],
              predicted_scores: { virality: 68, conversion: 93, authority: 71 },
            },
            {
              genome_type: 'authority',
              plan: {
                hook: 'The best campaigns aren\'t written. They\'re engineered.',
                offer: 'Avoir uses the same quantitative testing framework as hedge funds — applied to your ad creative.',
                cta: 'See the Engine →',
                reasoning: { hook_rationale: 'Reframing creativity as engineering = premium positioning', confidence_score: 87 },
              },
              captions: ['🧬 Marketing is now a science. Welcome to the lab.', 'We don\'t guess. We test, iterate, and deploy.', 'Built for brands that think in ROI, not likes →'],
              predicted_scores: { virality: 58, conversion: 76, authority: 95 },
            },
          ],
          status: 'completed',
        });
      } else {
        send(controller, 'campaign', {
          hook: 'You\'re spending $10K/month on ads that a college intern could write. That\'s the real waste.',
          offer: 'Avoir generates, backtests, and deploys campaigns using the same quantitative models as hedge funds. One prompt. Full funnel. Zero guesswork.',
          cta: 'Deploy Your First Campaign →',
          reasoning: {
            hook_rationale: 'Pattern interrupt through uncomfortable truth. Challenges the status quo of agency spend.',
            offer_rationale: 'Positions AI as sophisticated (hedge fund comparison) while emphasizing simplicity (one prompt).',
            cta_rationale: '"Deploy" language matches the premium, tactical brand voice. Action-oriented.',
            confidence_score: 91,
            audience_insight: 'D2C founders spending $5K-50K/month on ads are the sweet spot. They feel the pain of generic copy but can\'t afford a top-tier agency.',
          },
          captions: [
            '💀 Your ad agency charges $15K/month for copy that AI generates in 47 seconds. Let that sink in.',
            'POV: You just replaced your entire creative team with one prompt. And the ROAS went UP. #AIMarketing',
            'We backtested this campaign against 4 synthetic personas before spending a single dollar. The future of advertising is here →',
          ],
          imageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800',
          campaignId: `demo-live-${Date.now()}`,
          status: 'completed',
        });
      }

      send(controller, 'done', { success: true });
      controller.close();
    },
  });
}

// ============================================================================
// MOCK ENGAGEMENT STREAM (for Omni-Deck Intelligence tab)
// ============================================================================

export function createMockEngagementStream(): ReadableStream {
  const encoder = new TextEncoder();
  const platforms = ['TikTok', 'Instagram', 'LinkedIn', 'Twitter', 'YouTube'];
  const actions = ['liked', 'shared', 'commented', 'saved', 'clicked CTA', 'followed'];
  const names = ['Aanya M.', 'Raj P.', 'Sarah K.', 'Li Wei', 'James O.', 'Priya S.', 'Alex T.', 'Maria G.'];

  return new ReadableStream({
    async start(controller) {
      for (let i = 0; i < 20; i++) {
        const engagement = {
          platform: platforms[Math.floor(Math.random() * platforms.length)],
          action: actions[Math.floor(Math.random() * actions.length)],
          user: names[Math.floor(Math.random() * names.length)],
          campaign: `Campaign #${Math.floor(Math.random() * 5) + 1}`,
          timestamp: new Date().toISOString(),
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(engagement)}\n\n`));
        await new Promise(r => setTimeout(r, 1500));
      }
      controller.close();
    },
  });
}

// ============================================================================
// MOCK SHADOW CLONE STREAM
// ============================================================================

export function createMockShadowCloneStream(): ReadableStream {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      const steps = [
        { step: 1, message: 'Analyzing brand voice DNA...' },
        { step: 2, message: 'Generating avatar mesh from brand assets...' },
        { step: 3, message: 'Synthesizing voice profile with ElevenLabs...' },
        { step: 4, message: 'Rendering video with HeyGen pipeline...' },
        { step: 5, message: '✅ Shadow Clone ready for deployment' },
      ];

      for (const s of steps) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(s)}\n\n`));
        await new Promise(r => setTimeout(r, 2000));
      }
      controller.close();
    },
  });
}

// ============================================================================
// MOCK TRENDS (already exists in trends.ts, but this ensures the API route works)
// ============================================================================

export const MOCK_TRENDS = {
  industry: 'general',
  lastUpdated: new Date().toISOString(),
  topTrends: [
    { keyword: 'AI-native brands', momentum: 'rising', searchVolume: '+340%', sentiment: 'positive', context: 'Brands built entirely with AI tools are outperforming traditional competitors on CAC.' },
    { keyword: 'anti-corporate aesthetic', momentum: 'peaking', searchVolume: '4.2M', sentiment: 'positive', context: 'Gen-Z prefers raw, unpolished content from brands that feel human.' },
    { keyword: 'creator-led commerce', momentum: 'rising', searchVolume: '+180%', sentiment: 'positive', context: 'Shift from brand-push to creator-pull marketing models.' },
  ],
  viralHooks: [
    'Nobody is talking about this...',
    'I tested every AI tool so you don\'t have to...',
    'POV: You just discovered the cheat code...',
  ],
};
