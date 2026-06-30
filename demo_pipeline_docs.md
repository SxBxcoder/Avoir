# Avoir — Automated Cinematic Demo Pipeline

> Record a premium startup demo video with zero manual clicking.
> Playwright drives the browser, OBS captures the screen, FFmpeg post-produces the final cut.

---

## File Layout

```
Avoir/
├── .env                          ← Create from .env.example (OBS_PASSWORD, OBS_PORT)
├── .env.example                  ← Template
├── run_demo.sh                   ← Master orchestration script
└── demo/
    ├── package.json              ← Node deps: playwright, obs-websocket-js, dotenv
    ├── node_modules/             ← Installed ✓
    ├── timestamps.json           ← Written by Playwright, read by FFmpeg
    ├── assets/
    │   └── music.mp3             ← Drop your background music here (optional)
    ├── playwright/
    │   └── demo.js               ← Chromium automation, timestamps, full flow
    ├── obs/
    │   └── obs_controller.js     ← OBS WebSocket start/stop/path
    └── ffmpeg/
        └── grade.sh              ← Speed ramps + zoom punches + grade + captions + music
```

---

## ✅ Verified Selectors (cross-referenced against current source files)

| Element | Selector | Source |
|---|---|---|
| Campaign directive input | `input[placeholder="Enter your campaign directive..."]` | `CampaignDashboard.tsx:L1947` |
| Execute (Send) button | `button` containing text `EXECUTE` (inside `MagneticButton`) | `CampaignDashboard.tsx:L1954-1964` |
| Omni-Deck sidebar button | `button[title="Omni-Deck Command Center"]` | `CampaignDashboard.tsx:L1280` |
| Omni-Deck header | `h1` containing `"Omni-Deck"` | `src/app/omnideck/page.tsx` |
| Genome Mode toggle | `#tour-genome-toggle` | `CampaignDashboard.tsx:L1971` |

## 2. Setting Up the Environment

### A. The "Demo Mock Shield" (Recommended for Recording)

We have built a **Demo Mock Shield** that intercepts all 11 API routes (generate, stream, subscription, intelligence, campaigns, etc.) and returns curated, premium mock data. This allows you to record a flawless demo without needing DynamoDB, Redis, AWS Lambda, or Stripe configured.

1. Open `avoir-ai/.env.local`
2. Ensure this flag is set at the very bottom:
   ```env
   NEXT_PUBLIC_DEMO_MODE=true
   ```
3. Run the dev server: `npm run dev`
4. The entire app will now run using the `src/lib/mockShield.ts` data.

### B. Live Infrastructure (If you want real AI generation)

If you prefer to record the demo using the live backend:
1. Ensure `NEXT_PUBLIC_DEMO_MODE` is removed or set to `false` in `.env.local`
2. Ensure you have valid `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in `.env.local` for DynamoDB access
3. Ensure the Python backend is running locally (`cd backend && uvicorn server:app --reload --port 8000`)
4. OR ensure `NEXT_PUBLIC_API_URL` points to your deployed AWS Lambda URL.

---

## 3. The Perfect Demo Walkthrough

> [!IMPORTANT]
> The old auth loader spinner selector (`.w-8.h-8.border-2...`) has been **removed** from the codebase.
> The app no longer shows a loading spinner on page load — it renders the landing page immediately and transitions to the dashboard via polling once tokens are ready.

**SSE stream start/end detection** — verified against `CampaignDashboard.tsx:L414, L638, L1948`:
- `isGenerating = true` → input gets `disabled` attribute → **`generation_start`**
- Stream fully completes, `isGenerating` resets → input loses `disabled` → **`generation_end`**

---

## Demo Authentication

There are two ways to authenticate for the demo recording:

### Option A: Google OAuth (Real Login)
Navigate to `http://localhost:3000` → Click **Sign In** → **Continue with Google** → select your account.
The app uses a polling mechanism to detect the token exchange and will seamlessly transition from the landing page to the dashboard.

### Option B: Demo Bypass (Mock Session)
Navigate to `http://localhost:3000/?demo=true`.
This uses a mock session (`commander@avoir.ai`) — **only works if the `demo=true` query param handler is re-enabled in `page.tsx`.**

> [!WARNING]
> The `?demo=true` bypass was **removed** during the auth refactor. If you want to use it, you'll need to re-add the demo check inside the `verifyAuth` function in `src/app/page.tsx`. For now, **use Option A (real Google login).**

---

## Assumptions

1. **OBS Scene Name**: The script switches to a scene named `"Avoir Demo"`. If yours is named differently, update `DEMO_SCENE` in `demo/obs/obs_controller.js`.

2. **Font path for captions**: `grade.sh` uses `/usr/share/fonts/truetype/inter/Inter-Bold.ttf` (Linux). On **Windows with Git Bash/WSL**, change to:
   ```bash
   FONT_PATH="C:/Windows/Fonts/arial.ttf"   # fallback if Inter not installed
   ```
   Download Inter from [rsms.me/inter](https://rsms.me/inter/) and install system-wide for best results.

3. **Send button fallback**: The primary selector looks for a button containing the text `EXECUTE`. If that changes, fall back to finding the last `button` near the input.

4. **SSE timeout**: Set to 120 seconds (`waitForFunction` timeout). If the Lambda backend is cold-starting or unreachable, the script will timeout and still save partial timestamps.

5. **Music**: If `demo/assets/music.mp3` is not present, the FFmpeg pipeline silently skips it and outputs with app audio only. Drop any royalty-free track in that path (recommend: [Pixabay](https://pixabay.com/music/)).

6. **obs-websocket-js version**: Uses v5 protocol (`rpcVersion: 1`). OBS Studio 28+ includes obs-websocket v5 built-in. Older OBS requires the plugin.

7. **FFmpeg grade.sh runs on bash** — on Windows, run via Git Bash, WSL, or MSYS2.

---

## Exact Commands to Run

### 1. First-time setup
```bash
# In Avoir root directory

# Copy .env template and fill in your OBS password
cp .env.example .env
# Edit .env → set OBS_PASSWORD=yourpassword

# Install demo dependencies
cd demo
npm install
npx playwright install chromium
cd ..
```

### 2. Run the full automated pipeline
```bash
# In Avoir root (Git Bash or WSL on Windows)
bash run_demo.sh
```

### 3. Run Playwright only (no OBS — use with Nvidia/AMD capture instead)
```bash
node demo/playwright/demo.js
# Then manually grade:
bash demo/ffmpeg/grade.sh /path/to/your_screen_capture.mkv
```

### 4. Run FFmpeg grade only (if you already have a raw recording)
```bash
bash demo/ffmpeg/grade.sh "C:/Users/KIIT0001/Videos/avoir_raw.mkv"
# Output: avoir_demo_final.mp4 in current directory
```

### 5. OBS control manually
```bash
node demo/obs/obs_controller.js start   # Start recording
node demo/obs/obs_controller.js stop    # Stop + save path
node demo/obs/obs_controller.js path    # Print last recording path
```

---

## OBS Setup (One-Time)

1. Open OBS Studio
2. Go to **Tools → WebSocket Server Settings**
3. Check **Enable WebSocket server**
4. Set port `4455`, set a password
5. Add that password to `.env` → `OBS_PASSWORD=yourpassword`
6. Create a scene called **"Avoir Demo"** with a Display Capture source at 1920×1080

> [!TIP]
> For the cleanest recording, set OBS output to MKV (lossless-ish) at 60fps in Settings → Output. The FFmpeg pipeline will re-encode to H.264 CRF 16 at the end.

---

## Recommended Demo Flow (Script)

For a premium demo recording, follow this sequence:

| # | Scene | Duration | What to Show |
|---|-------|----------|-------------|
| 1 | **Landing Page** | ~5s | Hero section with 3D particle canvas, scroll down through features |
| 2 | **Sign In** | ~3s | Click Sign In → Google OAuth → seamless redirect to dashboard |
| 3 | **Dashboard Overview** | ~5s | Pan across the Command Center, show sidebar, live market data |
| 4 | **Campaign Generation** | ~15s | Type a directive → hit EXECUTE → watch SSE streaming in real-time |
| 5 | **Campaign Result** | ~5s | Show generated campaign card, captions, image |
| 6 | **Genome Mode** | ~5s | Toggle Genome Mode on, show variant analysis |
| 7 | **Omni-Deck** | ~5s | Navigate to Omni-Deck, show cross-platform publishing |
| 8 | **Pricing** | ~3s | Quick scroll through pricing tiers |

**Total runtime: ~45–60 seconds** (speed-ramped to ~30s in final cut)
