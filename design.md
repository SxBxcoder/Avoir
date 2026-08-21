# System Architecture: Avoir — AI-Native Agency + AI Hedge Fund

## 1. High-Level Summary

Avoir is an AI-Native Agency + AI Hedge Fund SaaS platform. It autonomously generates, evaluates, and deploys cross-platform marketing campaigns using a multi-tier LLM failover architecture. 

The system is split into two independently deployable halves: a **Next.js 14 frontend** (hosted on AWS Amplify) and a **Python backend** (deployable as a standalone FastAPI server or an AWS Lambda function behind API Gateway).

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Frontend Framework | Next.js 14 (App Router, TypeScript) |
| UI / Animations | Tailwind CSS, Framer Motion, Lucide icons |
| Hosting (Frontend) | AWS Amplify |
| Authentication | AWS Cognito (via `aws-amplify` SDK) |
| Primary Database | AWS DynamoDB (7 tables) |
| Cache / Rate Limiting | Upstash Redis (HTTP-based, serverless) |
| Payments | Stripe (Checkout, Webhooks, Customer Portal) |
| Backend Runtime | Python 3.11 (FastAPI for local dev, AWS Lambda for prod) |
| AI Providers | Google Gemini, Groq, OpenRouter (Arcee Trinity, Llama 3.3), Pollinations.ai |
| Live Demo System | `mockShield.ts` — a complete curated mock data layer |

## 3. Deployment Architecture

```text
┌─────────────────────────────┐
│  AWS Amplify (Frontend)     │
│  Next.js 14 SSR + API Routes│
│  avoir-ai/                  │
├─────────────────────────────┤
│         ↕ HTTPS             │
├─────────────────────────────┤
│  AWS DynamoDB (7 tables)    │
│  Upstash Redis (HTTP)       │
│  Stripe (Webhooks)          │
├─────────────────────────────┤
│  AWS Lambda (Backend)       │
│  Diamond Cascade Engine     │
│  → Gemini, Groq, OpenRouter │
│  → Pollinations (Images)    │
└─────────────────────────────┘
```

> **Note:** In the current Public Beta deployment, the frontend's own API routes (`/api/generate/stream` etc.) handle most logic directly via `bedrock.ts`, while the Python Lambda backend is available as an alternative entry point for the raw Diamond Cascade.

## 4. Component Map

### Backend (`/backend/`)

| File | Role |
|---|---|
| `aws_lambda_handler.py` | **The Diamond Cascade engine.** 6-tier LLM failover for campaign generation. This is the core AI brain. Deployed as AWS Lambda in production. |
| `server.py` | FastAPI wrapper for local development. Imports and calls `lambda_handler` directly. Also mounts Trends, Shadow Clone, Authority Defender, and Agency Bridge endpoints. |
| `trends_sniper.py` | Fetches viral trends from YouTube API, Apify (TikTok), or generates them via Gemini. Falls back to curated mocks. |
| `shadow_clone.py` | "Zero-Camera Content Factory." Simulates an AI avatar video pipeline (ElevenLabs voice + HeyGen avatar). |
| `authority_defender.py` | Social listening engine. Handles Meta webhook verification, comment sentiment analysis, and AI-drafted brand replies via Gemini. |
| `agency_bridge.py` | B2B multi-tenant module. Manages agency clients, white-labeled share links, and public campaign approval routes. |
| `signal_decay_monitor.py` | Tracks real-time campaign momentum, pushing updates via SSE. |
| `alpha_brief_generator.py` | **Daily Alpha Brief generator.** Uses Gemini to produce a daily trend anomaly + campaign hook, cached in Upstash Redis (HTTP REST). |
| `aws_lambda_daily_cron.py` | EventBridge cron Lambda that pre-warms the daily alpha brief in Redis at midnight. |

### Frontend — Next.js App (`/avoir-ai/src/`)

#### Pages (`/app/`)

| Route | Purpose |
|---|---|
| `/` | Landing page — premium glassmorphism design. |
| `/login`, `/register`, `/forgot-password` | AWS Cognito authentication flows. |
| `/omnideck` | **The Omni-Deck Command Center** — Hedge-fund-style dashboard. |
| `/onboarding` | Brand DNA onboarding wizard. |
| `/pricing`, `/checkout/success` | Stripe billing integration. |
| `/client-approval/[id]` | Public route for agency clients to review campaigns. |

#### API Routes (`/app/api/`)

| Endpoint | Purpose |
|---|---|
| `POST /api/generate/stream` | Primary SSE-streamed campaign generation with rate limiting. |
| `GET /api/campaigns` | Fetch paginated campaign history. |
| `GET /api/engagement/stream` | SSE stream of live social media engagements (Authority Defender) and Signal Decay. |
| `POST /api/stripe/webhook` | Handle Stripe webhook events (subscription lifecycle). |

#### Components (`/components/`)

| Component | Purpose |
|---|---|
| `CampaignDashboard.tsx` | The mega-component containing campaign generation, history, and sub-panels. |
| `CampaignGenome.tsx` | Genome Mode — displays 3 strategically divergent campaign variants. |
| `CapitalDeploymentSimulator.tsx` | Simulates deploying ad budget to exchanges with animated ROI predictions. |
| `LiveArbitrageFeed.tsx` | Real-time feed of attention arbitrage opportunities. |
| `TrendRadar.tsx`, `CompetitorIntelPanel.tsx` | Market intelligence displays. |

#### Libraries (`/lib/`)

| Module | Purpose |
|---|---|
| `bedrock.ts` | The frontend AI orchestrator. Contains 4 prompt personas (Elite, Crucible Red Team, Genome Multi-Variant, Synthetic Focus Group). Calls Gemini Pro with Pollinations fallback. |
| `mockShield.ts` | Complete demo data layer toggled by `NEXT_PUBLIC_DEMO_MODE=true`. |
| `auth.ts`, `stripe.ts` | Auth and Billing configurations. |

## 5. DynamoDB Table Registry

| Table Name | PK | SK | Purpose |
|---|---|---|---|
| `avoir-users` | `userId` | — | Subscription state, credits, Stripe IDs |
| `avoir-campaigns` | `userId` | `campaignId` | Campaign history with full plan/captions/image |
| `avoir-audit` | `logId` | — | Cascade tier logs and billing events |
| `avoir-brand-dna` | `userId` | — | Brand identity profiles |
| `avoir-performance` | `userId` | `campaignId` | Performance metrics per campaign |
| `avoir-intelligence` | `userId` | — | Compounding learning profile (Flywheel) |
| `avoir-competitors` | `industry` | `competitorId` | Competitor intel |

## 6. Data Flow: Campaign Generation

```text
User types goal in Omni-Deck
  → POST /api/generate/stream (SSE)
    → Rate limit check (Redis)
    → Quota check (DynamoDB users table)
    → Fetch Brand DNA, Intelligence Brief, Trends, Competitor Intel
    → Inject all context into LLM prompt
    → Call bedrock.ts orchestrator (Gemini → Pollinations fallback)
      → If Genome Mode: generate 3 divergent variants
      → If Standard: generate single campaign + Crucible red-team pass
    → Stream progress events to client
    → Persist campaign to DynamoDB
    → Deduct credits
    → Return final campaign object
```
