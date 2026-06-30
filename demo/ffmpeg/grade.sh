#!/usr/bin/env bash
# =============================================================================
# Prachar.ai — FFmpeg Cinematic Grade Pipeline
# =============================================================================
# Usage: bash demo/ffmpeg/grade.sh /path/to/raw_obs_recording.mkv
#
# Reads demo/timestamps.json for time-accurate speed ramps and zoom punches.
# Produces: prachar_demo_final.mp4
#
# Pipeline (in order):
#   1. Speed ramps (setpts): dashboard→type = 1.5x, generation = 0.85x slow
#   2. Zoom punches at generate_click and omnideck_click
#   3. Color grade: warm blacks + lifted mids
#   4. Captions: Inter, size 64, fade in/out, bottom center
#   5. Music mix: demo/assets/music.mp3 at -18dBFS, fade in 2s, fade out 3s
#   6. Final encode: libx264 CRF 16 / slow / aac 192k / faststart
# =============================================================================

set -euo pipefail

INPUT="${1:-}"
OUTPUT="prachar_demo_final.mp4"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEMO_DIR="$(dirname "$SCRIPT_DIR")"
TIMESTAMPS_FILE="$DEMO_DIR/timestamps.json"
MUSIC_FILE="$DEMO_DIR/assets/music.mp3"
FONT_PATH="/usr/share/fonts/truetype/inter/Inter-Bold.ttf"

# ── Validate input ────────────────────────────────────────────────────────────
if [[ -z "$INPUT" ]]; then
  echo "❌  Error: No input file provided."
  echo "   Usage: bash demo/ffmpeg/grade.sh /path/to/recording.mkv"
  exit 1
fi

if [[ ! -f "$INPUT" ]]; then
  echo "❌  Error: Input file not found: $INPUT"
  exit 1
fi

if [[ ! -f "$TIMESTAMPS_FILE" ]]; then
  echo "❌  Error: timestamps.json not found: $TIMESTAMPS_FILE"
  echo "   Run the Playwright demo first to generate timestamps."
  exit 1
fi

# ── Parse timestamps from JSON ────────────────────────────────────────────────
# Uses python3 for reliable JSON parsing (guaranteed on macOS/Linux CI)
get_ts() {
  local key="$1"
  python3 -c "
import json, sys
with open('$TIMESTAMPS_FILE') as f:
    data = json.load(f)
val = data.get('$key', {}).get('relSeconds', 0)
print(f'{val:.3f}')
"
}

TS_DASHBOARD_READY=$(get_ts "dashboard_ready")
TS_TYPING_START=$(get_ts "typing_start")
TS_GENERATION_START=$(get_ts "generation_start")
TS_GENERATION_END=$(get_ts "generation_end")
TS_GENERATE_CLICK=$(get_ts "generate_click")
TS_OMNIDECK_CLICK=$(get_ts "omnideck_click")
TS_SCROLL_START=$(get_ts "scroll_start")
TS_SCROLL_END=$(get_ts "scroll_end")
TS_OMNIDECK_READY=$(get_ts "omnideck_ready")

echo "📋  Timestamps loaded:"
echo "   dashboard_ready  = ${TS_DASHBOARD_READY}s"
echo "   typing_start     = ${TS_TYPING_START}s"
echo "   generation_start = ${TS_GENERATION_START}s"
echo "   generation_end   = ${TS_GENERATION_END}s"
echo "   generate_click   = ${TS_GENERATE_CLICK}s"
echo "   omnideck_click   = ${TS_OMNIDECK_CLICK}s"
echo "   omnideck_ready   = ${TS_OMNIDECK_READY}s"

# ── Get total video duration ──────────────────────────────────────────────────
DURATION=$("$SCRIPT_DIR/../../bin/ffprobe.exe" -v error -show_entries format=duration \
  -of default=noprint_wrappers=1:nokey=1 "$INPUT")
echo "   Total duration   = ${DURATION}s"

# ── Build FFmpeg filter complex ───────────────────────────────────────────────
# Speed ramp approach: trim + setpts + concat segments
# Segments:
#   A: 0 → dashboard_ready         (1.5x — boring auth wait, speed through)
#   B: dashboard_ready → typing_start (1.5x — landing page reveal, punchy)
#   C: typing_start → generation_start (1.0x — normal: typing + click)
#   D: generation_start → generation_end (0.85x — dramatic slow during AI gen)
#   E: generation_end → omnideck_click (1.0x — scroll through results)
#   F: omnideck_click → end           (1.0x — Omni-Deck showcase)
#
# Zoom punch filter: zoompan at generate_click and omnideck_click timestamps
# Note: zoompan operates at source fps. We use libx264 native fps (25).
# Each zoom: zoom 1.0→1.15 over 3 frames, hold 5 frames, 1.0→1.15 reverse 3 frames

FPS=25

zoom_punch_filter() {
  local trigger_ts="$1"      # in seconds (post-speedramp approx)
  local start_frame
  start_frame=$(python3 -c "print(int(float('$trigger_ts') * $FPS))")
  local end_frame=$((start_frame + 11)) # 3+5+3 frames

  echo "zoompan=z='if(between(on,$start_frame,$((start_frame+3))),zoom+0.05,if(between(on,$((start_frame+3)),$((start_frame+8))),1.15,if(between(on,$((start_frame+8)),$end_frame),zoom-0.05,1)))':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1920x1080:fps=$FPS"
}

ZOOM_GENERATE=$(zoom_punch_filter "$TS_GENERATE_CLICK")
ZOOM_OMNIDECK=$(zoom_punch_filter "$TS_OMNIDECK_CLICK")

# ── Determine if music exists ─────────────────────────────────────────────────
MUSIC_FILTER=""
MUSIC_INPUT=""
AUDIO_MERGE=""

if [[ -f "$MUSIC_FILE" ]]; then
  MUSIC_INPUT="-i $MUSIC_FILE"
  # Music: fade in 2s, fade out 3s, mixed at -18dBFS under app audio
  # App audio: unchanged (from screen recording)
  # afade=t=in:st=0:d=2 and afade=t=out:st=(DURATION-3):d=3
  FADE_OUT_START=$(python3 -c "print(max(0, float('$DURATION') - 3))")
  MUSIC_FILTER="[2:a]afade=t=in:st=0:d=2,afade=t=out:st=${FADE_OUT_START}:d=3,volume=-18dB[music_faded];"
  AUDIO_MERGE="[1:a][music_faded]amix=inputs=2:duration=first:dropout_transition=3[audio_out]"
else
  echo "⚠️   Warning: Music file not found at $MUSIC_FILE — proceeding without music."
  AUDIO_MERGE="[1:a]acopy[audio_out]"
fi

# ── Caption definitions ───────────────────────────────────────────────────────
# Format: start=Xs, end=Xs, text
# Fade in 0.5s, hold, fade out 0.5s
# Position: x=(w-text_w)/2:y=h-120 (bottom center, 120px from bottom)

build_caption() {
  local start="$1"
  local end="$2"
  local text="$3"
  local fade_in_end
  local fade_out_start
  fade_in_end=$(python3 -c "print(float('$start') + 0.5)")
  fade_out_start=$(python3 -c "print(float('$end') - 0.5)")
  # alpha expression: fade in then hold then fade out
  local alpha="if(lt(t,$start),0,if(lt(t,$fade_in_end),(t-$start)/0.5,if(lt(t,$fade_out_start),1,if(lt(t,$end),($end-t)/0.5,0))))"
  echo "drawtext=fontfile='$FONT_PATH':fontsize=64:fontcolor=white:alpha='$alpha':text='$text':x=(w-text_w)/2:y=h-120:shadowcolor=black@0.6:shadowx=2:shadowy=2"
}

CAP1=$(build_caption 4 7 "One input.")
CAP2=$(build_caption 12 16 "Full campaign.")
CAP3=$(build_caption 20 24 "Every platform.")
CAP4=$(build_caption 27 31 "prachar.ai")

# ── Assemble filter_complex ───────────────────────────────────────────────────
#
# Video pipeline:
#   [0:v] → speed ramps (trim/setpts/concat) → zoom punches → color grade → captions → [v_out]
# Audio pipeline:
#   [0:a] → direct (no pitch shift on segments, keeps natural timing) → [1:a]
#   If music: mix [1:a] + [2:a] → [audio_out]
#
# Speed ramp via trim+setpts approach (most accurate without re-encoding):
#   Each segment: [0:v]trim=start=A:end=B,setpts=PTS_FACTOR*(PTS-STARTPTS)[segN]
#   Then: [seg0][seg1]...[segN]concat=n=N:v=1:a=0[v_ramped]
#
# PTS factor: 1/speed (1.5x → PTS/1.5 = 0.667*PTS, 0.85x → PTS/0.85 = 1.176*PTS)

SPEED_A="0.667" # 1.5x
SPEED_B="0.667" # 1.5x
SPEED_C="1.0"
SPEED_D="1.176" # 0.85x (slow-motion drama)
SPEED_E="1.0"
SPEED_F="1.0"

# Corresponding audio atempo (must be between 0.5-2.0, chain for extremes)
ATEMPO_A="1.5"
ATEMPO_D="0.85"

VIDEO_SEGMENTS="[0:v]trim=start=0:end=${TS_DASHBOARD_READY},setpts=${SPEED_A}*(PTS-STARTPTS)[vA];\
[0:v]trim=start=${TS_DASHBOARD_READY}:end=${TS_TYPING_START},setpts=${SPEED_B}*(PTS-STARTPTS)[vB];\
[0:v]trim=start=${TS_TYPING_START}:end=${TS_GENERATION_START},setpts=${SPEED_C}*(PTS-STARTPTS)[vC];\
[0:v]trim=start=${TS_GENERATION_START}:end=${TS_GENERATION_END},setpts=${SPEED_D}*(PTS-STARTPTS)[vD];\
[0:v]trim=start=${TS_GENERATION_END}:end=${TS_OMNIDECK_CLICK},setpts=${SPEED_E}*(PTS-STARTPTS)[vE];\
[0:v]trim=start=${TS_OMNIDECK_CLICK},setpts=${SPEED_F}*(PTS-STARTPTS)[vF];\
[vA][vB][vC][vD][vE][vF]concat=n=6:v=1:a=0[v_ramped]"

AUDIO_SEGMENTS="[0:a]atrim=start=0:end=${TS_DASHBOARD_READY},asetpts=PTS-STARTPTS,atempo=${ATEMPO_A}[aA];\
[0:a]atrim=start=${TS_DASHBOARD_READY}:end=${TS_TYPING_START},asetpts=PTS-STARTPTS,atempo=${ATEMPO_A}[aB];\
[0:a]atrim=start=${TS_TYPING_START}:end=${TS_GENERATION_START},asetpts=PTS-STARTPTS[aC];\
[0:a]atrim=start=${TS_GENERATION_START}:end=${TS_GENERATION_END},asetpts=PTS-STARTPTS,atempo=${ATEMPO_D}[aD];\
[0:a]atrim=start=${TS_GENERATION_END}:end=${TS_OMNIDECK_CLICK},asetpts=PTS-STARTPTS[aE];\
[0:a]atrim=start=${TS_OMNIDECK_CLICK},asetpts=PTS-STARTPTS[aF];\
[aA][aB][aC][aD][aE][aF]concat=n=6:v=0:a=1[1:a]"

VIDEO_GRADE="[v_ramped]\
${ZOOM_GENERATE},\
${ZOOM_OMNIDECK},\
colorbalance=bs=0.05:bh=-0.03,\
curves=all='0/0 0.5/0.55 1/1'\
[v_out]"

FILTER_COMPLEX="${VIDEO_SEGMENTS};${AUDIO_SEGMENTS};${MUSIC_FILTER}${VIDEO_GRADE};${AUDIO_MERGE}"

# ── Run FFmpeg ────────────────────────────────────────────────────────────────
echo ""
echo "🎬  Running FFmpeg cinematic grade pipeline..."
echo "    Input:  $INPUT"
echo "    Output: $OUTPUT"
echo ""

"$SCRIPT_DIR/../../bin/ffmpeg.exe" -y \
  -i "$INPUT" \
  ${MUSIC_INPUT} \
  -filter_complex "$FILTER_COMPLEX" \
  -map "[v_out]" \
  -map "[audio_out]" \
  -c:v libx264 \
  -crf 16 \
  -preset slow \
  -c:a aac \
  -b:a 192k \
  -movflags +faststart \
  -pix_fmt yuv420p \
  "$OUTPUT"

echo ""
echo "✅  Done! Output: $OUTPUT"
du -sh "$OUTPUT"
