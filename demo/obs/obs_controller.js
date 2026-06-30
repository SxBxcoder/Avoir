/**
 * Prachar.ai — OBS WebSocket Controller
 * ======================================
 * Controls OBS Studio via obs-websocket-js v5 protocol.
 *
 * Usage (from run_demo.sh):
 *   node demo/obs/obs_controller.js start   — connect, switch scene, start recording
 *   node demo/obs/obs_controller.js stop    — stop recording, disconnect
 *   node demo/obs/obs_controller.js path    — print path of last recording to stdout
 *
 * Env vars (from .env in project root):
 *   OBS_PASSWORD  — OBS websocket password (set in OBS → Tools → WebSocket)
 *   OBS_PORT      — defaults to 4455
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const OBSWebSocket = require('obs-websocket-js').default || require('obs-websocket-js');

const OBS_HOST = 'localhost';
const OBS_PORT = parseInt(process.env.OBS_PORT || '4455', 10);
const OBS_PASSWORD = process.env.OBS_PASSWORD || '';
const DEMO_SCENE = 'Prachar Demo';

// ── Helper: connect ──────────────────────────────────────────────────────────
async function connect() {
  const obs = new OBSWebSocket();
  try {
    await obs.connect(`ws://${OBS_HOST}:${OBS_PORT}`, OBS_PASSWORD, {
      rpcVersion: 1,
    });
    console.log(`[OBS] Connected to ws://${OBS_HOST}:${OBS_PORT}`);
    return obs;
  } catch (err) {
    console.error(`[OBS] Connection failed: ${err.message}`);
    console.error(
      `  → Make sure OBS is open with WebSocket enabled (Tools → WebSocket Server Settings)`
    );
    process.exit(1);
  }
}

// ── startRecording ────────────────────────────────────────────────────────────
async function startRecording() {
  const obs = await connect();

  try {
    // Switch to the Prachar Demo scene
    await obs.call('SetCurrentProgramScene', { sceneName: DEMO_SCENE });
    console.log(`[OBS] Scene set to "${DEMO_SCENE}"`);
  } catch (err) {
    console.warn(
      `[OBS] Warning: Could not switch to scene "${DEMO_SCENE}": ${err.message}`
    );
    console.warn('  → Proceeding with current active scene.');
  }

  try {
    await obs.call('StartRecord');
    console.log('[OBS] Recording started ✓');
  } catch (err) {
    console.error(`[OBS] Failed to start recording: ${err.message}`);
    await obs.disconnect();
    process.exit(1);
  }

  await obs.disconnect();
}

// ── stopRecording ─────────────────────────────────────────────────────────────
async function stopRecording() {
  const obs = await connect();

  try {
    const response = await obs.call('StopRecord');
    // obs-websocket v5 returns outputPath in StopRecord response
    const outputPath = response?.outputPath || 'unknown';
    console.log(`[OBS] Recording stopped ✓`);
    console.log(`[OBS] Output file: ${outputPath}`);

    // Persist for the "path" subcommand
    const fs = require('fs');
    const cachePath = require('path').join(__dirname, '..', '.last_recording_path');
    fs.writeFileSync(cachePath, outputPath, 'utf8');
  } catch (err) {
    console.error(`[OBS] Failed to stop recording: ${err.message}`);
    await obs.disconnect();
    process.exit(1);
  }

  await obs.disconnect();
}

// ── getOutputPath ─────────────────────────────────────────────────────────────
async function getOutputPath() {
  // First try the persisted path from stopRecording
  const fs = require('fs');
  const cachePath = require('path').join(__dirname, '..', '.last_recording_path');

  if (fs.existsSync(cachePath)) {
    const saved = fs.readFileSync(cachePath, 'utf8').trim();
    if (saved && saved !== 'unknown') {
      process.stdout.write(saved);
      return;
    }
  }

  // Fallback: query OBS for the recording output directory
  const obs = await connect();
  try {
    const { recordDirectory } = await obs.call('GetRecordDirectory');
    await obs.disconnect();

    // Find the most recently modified file in that directory
    const path = require('path');
    const files = fs.readdirSync(recordDirectory)
      .filter((f) => f.endsWith('.mkv') || f.endsWith('.mp4') || f.endsWith('.flv'))
      .map((f) => ({
        name: f,
        mtime: fs.statSync(path.join(recordDirectory, f)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime);

    if (files.length > 0) {
      const fullPath = path.join(recordDirectory, files[0].name);
      process.stdout.write(fullPath);
    } else {
      console.error('[OBS] No recording files found in output directory.');
      process.exit(1);
    }
  } catch (err) {
    console.error(`[OBS] Could not retrieve recording path: ${err.message}`);
    await obs.disconnect();
    process.exit(1);
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────
const action = process.argv[2];

switch (action) {
  case 'start':
    startRecording();
    break;
  case 'stop':
    stopRecording();
    break;
  case 'path':
    getOutputPath();
    break;
  default:
    console.error(`Usage: node obs_controller.js [start|stop|path]`);
    process.exit(1);
}
