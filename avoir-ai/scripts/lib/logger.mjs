/**
 * Avoir — structured JSON logger for standalone scripts.
 *
 * Mirrors src/lib/logger.ts (one JSON object per line, LOG_LEVEL gated,
 * warn/error → stderr) but uses process.stdout/stderr.write directly so it
 * runs in plain Node without the TS toolchain or path aliases.
 */

const LEVEL_RANK = { debug: 10, info: 20, warn: 30, error: 40 };

const configuredLevel = (process.env.LOG_LEVEL || 'info').toLowerCase();
const threshold = LEVEL_RANK[configuredLevel] ?? LEVEL_RANK.info;

function write(level, scope, message, extra) {
  if (level !== 'error' && LEVEL_RANK[level] < threshold) return;

  const payload = { level, scope, msg: message };

  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      payload[key] = value instanceof Error ? { message: value.message, stack: value.stack } : value;
    }
  }

  payload.ts = new Date().toISOString();

  const line = JSON.stringify(payload) + '\n';
  if (level === 'warn' || level === 'error') {
    process.stderr.write(line);
  } else {
    process.stdout.write(line);
  }
}

export const logger = {
  debug: (scope, message, extra) => write('debug', scope, message, extra),
  info: (scope, message, extra) => write('info', scope, message, extra),
  warn: (scope, message, extra) => write('warn', scope, message, extra),
  error: (scope, message, extra) => write('error', scope, message, extra),
};
