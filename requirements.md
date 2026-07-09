# Requirements Document: Avoir SaaS

## Project Overview

**Avoir** is an AI-Native Agency + AI Hedge Fund SaaS platform designed for B2B brands and growth marketing agencies. The system uses a multi-tier LLM failover architecture (Diamond Cascade) to autonomously plan, draft, and design high-converting marketing campaigns. It also acts as a portfolio manager (Omni-Deck), allowing users to track real-time campaign momentum, simulate capital deployment, and run intelligence-driven ad strategies.

## 1. Functional Requirements

### 1.1 Autonomous Campaign Generation
- The system SHALL generate full marketing campaigns (Hook, Offer, CTA, Captions, Images) based on user goals.
- The generation process SHALL stream responses via Server-Sent Events (SSE) for real-time user feedback.
- The system SHALL enforce a 6-Tier Diamond Cascade failover mechanism (Gemini → Gemini Fallback → Groq → OpenRouter → Llama → Mock) to maintain a 99.9% uptime SLO.
- The system SHALL support "Genome Mode," generating exactly 3 divergent strategic variants (Virality, Conversion, Authority) for A/B testing.
- AI Image generation SHALL be supported via Pollinations.ai (Flux/Turbo engines) and injected directly into campaign plans.

### 1.2 Omni-Deck Command Center (Portfolio Management)
- The UI SHALL provide a standalone `/omnideck` dashboard acting as a hedge-fund-style portfolio manager.
- The Omni-Deck SHALL display a "Daily Alpha Brief" featuring actionable, AI-generated daily trends.
- The Omni-Deck SHALL include an "Active Positions" table tracking live campaign metrics (Asset, Platform, Allocated Capital, ROAS, Momentum).
- The system SHALL push real-time updates via SSE to modify the "Momentum" of active positions.
- The system SHALL trigger a "DECAY WARNING" pulse when a campaign's momentum drops below -10%.

### 1.3 Capital Deployment Simulator
- Users SHALL be able to click on any active campaign to launch the Capital Deployment Simulator.
- The simulator SHALL allow users to input budget ($) and target ROAS.
- The simulator SHALL run a 4-stage animated pipeline (Configuring → Connecting → Optimizing → Executed).
- The system SHALL calculate and return predictive metrics: Projected Reach, Expected CTR, Estimated CPC, and Confidence Score.

### 1.4 Intelligence & Learning
- The system SHALL implement a Campaign Memory Flywheel, storing successful campaign data per user.
- The AI SHALL read the user's "Brand DNA" (industry, tone, audience) and inject it into every generation prompt.
- The system SHALL include a "Crucible Red-Team" AI persona that automatically critiques and rewrites low-confidence campaigns before they are shown to the user.

### 1.5 Billing, Quotas & Authentication
- The system SHALL enforce JWT-based authentication via Amazon Cognito.
- The system SHALL support 3-tier Stripe billing (Free, Pro, Enterprise) via Checkout Sessions and Customer Portal.
- The system SHALL track user credits in DynamoDB and deduct them per campaign generation.
- The system SHALL enforce sliding-window rate limiting per `userId` using Upstash Redis.

### 1.6 Market Intelligence
- The system SHALL ingest real-time engagement events (comments, shares, likes) via an SSE stream (Authority Defender).
- The system SHALL display these events in the "Market Intelligence" tab within the Omni-Deck.

## 2. Non-Functional Requirements

### 2.1 Performance
- Campaign generation streams SHALL begin returning data within 3 seconds of the user request.
- The SSE signal decay monitor SHALL push momentum updates every 2 seconds.
- The Capital Deployment Simulator API (`/api/simulate`) SHALL respond in < 500ms.

### 2.2 Reliability
- The system SHALL maintain a 99.9% success rate on campaign generation via the Diamond Cascade (Tier 6 Mock fallback).
- DynamoDB reads/writes SHALL complete within 500ms.

### 2.3 Scalability & Deployment
- The frontend SHALL be fully hosted on AWS Amplify (Next.js 14 App Router, SSR enabled).
- The backend API SHALL be deployable as AWS Lambda functions or a standalone FastAPI server.
- Redis caching SHALL be serverless (Upstash) to scale dynamically with load.

### 2.4 Security & Privacy
- All API routes handling user data SHALL require a valid Cognito JWT.
- Campaign history and Brand DNA data SHALL be strictly isolated by `userId` (Partition Key in DynamoDB).
- Stripe webhooks SHALL verify signature secrets before modifying user subscription statuses.
- The platform SHALL maintain YC-standard Privacy Policy and Terms of Service documents.
