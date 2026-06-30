# Implementation Plan: Demo Recording Automation

## Overview

Implement a four-component demo recording pipeline that produces a cinematic 60–90 second MP4 of
Prachar.ai from a single `./run_demo.sh` command. The implementation follows the dependency order:
project scaffold → OBS controller → browser automation → FFmpeg post-processor → master orchestrator →
tests. Each component is decoupled via file-based handoffs (`timestamps.json`, raw MKV).

---

## Tasks

- [ ] 1. Project scaffold — package.json, .env.example, and directory structure
  - [ ] 1.1 Create `demo/package.json` with exact-pinned dependencies
    - Write `demo/package.json` with `"dotenv": "16.4.5"`, `"obs-websocket-js": "5.0.6"`,
      `"playwright": "1.44.1"`, `"jest": "29.7.0"`, `"fast-check": "3.19.0"`
    - Add scripts: `"test": "jest"`, `"install:browsers": "playwright install chromium"`,
      `"demo": "bash run_demo.sh"`
    - Set `"engines": { "node": ">=18.0.0" }` and `"private": true`
    - _Requirements: 16.1 (dependency management)_

  - [ ] 1.2 Create `demo/.env.example` with all required and optional variable declarations
    - Declare `OBS_PASSWORD` annotated `# REQUIRED — OBS WebSocket server password`
    - Declare `OBS_PORT=4455` annotated `# OPTIONAL — default: 4455`
    - Declare `OBS_SCENE` annotated `# REQUIRED — OBS scene name for recording`
    - Declare `APP_URL=https://main.d2u0mm6cr1j81.amplifyapp.com` annotated
      `# REQUIRED — no trailing slash`
    - Declare `DEMO_EMAIL` annotated `# OPTIONAL — fallback auth only`
    - Declare `DEMO_PASSWORD` annotated `# OPTIONAL — fallback auth only`
    - _Requirements: 2.1–2.6_

  - [ ] 1.3 Create supporting directory structure and placeholder files
    - Create `demo/recordings/` directory (OBS output target)
    - Create `demo/assets/.gitkeep` so the assets directory is tracked in git
    - Create `demo/tests/unit/`, `demo/tests/integration/`, `demo/tests/fixtures/` directories
    - Create empty fixture files: `timestamps-valid.json`, `timestamps-partial.json`,
      `timestamps-inverted.json` in `demo/tests/fixtures/`
    - Create `jest.config.js` in `demo/` with `testEnvironment: 'node'` and
      `testMatch: ['**/tests/**/*.test.js']`
    - _Requirements: 2.7 (no hardcoded config)_

