#!/bin/bash
# =============================================================================
# Prachar.ai — Full Cinematic Demo Recording Pipeline
# =============================================================================
# Orchestrates: OBS start → Playwright demo → OBS stop → FFmpeg grade
#
# Prerequisites (see README section below):
#   - Node.js 18+
#   - FFmpeg in PATH
#   - OBS Studio open with WebSocket server enabled (port 4455)
#   - .env with OBS_PASSWORD and OBS_PORT
#   - npm packages installed (see bottom of this file)
#
# Usage:
#   bash run_demo.sh
# =============================================================================

set -e

# ── Resolve script directory (works whether called from project root or elsewhere)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

export PATH="$SCRIPT_DIR/bin:$PATH"

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║       PRACHAR.AI — Cinematic Demo Recording Pipeline        ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# ── Step 1: Dependency checks ─────────────────────────────────────────────────
echo "🔍  Checking dependencies..."





# Verify node_modules exist
if [[ ! -d "demo/node_modules" ]]; then
  echo "⚙️   Installing Node.js dependencies..."
  cd demo
  npm install playwright obs-websocket-js dotenv
  npx playwright install chromium
  cd "$SCRIPT_DIR"
fi

# Verify .env exists
if [[ ! -f ".env" ]]; then
  echo "⚠️   Warning: .env not found. Creating template..."
  cat > .env << 'EOF'
# OBS WebSocket Settings
# Enable in OBS: Tools → WebSocket Server Settings → Enable WebSocket server
OBS_PASSWORD=
OBS_PORT=4455
EOF
  echo "   ⚠️  Fill in OBS_PASSWORD in .env, then re-run."
  echo "   → Skipping OBS control (Playwright only mode)."
  OBS_ENABLED=false
else
  OBS_ENABLED=true
fi

# Create assets directory if needed
mkdir -p demo/assets

# ── Step 2: Start OBS recording ───────────────────────────────────────────────
if [[ "$OBS_ENABLED" == "true" ]]; then
  echo ""
  echo "🎥  Starting OBS recording..."
  node demo/obs/obs_controller.js start
  sleep 2
  echo "   OBS recording active ✓"
else
  echo ""
  echo "⚠️   Skipping OBS (no .env or password not set)."
  echo "    You can manually start recording in OBS before running again."
fi

# ── Step 3: Run the Playwright demo ──────────────────────────────────────────
echo ""
echo "🎬  Launching Playwright cinematic demo..."
echo "    (Browser will open at 1920x1080 — move it to your recording monitor)"
echo ""
sleep 1

node demo/playwright/demo.js

sleep 1
echo ""
echo "   Playwright flow complete ✓"

# ── Step 4: Stop OBS recording ────────────────────────────────────────────────
if [[ "$OBS_ENABLED" == "true" ]]; then
  echo ""
  echo "⏹️   Stopping OBS recording..."
  node demo/obs/obs_controller.js stop
  echo "   OBS stopped ✓"

  # Get the raw recording path
  echo ""
  echo "📁  Retrieving recording path..."
  RAW=$(node demo/obs/obs_controller.js path)
  echo "   Raw recording: $RAW"

  # ── Step 5: Run FFmpeg cinematic grade pipeline ──────────────────────────
  echo ""
  echo "🎨  Running FFmpeg cinematic grade pipeline..."
  bash demo/ffmpeg/grade.sh "$RAW"

  echo ""
  echo "╔══════════════════════════════════════════════════════════════╗"
  echo "║   ✅  Pipeline complete!                                     ║"
  echo "║   Output: prachar_demo_final.mp4                             ║"
  echo "╚══════════════════════════════════════════════════════════════╝"

  # Open the output file
  if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" || "$OSTYPE" == "cygwin" ]]; then
    start prachar_demo_final.mp4 2>/dev/null || explorer.exe /select,prachar_demo_final.mp4
  elif [[ "$OSTYPE" == "darwin"* ]]; then
    open prachar_demo_final.mp4
  else
    xdg-open prachar_demo_final.mp4 2>/dev/null || echo "   Open manually: prachar_demo_final.mp4"
  fi

else
  echo ""
  echo "╔══════════════════════════════════════════════════════════════╗"
  echo "║   ✅  Playwright demo complete!                              ║"
  echo "║   Timestamps saved to demo/timestamps.json                  ║"
  echo "║                                                              ║"
  echo "║   To grade the video manually:                              ║"
  echo "║     bash demo/ffmpeg/grade.sh /path/to/your_recording.mkv  ║"
  echo "╚══════════════════════════════════════════════════════════════╝"
fi

echo ""
