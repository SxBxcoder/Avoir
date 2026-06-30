/**
 * Prachar.ai — Cinematic Demo Recording Script
 * ============================================
 * Uses Playwright + Chromium (headless: false, 1920x1080) to drive a
 * fully automated, timestamp-annotated demo flow for post-production.
 *
 * Flow:
 *   1. Dashboard via ?demo=true (no auth required)
 *   2. Type campaign directive (60ms/keystroke, cinematic)
 *   3. Click Send → wait for SSE stream to complete
 *   4. Cinematic scroll through output
 *   5. Navigate to Omni-Deck Command Center
 *
 * Timestamps are written to demo/timestamps.json for FFmpeg grading.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// ── Config ──────────────────────────────────────────────────────────────────
const BASE_URL = 'http://localhost:3000';
const TIMESTAMPS_FILE = path.join(__dirname, '..', 'timestamps.json');
const CAMPAIGN_PROMPT =
  'Nike Air Max global launch — Gen Z audience — Instagram, TikTok, LinkedIn';

// Selectors — verified against actual component source files
const SELECTORS = {
  // page.tsx: checkingAuth spinner (w-8 h-8 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full)
  authLoader:
    '.w-8.h-8.border-2.border-indigo-500\\/20.border-t-indigo-500.rounded-full',

  // CampaignDashboard.tsx L1174: input[placeholder="Enter your campaign directive..."]
  campaignInput: 'input[placeholder="Enter your campaign directive..."]',

  // CampaignDashboard.tsx L1177–1187: MagneticButton with classes !px-5 !py-3.5 !rounded-xl
  // It wraps a Lucide <Send /> SVG. Most reliable: find button adjacent to the input.
  sendButton: 'button.\\!px-5.\\!py-3\\.5.\\!rounded-xl',

  // CampaignDashboard.tsx L881: button[title="Omni-Deck Command Center"]
  omniDeckButton: 'button[title="Omni-Deck Command Center"]',

  // OmniDeckPage — h1 containing "Omni-Deck Command Center" text
  omniDeckHeader: 'h1',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

let recordingStartTime = null;
const tsMap = {};

function ts(label) {
  const rel = (Date.now() - recordingStartTime) / 1000;
  tsMap[label] = { abs: Date.now(), relSeconds: parseFloat(rel.toFixed(3)) };
  console.log(`[${rel.toFixed(2)}s] ✓ ${label}`);
}

function saveTimestamps() {
  fs.mkdirSync(path.dirname(TIMESTAMPS_FILE), { recursive: true });
  fs.writeFileSync(TIMESTAMPS_FILE, JSON.stringify(tsMap, null, 2), 'utf8');
  console.log(`\nTimestamps saved → ${TIMESTAMPS_FILE}`);
}

/**
 * Cinematic scroll — 300px increments, 800ms between each.
 * Matches the requested spec exactly.
 */
async function cinematicScroll(page, totalDistance) {
  const steps = Math.ceil(totalDistance / 300);
  for (let i = 0; i < steps; i++) {
    await page.evaluate(() => window.scrollBy({ top: 300, behavior: 'smooth' }));
    await page.waitForTimeout(800);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  recordingStartTime = Date.now();
  console.log('\n🎬  Prachar.ai Cinematic Demo — Starting\n');

  const browser = await chromium.launch({
    headless: false,
    args: [
      '--start-maximized',
      '--no-sandbox',
      '--disable-gpu-sandbox',
      // Keep consistent rendering for recording
      '--disable-web-security',
      '--allow-running-insecure-content',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    // Silence ServiceWorker noise in recordings
    serviceWorkers: 'block',
  });

  const page = await context.newPage();

  // ── Step 1: Navigate to dashboard via demo bypass ─────────────────────────
  console.log('→ Navigating to dashboard (demo bypass)...');
  await page.goto(`${BASE_URL}/?demo=true`, {
    waitUntil: 'load',
    timeout: 60_000,
  });

  // ── Step 2: Wait for auth loader to disappear ─────────────────────────────
  // The spinner has class combination: w-8 h-8 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full
  // Playwright CSS escaping: '/' → '\/' in class selectors
  console.log('→ Waiting for auth loader to clear...');
  try {
    await page.waitForSelector(SELECTORS.authLoader, {
      state: 'hidden',
      timeout: 20_000,
    });
  } catch {
    // If selector never appeared, loader was instant — that's fine
    console.log('  (Auth loader not found or already gone — continuing)');
  }

  // Additional fallback: wait for the campaign input to be visible
  await page.waitForSelector(SELECTORS.campaignInput, {
    state: 'visible',
    timeout: 30_000,
  });

  ts('dashboard_ready');

  // ── Step 3: Cinematic pause on dashboard ──────────────────────────────────
  console.log('→ Cinematic pause (3s)...');
  await page.waitForTimeout(3000);

  // ── Step 4: Click into the campaign input ─────────────────────────────────
  console.log('→ Focusing campaign directive input...');
  const inputEl = await page.locator(SELECTORS.campaignInput);
  await inputEl.click({ force: true });
  await page.waitForTimeout(300);

  // ── Step 5: Type the campaign prompt ─────────────────────────────────────
  ts('typing_start');
  console.log('→ Typing campaign directive...');
  await inputEl.pressSequentially(CAMPAIGN_PROMPT, { delay: 60 });

  // ── Step 6: Pause after typing ───────────────────────────────────────────
  ts('typing_end');
  await page.waitForTimeout(1000);

  // ── Step 7: Click the Send button ────────────────────────────────────────
  console.log('→ Clicking Send button...');
  let sendBtn = page.getByRole('button', { name: 'EXECUTE', exact: true });
  await sendBtn.waitFor({ state: 'visible', timeout: 10000 });

  ts('generate_click');
  await sendBtn.click({ force: true });

  // ── Step 8: Wait for input to become disabled (SSE started) ───────────────
  console.log('→ Waiting for SSE stream to start (input disabled)...');
  await page.waitForFunction(
    (selector) => {
      const el = document.querySelector(selector);
      return el && el.disabled;
    },
    SELECTORS.campaignInput,
    { timeout: 15_000 }
  );
  ts('generation_start');
  console.log('  SSE stream started ✓');

  // ── Step 9: Wait for SSE "done" event (input re-enabled) ─────────────────
  console.log('→ Waiting for SSE stream to complete (input re-enabled)...');
  await page.waitForFunction(
    (selector) => {
      const el = document.querySelector(selector);
      return el && !el.disabled;
    },
    SELECTORS.campaignInput,
    { timeout: 120_000 } // AI generation can take up to 2 minutes
  );
  ts('generation_end');
  console.log('  Generation complete ✓');

  // ── Step 10: Hold 2 seconds after generation ──────────────────────────────
  await page.waitForTimeout(2000);

  // ── Step 11: Cinematic scroll through output ──────────────────────────────
  ts('scroll_start');
  console.log('→ Starting cinematic scroll...');

  const totalScrollDistance = await page.evaluate(
    () => document.body.scrollHeight - window.innerHeight
  );
  console.log(`  Total scroll distance: ${totalScrollDistance}px`);

  await cinematicScroll(page, totalScrollDistance);

  ts('scroll_end');

  // ── Step 12: Hold 3 seconds at bottom ────────────────────────────────────
  await page.waitForTimeout(3000);

  // ── Step 13: Click Omni-Deck sidebar button ───────────────────────────────
  // Verified selector: button[title="Omni-Deck Command Center"]
  // (CampaignDashboard.tsx L882: title="Omni-Deck Command Center")
  // ── Step 11: Click Omni-Deck button (Simulated via navigation) ────────────
  console.log('→ Navigating to Omni-Deck Command Center...');
  ts('omnideck_click');
  await page.goto(`${BASE_URL}/omnideck`, { waitUntil: 'domcontentloaded', timeout: 60_000 });

  // Wait for the Omni-Deck header to appear in DOM
  const omniHeader = page.getByText('OMNI-DECK // PORTFOLIO MANAGER');
  await omniHeader.waitFor({ state: 'visible', timeout: 30_000 });

  ts('omnideck_ready');
  console.log('  Omni-Deck loaded ✓');

  // ── Step 15: Hold 4 seconds showing Omni-Deck ────────────────────────────
  console.log('→ Holding on Omni-Deck for 4 seconds (cinematic)...');
  await page.waitForTimeout(4000);

  // ── Fin ───────────────────────────────────────────────────────────────────
  saveTimestamps();
  console.log('\n✅  Demo flow complete. OBS can now stop recording.\n');

  await browser.close();
  process.exit(0);
})().catch((err) => {
  console.error('\n❌  Demo script failed:', err);
  saveTimestamps(); // Save partial timestamps even on failure
  process.exit(1);
});
