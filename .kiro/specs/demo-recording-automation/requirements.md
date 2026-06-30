# Requirements Document

## Introduction

The Demo Recording Automation Pipeline is a fully automated toolchain that produces a cinematic 60–90 second MP4 video showcasing the Prachar.ai application. A single command (`./run_demo.sh`) orchestrates four components — a Playwright browser automation script, an OBS Studio WebSocket controller, an FFmpeg post-processing pipeline, and a master shell script — to capture, assemble, grade, and export the final demo video without any manual interaction.

The pipeline navigates the live Prachar.ai application through a 14-shot sequence covering the Landing Page, Campaign Dashboard (War Room), campaign generation via the Diamond Cascade Engine, and the Omni-Deck Command Center. The raw screen recording is then post-processed with speed ramps, zoom punches on click moments, cinematic color grading, caption overlays, and a music track, producing a broadcast-ready MP4.

---

## Glossary

- **Pipeline**: The end-to-end automation system composed of `run_demo.sh`, `demo.js`, `obs_controller.js`, and `grade.sh`.
- **Shot**: A discrete, timed segment of the screen recording corresponding to a specific UI state or interaction in the demo sequence.
- **Demo Sequence**: The ordered list of 14 shots that the Browser Automation Script must execute against the Prachar.ai application.
- **Demo Mode**: The application state activated by the `/?demo=true` URL parameter, which bypasses AWS Cognito authentication and presents the Campaign Dashboard as user `commander@prachar.ai`.
- **Diamond Cascade Engine**: The AI campaign generation subsystem of Prachar.ai that produces campaign assets (Hook, Offer, CTA, Captions) via a Server-Sent Events stream.
- **SSE (Server-Sent Events)**: A server-push technology used by Prachar.ai to stream campaign generation status and output tokens to the browser in real time.
- **War Room**: The Campaign Dashboard page of Prachar.ai, accessible after authentication or via Demo Mode.
- **Omni-Deck**: The Omni-Deck Command Center page (`/omnideck`) containing the Live Trend Radar, Auto-Sniper Mutator, and Authority Defender panels.
- **Live Trend Radar**: The panel within Omni-Deck displaying real-time trend cards with virality scores and a "Snipe Trend" action per card.
- **Auto-Sniper Mutator**: The panel within Omni-Deck that generates platform-variant content for Instagram Reels, TikTok, and YouTube Shorts after a trend is sniped.
- **Authority Defender**: The panel within Omni-Deck displaying a live engagement stream for brand authority monitoring.
- **Shadow Clone**: The video generation feature in the Campaign Dashboard, triggered by the "SUMMON SHADOW CLONE" button.
- **OBS Studio**: Open Broadcaster Software, a third-party screen recording application controlled by the Pipeline via its WebSocket API.
- **OBS WebSocket**: The built-in WebSocket server in OBS Studio (version 28+) that exposes a remote control API for starting and stopping recordings programmatically.
- **OBS Scene**: A named configuration in OBS Studio that defines capture sources, layout, and encoding settings for a recording session.
- **MKV**: The raw recording container format output by OBS Studio before post-processing.
- **FFmpeg**: A command-line multimedia processing tool used for post-processing the raw OBS recording into the final MP4.
- **Speed Ramp**: A temporal effect that changes the playback speed of a video segment — navigation sections play at 1.5× speed; generation reveal sections play at 0.85× speed.
- **Zoom Punch**: A brief zoom-in effect applied at click moments — the viewport scales from 1.0× to 1.15× over 3 frames, holds for 5 frames, then returns to 1.0× over 3 frames.
- **Color Grade**: A visual tone-mapping operation applied to the entire video using the FFmpeg `colorbalance` and `curves` filters to achieve a cinematic look.
- **zoompan**: The FFmpeg filter used to implement the Zoom Punch effect by animating pan and zoom parameters frame by frame.
- **setpts**: The FFmpeg filter used to implement Speed Ramps by modifying the presentation timestamp of each frame.
- **Caption Overlay**: A text element burned into the video at a designated time range using the FFmpeg `drawtext` filter.
- **timestamps.json**: A JSON file written by the Browser Automation Script recording the start and end times of key pipeline events, used by the FFmpeg Post-Processor to place Speed Ramps and Zoom Punches.
- **CRF (Constant Rate Factor)**: An FFmpeg H.264 encoding quality parameter; lower values produce higher quality. The Pipeline uses CRF 16.
- **faststart**: An MP4 container flag (`-movflags +faststart`) that relocates the MOOV atom to the beginning of the file, enabling streaming playback before the full file is downloaded.
- **dotenv**: A Node.js library that loads environment variables from a `.env` file into `process.env`.
- **Cinematic Scroll**: A smooth scrolling motion implemented via `window.scrollBy` in 300-pixel increments with 800 milliseconds between each increment.
- **Magnetic Button**: The send/generate button in the Campaign Dashboard, identified by the CSS class `.magnetic-btn`.
- **COOKING Loader**: The animated loading indicator displayed during SSE streaming, identified by the CSS class `.cooking-loader` and `.cooking-dots`.
- **Inter**: The font family used for all Caption Overlays in the final video.

---

## Requirements

### Requirement 1: Master Orchestration Script

**User Story:** As a developer, I want a single shell script that runs the entire demo pipeline, so that I can produce the final demo video with one command and no manual steps.

#### Acceptance Criteria

1. THE `run_demo.sh` Script SHALL accept zero arguments and execute the full pipeline from start to finish without requiring manual interaction.
2. WHEN `run_demo.sh` is executed, THE Script SHALL verify that `ffmpeg` is available on the system PATH before proceeding; IF `ffmpeg` is not found, THEN THE Script SHALL print a human-readable error message identifying `ffmpeg` and exit with status code `1`.
3. WHEN `run_demo.sh` is executed, THE Script SHALL verify that `node` is available on the system PATH before proceeding; IF `node` is not found, THEN THE Script SHALL print a human-readable error message identifying `node` and exit with status code `1`.
4. WHEN `run_demo.sh` is executed, THE Script SHALL verify that OBS Studio is running as a process (identified by the process name `obs` on Linux/macOS or `obs64.exe`/`obs32.exe` on Windows) before proceeding; IF OBS Studio is not running, THEN THE Script SHALL print a human-readable error message and exit with status code `1`.
5. WHEN all dependency checks pass, THE Script SHALL start the OBS Recording Controller by invoking `node demo/obs/obs_controller.js start`.
6. WHEN the OBS Recording Controller has started, THE Script SHALL wait 2 seconds before launching the Browser Automation Script.
7. WHEN the Browser Automation Script exits, THE Script SHALL wait 1 second before stopping the OBS Recording Controller.
8. WHEN the OBS Recording Controller stops, THE Script SHALL retrieve the raw MKV output file path by capturing the stdout of `node demo/obs/obs_controller.js path`.
9. WHEN the raw MKV path is available and the file exists on disk, THE Script SHALL invoke `bash demo/ffmpeg/grade.sh "$MKV_PATH"` as the FFmpeg Post-Processor.
10. WHEN the FFmpeg Post-Processor exits with status code `0`, THE Script SHALL print the absolute path of `demo/prachar_demo_final.mp4` to standard output.
11. WHEN `prachar_demo_final.mp4` is produced, THE Script SHALL open the file using the platform-appropriate command: `xdg-open` on Linux, `open` on macOS.
12. THE Script SHALL source configuration from `demo/.env` using `set -a; source demo/.env; set +a` before any pipeline step begins; IF `demo/.env` does not exist, THEN THE Script SHALL print a warning and continue using only environment variables already set in the shell.
13. IF any pipeline step exits with a non-zero status code, THEN THE Script SHALL print a message in the format `[PIPELINE ERROR] Step "<step-name>" failed with exit code <N>` to standard error and exit with the same non-zero status code.

---

### Requirement 2: Environment Configuration

**User Story:** As a developer, I want a `.env` template that declares all required configuration variables, so that I can set up the pipeline environment without reading the full source code.

#### Acceptance Criteria

1. THE `demo/.env` Template SHALL declare the variable `OBS_PASSWORD` as required for the OBS WebSocket server password, annotated with `# REQUIRED` in the template.
2. THE `demo/.env` Template SHALL declare the variable `OBS_PORT` as optional for the OBS WebSocket server port, annotated with `# OPTIONAL — default: 4455` in the template.
3. THE `demo/.env` Template SHALL declare the variable `OBS_SCENE` as required for the name of the OBS scene to activate before recording, annotated with `# REQUIRED` in the template.
4. THE `demo/.env` Template SHALL declare the variable `APP_URL` as required for the base URL of the Prachar.ai application, formatted without a trailing slash and including a scheme (e.g., `https://main.d2u0mm6cr1j81.amplifyapp.com`), annotated with `# REQUIRED — no trailing slash` in the template.
5. THE `demo/.env` Template SHALL declare the variable `DEMO_EMAIL` as optional for the fallback Cognito authentication email credential, annotated with `# OPTIONAL — fallback auth only` in the template.
6. THE `demo/.env` Template SHALL declare the variable `DEMO_PASSWORD` as optional for the fallback Cognito authentication password credential, annotated with `# OPTIONAL — fallback auth only` in the template.
7. THE Pipeline SHALL read all configuration exclusively from `demo/.env` and environment variables; no configuration values SHALL be hardcoded in `demo.js`, `obs_controller.js`, or `grade.sh`.
8. WHEN `OBS_PORT` is absent from `demo/.env` or is set to an empty string, THE OBS Recording Controller SHALL use port `4455` as the default value.

---

### Requirement 3: Browser Automation — Initialization and Authentication

**User Story:** As a developer, I want the browser automation script to launch Prachar.ai in a controlled browser context and authenticate without manual login, so that the demo sequence begins from a consistent, authenticated state.

#### Acceptance Criteria

1. THE Browser Automation Script SHALL launch a Chromium browser instance with the `headless` option set to `false`.
2. THE Browser Automation Script SHALL pass `--start-fullscreen` and `--disable-blink-features=AutomationControlled` as launch arguments to the Chromium instance.
3. THE Browser Automation Script SHALL create a browser context with a viewport of exactly 1920 pixels wide and 1080 pixels tall; IF the actual viewport dimensions reported by the browser differ from 1920×1080, THEN THE Browser Automation Script SHALL exit with a non-zero status code before beginning the Demo Sequence.
4. THE Browser Automation Script SHALL navigate to `APP_URL + '/?demo=true'` as the primary authentication strategy, bypassing AWS Cognito.
5. WHEN the Demo Mode navigation does not result in a visible Campaign Dashboard element (identified by the text `"Enter your campaign directive..."` or `"POWERED BY DIAMOND CASCADE ENGINE"`) within 10 seconds, THE Browser Automation Script SHALL attempt the fallback authentication flow by navigating to `APP_URL + '/login'`.
6. WHEN the fallback authentication flow is used, THE Browser Automation Script SHALL locate the email input by placeholder text `"you@example.com"`, type the value of `DEMO_EMAIL`, locate the password input by placeholder text `"Enter your password"`, type the value of `DEMO_PASSWORD`, and submit by clicking the button with visible text `"Sign In"`.
7. IF `DEMO_EMAIL` or `DEMO_PASSWORD` is absent or empty when the fallback authentication flow is triggered, THEN THE Browser Automation Script SHALL exit with a non-zero status code and a message identifying the missing variable.
8. WHEN the fallback authentication flow is used, THE Browser Automation Script SHALL confirm the Campaign Dashboard is visible by waiting for an element matching `"Enter your campaign directive..."` to appear, with a timeout of 10 seconds; IF the element does not appear within 10 seconds, THEN THE Browser Automation Script SHALL exit with a non-zero status code.

---

### Requirement 4: Browser Automation — Demo Sequence Execution

**User Story:** As a developer, I want the browser automation script to execute all 14 shots in order with cinematic timing, so that the recorded footage covers the full feature story of Prachar.ai.

#### Acceptance Criteria

1. THE Browser Automation Script SHALL execute all 14 shots of the Demo Sequence in the order defined in the Shot Table.
2. WHEN executing Shot 1, THE Browser Automation Script SHALL navigate to the unauthenticated landing page (`/`) and hold for 3 seconds before proceeding.
3. WHEN executing Shot 2, THE Browser Automation Script SHALL perform a Cinematic Scroll down the landing page, pausing 800 milliseconds between each 300-pixel increment, to reveal the features grid, how-it-works section, and stats bar.
4. WHEN executing Shot 3, THE Browser Automation Script SHALL navigate to the Campaign Dashboard via Demo Mode (`/?demo=true`).
5. WHEN executing Shot 4, THE Browser Automation Script SHALL hold on the Campaign Dashboard welcome screen displaying the four quick-action cards for 2 seconds.
6. WHEN executing Shot 5, THE Browser Automation Script SHALL type the campaign prompt `"Nike Air Max launch — Gen Z audience — Instagram, TikTok, LinkedIn"` into the input field identified by placeholder text `"Enter your campaign directive..."` with a 60-millisecond delay between each keystroke.
7. WHEN executing Shot 6, THE Browser Automation Script SHALL pause for 1 second after typing is complete, then click the Magnetic Button (`.magnetic-btn`).
8. WHEN executing Shot 7, THE Browser Automation Script SHALL wait for the SSE stream to complete by detecting the text `"✅ Strategic Campaign Compiled."` on the page, with a timeout of 30 seconds.
9. IF the text `"✅ Strategic Campaign Compiled."` does not appear within 30 seconds during Shot 7, THEN THE Browser Automation Script SHALL fall back to waiting for the `.cooking-dots` element to disappear from the DOM before continuing.
10. WHEN executing Shot 8, THE Browser Automation Script SHALL perform a Cinematic Scroll through the campaign output canvas, revealing the Hook card, Offer card, CTA card, and all Caption cards in sequence.
11. WHEN executing Shot 9, THE Browser Automation Script SHALL hover over the "SUMMON SHADOW CLONE" button and hold for 2 seconds.
12. WHEN executing Shot 10, THE Browser Automation Script SHALL click the "Omni-Deck" navigation item in the left sidebar to navigate to the Omni-Deck page.
13. WHEN executing Shot 11, THE Browser Automation Script SHALL hold on the Live Trend Radar section displaying trend cards for 3 seconds.
14. WHEN executing Shot 12, THE Browser Automation Script SHALL click a "Snipe Trend" button on one trend card; THE Browser Automation Script SHALL then hold on each platform variant toggle ("Instagram Reels", "TikTok", "YouTube Shorts") for 2 seconds each, regardless of whether the "Snipe Trend" click succeeded.
15. WHEN executing Shot 13, THE Browser Automation Script SHALL scroll down to the Authority Defender section and hold for 2 seconds.
16. WHEN executing Shot 14, THE Browser Automation Script SHALL hold on the final visible screen for 3 seconds before exiting.
17. THE Browser Automation Script SHALL execute all shots in the order specified; no shot SHALL be skipped or reordered.

---

### Requirement 5: Browser Automation — Timestamps Logging

**User Story:** As a developer, I want the browser automation script to record the precise timing of key events, so that the FFmpeg post-processor can accurately place speed ramps and zoom punches without manual time-coding.

#### Acceptance Criteria

1. WHEN the Demo Sequence completes, THE Browser Automation Script SHALL write a `timestamps.json` file to the `demo/` directory.
2. THE `timestamps.json` file SHALL contain the key `nav_start` with the Unix timestamp in milliseconds at which `page.goto(APP_URL)` was called.
3. THE `timestamps.json` file SHALL contain the key `nav_end` with the Unix timestamp in milliseconds at which the Campaign Dashboard became visible (detected by the `"Enter your campaign directive..."` element appearing).
4. THE `timestamps.json` file SHALL contain the key `generation_start` with the Unix timestamp in milliseconds at which the Magnetic Button (`.magnetic-btn`) was clicked.
5. THE `timestamps.json` file SHALL contain the key `generation_end` with the Unix timestamp in milliseconds at which the SSE stream emitted its terminal completion marker, detected by the text `"✅ Strategic Campaign Compiled."` appearing in the DOM.
6. THE `timestamps.json` file SHALL contain the key `scroll_start` with the Unix timestamp in milliseconds at which the first `window.scrollBy` call for the campaign output canvas was issued.
7. THE `timestamps.json` file SHALL contain the key `scroll_end` with the Unix timestamp in milliseconds at which the last `window.scrollBy` call for the campaign output canvas completed.
8. THE `timestamps.json` file SHALL contain the key `clicks` with a JSON array of Unix timestamps in milliseconds, capped at a maximum of 50 entries, with one entry recorded for each user-initiated click during the Demo Sequence.
9. WHEN the Browser Automation Script is about to write `timestamps.json`, THE Browser Automation Script SHALL validate that the ordering `nav_start ≤ nav_end ≤ generation_start ≤ generation_end ≤ scroll_start ≤ scroll_end` holds for all non-null values; IF any pair violates this ordering, THEN THE Browser Automation Script SHALL log the violation to standard error and write the file anyway, preserving all recorded values.
10. IF the Browser Automation Script fails mid-sequence, THEN THE Browser Automation Script SHALL write a partial `timestamps.json` containing all keys that were recorded up to the point of failure, with missing keys set to `null`.
11. WHEN `nav_end` is being recorded and the Campaign Dashboard element does not appear within 30 seconds of navigation, THE Browser Automation Script SHALL set `nav_end` to `null` and proceed to the partial-write behavior defined in criterion 10.
12. THE Browser Automation Script SHALL write `timestamps.json` to disk before signaling the OBS Recording Controller to stop recording.

---

### Requirement 6: Browser Automation — Resilience

**User Story:** As a developer, I want the browser automation script to handle failures gracefully so that OBS recording is always stopped and partial artifacts are always saved, even when the demo sequence encounters an unexpected error.

#### Acceptance Criteria

1. THE Browser Automation Script SHALL wrap the entire Demo Sequence execution in a try/finally block.
2. WHEN the Demo Sequence throws any unhandled error, THE Browser Automation Script SHALL log the error message and full stack trace to standard error before the finally block executes.
3. THE Browser Automation Script SHALL call `stopRecording()` on the OBS Recording Controller in the `finally` block, regardless of whether the Demo Sequence succeeded or failed; IF `stopRecording()` itself throws an error, THEN that error SHALL be caught and logged to standard error, and execution SHALL continue to the next finally step.
4. THE Browser Automation Script SHALL call `browser.close()` in the `finally` block, regardless of whether the Demo Sequence succeeded or failed; IF `browser.close()` throws an error, THEN that error SHALL be caught and logged to standard error.
5. IF `timestamps.json` does not exist at `demo/timestamps.json` when the `finally` block executes, THEN THE Browser Automation Script SHALL write a partial `timestamps.json` using all timestamp values collected up to the point of failure, with any uncollected keys set to `null`, before closing the browser.
6. WHEN the Demo Sequence threw an unhandled error, THE Browser Automation Script SHALL exit with a non-zero status code after the `finally` block completes; WHEN the Demo Sequence completed without error, THE Browser Automation Script SHALL exit with status code `0`.

---

### Requirement 7: OBS Recording Controller — Connection and Scene Management

**User Story:** As a developer, I want the OBS controller to connect to OBS Studio via WebSocket and verify the correct scene is active, so that the recording captures exactly the intended screen area with the correct encoding settings.

#### Acceptance Criteria

1. THE OBS Recording Controller SHALL connect to OBS Studio using the `obs-websocket-js` library.
2. THE OBS Recording Controller SHALL read the WebSocket host as `localhost`, the port from the `OBS_PORT` environment variable (defaulting to `4455`), and the password from the `OBS_PASSWORD` environment variable.
3. WHEN connecting to OBS Studio, THE OBS Recording Controller SHALL verify that the scene named in the `OBS_SCENE` environment variable exists in OBS before switching to it; IF the scene does not exist, THEN THE OBS Recording Controller SHALL throw an error with a message identifying the missing scene name while keeping the OBS WebSocket connection open for potential retry attempts.
4. WHEN the target scene exists, THE OBS Recording Controller SHALL switch OBS Studio to that scene before starting the recording.

---

### Requirement 8: OBS Recording Controller — Recording Lifecycle

**User Story:** As a developer, I want the OBS controller to expose start, stop, and path-retrieval functions so that the master script can manage the recording lifecycle programmatically.

#### Acceptance Criteria

1. THE OBS Recording Controller SHALL expose a `startRecording()` function that sends the start recording command to OBS Studio via WebSocket.
2. THE OBS Recording Controller SHALL expose a `stopRecording()` function that sends the stop recording command to OBS Studio via WebSocket.
3. THE OBS Recording Controller SHALL expose a `getOutputPath()` function that returns the absolute file path of the most recently completed MKV recording as a string.
4. WHEN `stopRecording()` is called, THE OBS Recording Controller SHALL wait for OBS Studio to confirm the recording has stopped before `stopRecording()` resolves.
5. THE OBS Recording Controller SHALL configure the OBS output to use the MKV container format before starting the recording.
6. THE OBS Recording Controller SHALL configure the OBS output to record at 1920×1080 resolution and 60 frames per second before starting the recording.
7. THE OBS Recording Controller SHALL configure the OBS output video bitrate to 40000 kilobits per second before starting the recording.
8. IF the WebSocket connection to OBS Studio cannot be established, THEN THE OBS Recording Controller SHALL throw an error with the connection details (host, port) included in the error message.

---

### Requirement 9: FFmpeg Post-Processor — Speed Ramps

**User Story:** As a developer, I want the post-processor to apply variable speed ramps to navigation and generation segments, so that the pacing of the demo video is dynamic and keeps the viewer engaged.

#### Acceptance Criteria

1. THE FFmpeg Post-Processor SHALL accept the raw MKV recording file path as its first positional argument (`$1`) and write the output to `demo/prachar_demo_final.mp4`.
2. THE FFmpeg Post-Processor SHALL read `demo/timestamps.json` to determine the time boundaries for all speed ramps and zoom punches; IF `demo/timestamps.json` is absent or malformed (not valid JSON), THEN THE FFmpeg Post-Processor SHALL exit with a non-zero status code and a descriptive error message.
3. THE FFmpeg Post-Processor SHALL apply a 1.5× playback speed ramp (implemented as an instantaneous `setpts=PTS/1.5` change) to the video segment spanning from `nav_start` to `nav_end` (both expressed in seconds relative to the recording start); IF `nav_start` or `nav_end` is `null` in `timestamps.json`, THEN THE FFmpeg Post-Processor SHALL skip the navigation speed ramp and log a warning.
4. THE FFmpeg Post-Processor SHALL apply a 0.85× playback speed ramp (implemented as `setpts=PTS/0.85`) to the video segment spanning from `generation_start` to `generation_end`; IF `generation_start` or `generation_end` is `null` in `timestamps.json`, THEN THE FFmpeg Post-Processor SHALL skip the generation speed ramp and log a warning.
5. THE FFmpeg Post-Processor SHALL preserve the original playback speed for all video segments not covered by a defined speed ramp.
6. THE FFmpeg Post-Processor SHALL apply the corresponding audio speed adjustment (`atempo`) in sync with each video speed ramp so that audio and video remain synchronized in the output.

---

### Requirement 10: FFmpeg Post-Processor — Zoom Punches

**User Story:** As a developer, I want the post-processor to apply a zoom punch effect on every click moment, so that user interactions feel impactful and cinematic in the final video.

#### Acceptance Criteria

1. WHEN `timestamps.json["clicks"]` contains one or more entries, THE FFmpeg Post-Processor SHALL apply a Zoom Punch effect at each timestamp using the FFmpeg `zoompan` filter; IF `timestamps.json["clicks"]` is an empty array or `null`, THEN THE FFmpeg Post-Processor SHALL skip zoom punch processing and log an informational message.
2. THE Zoom Punch effect SHALL animate the zoom level from 1.0 to 1.15 using linear interpolation over exactly 3 frames (at the 60 fps recording rate established in Requirement 8, this equals 50 ms); each timestamp in `clicks` is expressed in milliseconds and SHALL be converted to a frame number by multiplying by 0.06.
3. THE Zoom Punch effect SHALL hold the zoom level at 1.15 for exactly 5 frames.
4. THE Zoom Punch effect SHALL animate the zoom level from 1.15 back to 1.0 using linear interpolation over exactly 3 frames.
5. THE zoom anchor point for each Zoom Punch SHALL be the center of the frame (x = `iw/2`, y = `ih/2`).
6. WHEN two click timestamps are fewer than 11 frames apart (the total duration of one Zoom Punch), THE FFmpeg Post-Processor SHALL apply only the first Zoom Punch for that overlapping pair and log a warning identifying the skipped timestamp.
7. THE FFmpeg Post-Processor SHALL apply Zoom Punch effects for all non-overlapping click timestamps present in the `clicks` array; no eligible click SHALL be skipped.

---

### Requirement 11: FFmpeg Post-Processor — Color Grading

**User Story:** As a developer, I want the post-processor to apply a consistent cinematic color grade to the entire video, so that the final output has a polished, premium visual feel matching the Prachar.ai brand.

#### Acceptance Criteria

1. THE FFmpeg Post-Processor SHALL apply the color grade `colorbalance=bs=0.05:bh=-0.03` to the entire video.
2. THE FFmpeg Post-Processor SHALL apply the curve adjustment `curves=all='0/0 0.5/0.55 1/1'` to the entire video.
3. THE color grade and curve adjustment SHALL be applied to every frame of the output video without exception.

---

### Requirement 12: FFmpeg Post-Processor — Caption Overlays

**User Story:** As a developer, I want the post-processor to burn four timed caption overlays into the video using the Inter font, so that key messages are communicated directly in the video without requiring a separate subtitle track.

#### Acceptance Criteria

1. THE FFmpeg Post-Processor SHALL burn four Caption Overlays into the video using the FFmpeg `drawtext` filter.
2. THE Caption Overlays SHALL use the Inter font family at 64 pixels.
3. THE Caption Overlays SHALL render in white (`fontcolor=white`) text, horizontally centered using the expression `x=(w-text_w)/2` and vertically positioned at `y=h-120`.
4. WHEN a Caption Overlay is active, THE Caption Overlay SHALL fade in by linearly increasing its alpha from 0 to 1 over the first 0.5 seconds after its start time, and fade out by linearly decreasing its alpha from 1 to 0 over the last 0.5 seconds before its end time; the visible window of each caption SHALL be at least 1.0 second so that fade-in and fade-out do not overlap.
5. THE FFmpeg Post-Processor SHALL render Caption Overlay 1 with the text `"One input."` visible at absolute output-video time 3 seconds through 6 seconds (post-ramp timestamps, not derived from `timestamps.json`).
6. THE FFmpeg Post-Processor SHALL render Caption Overlay 2 with the text `"Full campaign."` visible at absolute output-video time 10 seconds through 14 seconds.
7. THE FFmpeg Post-Processor SHALL render Caption Overlay 3 with the text `"Every platform."` visible at absolute output-video time 18 seconds through 22 seconds.
8. THE FFmpeg Post-Processor SHALL render Caption Overlay 4 with the text `"prachar.ai"` visible at absolute output-video time 26 seconds through 30 seconds.
9. THE caption timestamps in criteria 5–8 are hardcoded absolute output-video seconds applied after all speed ramps have been processed; they SHALL NOT be derived from or adjusted by values in `timestamps.json`.
10. IF the Inter font file cannot be found on the system or at the path specified to the `drawtext` filter, THEN THE FFmpeg Post-Processor SHALL exit with a non-zero status code and a message identifying the missing font path.

---

### Requirement 13: FFmpeg Post-Processor — Music and Audio

**User Story:** As a developer, I want the post-processor to mix an ambient music track into the final video with proper fade-in and fade-out, so that the demo video has a professional audio experience.

#### Acceptance Criteria

1. WHEN the FFmpeg Post-Processor begins execution, THE FFmpeg Post-Processor SHALL mix the audio file at `demo/assets/music.mp3` into the output video.
2. THE music track SHALL be mixed at −18 dB relative to full scale using the FFmpeg `volume` filter.
3. WHEN mixing the music track, THE music track SHALL fade in from silence (0 dB) to its target level (−18 dB) linearly over the first 2 seconds of the output video.
4. WHEN mixing the music track, THE music track SHALL fade out from its target level (−18 dB) to silence linearly over the 3 seconds ending at the output video's final frame.
5. IF `demo/assets/music.mp3` does not exist at the time the FFmpeg Post-Processor runs, THEN THE FFmpeg Post-Processor SHALL print `[ERROR] Music file not found: demo/assets/music.mp3` to standard error and exit with a non-zero status code.
6. WHEN the music track is shorter than the output video duration, THE FFmpeg Post-Processor SHALL play the music track once and stop at its natural end without looping.
7. WHEN the input MKV recording contains an audio stream, THE FFmpeg Post-Processor SHALL preserve that stream at its original level in the mix alongside the music track.

---

### Requirement 14: FFmpeg Post-Processor — Final Encode and Output

**User Story:** As a developer, I want the post-processor to produce a single, web-optimized MP4 file with specific encoding parameters, so that the output is universally playable and suitable for direct upload to social platforms or sharing via URL.

#### Acceptance Criteria

1. THE FFmpeg Post-Processor SHALL produce a single output file named `prachar_demo_final.mp4` in the `demo/` directory.
2. THE output video SHALL be encoded using the `libx264` codec with a CRF value of `16` and the `slow` preset.
3. THE output audio SHALL be encoded using the `aac` codec at a bitrate of 192 kilobits per second.
4. THE output MP4 SHALL include the `+faststart` movflags flag so that playback can begin before the full file is downloaded.
5. THE output MP4 SHALL have a total duration between 60 seconds and 90 seconds inclusive.
6. WHEN `prachar_demo_final.mp4` already exists in the `demo/` directory and the newly produced output has a valid non-zero duration and file size, THE FFmpeg Post-Processor SHALL overwrite it without prompting; IF the newly produced output is invalid (zero duration, zero bytes, or unreadable), THEN THE FFmpeg Post-Processor SHALL NOT overwrite the existing file and SHALL exit with a non-zero status code.

---

### Requirement 15: Pipeline Integrity and Ordering

**User Story:** As a developer, I want the pipeline to enforce strict ordering and data dependencies between components, so that no step runs with stale or missing inputs and the final output is always reproducible.

#### Acceptance Criteria

1. THE FFmpeg Post-Processor SHALL NOT begin execution until `timestamps.json` is present and contains non-null values for `nav_start`, `nav_end`, `generation_start`, `generation_end`, `scroll_start`, and `scroll_end`.
2. THE FFmpeg Post-Processor SHALL NOT begin execution until the raw MKV recording file exists at the path provided by `getOutputPath()`.
3. THE OBS Recording Controller SHALL NOT stop the recording until the Browser Automation Script has written `timestamps.json` to disk.
4. THE Browser Automation Script SHALL NOT begin the campaign output canvas scroll (Shot 8) until SSE stream completion has been confirmed.
5. THE Browser Automation Script SHALL visit all 14 shots in the defined sequence order; no shot SHALL begin before the previous shot's hold or wait condition is satisfied.

---

### Requirement 16: Dependency and Environment Validation

**User Story:** As a developer, I want the pipeline to validate its environment upfront and produce clear error messages for any missing dependency, so that I can diagnose setup issues quickly without reading log files.

#### Acceptance Criteria

1. WHEN `run_demo.sh` is executed, THE Script SHALL check for the presence of `ffmpeg`, `node`, and a running OBS Studio process before executing any pipeline step.
2. WHEN a required dependency is missing, THE `run_demo.sh` Script SHALL print an error message in the format `[MISSING] <dependency>: <one-sentence remediation hint>` to standard error and exit with status code `1`.
3. WHEN the OBS Recording Controller module is loaded, THE OBS Recording Controller SHALL attempt to establish the WebSocket connection to OBS Studio and confirm it is reachable before the Browser Automation Script begins navigating; IF the WebSocket connection attempt fails, THEN THE OBS Recording Controller SHALL throw an error that causes `run_demo.sh` to exit with a non-zero status code.
4. THE Browser Automation Script SHALL validate that `APP_URL` is set and non-empty at startup; IF `APP_URL` is absent or empty, THEN THE Browser Automation Script SHALL exit with a non-zero status code and the message `[CONFIG ERROR] APP_URL is not set`.
5. THE FFmpeg Post-Processor SHALL validate that `$1` is provided as a non-empty string and that the file exists at that path before beginning any processing; IF the file is absent or `$1` is empty, THEN THE FFmpeg Post-Processor SHALL print `[ERROR] Input MKV not found: <path>` to standard error and exit with a non-zero status code.
