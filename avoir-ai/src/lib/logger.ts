/**
 * Avoir — structured JSON logger for server code.
 *
 * Emits one JSON object per line to stdout (info/debug) or stderr
 * (warn/error) so logs stay queryable in CloudWatch/Datadog without a logging
 * SDK. Severity is gated by the LOG_LEVEL env var (debug|info|warn|error,
 * default info); error() is always emitted.
 *
 * Log call-site policy:
 *   - info:   operational facts only — no user identifiers (no userId, email,
 *             customerId, session.id).
 *   - debug:  detailed payloads and identifiers, when needed.
 *   - warn/error: failures and security-relevant events; identifiers allowed
 *             only when needed to investigate.
 *   - Error instances passed in `extra` are serialized to { message, stack }.
 */

type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_RANK: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const configuredLevel = (process.env.LOG_LEVEL || 'info').toLowerCase() as Level;
const threshold = LEVEL_RANK[configuredLevel] ?? LEVEL_RANK.info;

function write(level: Level, scope: string, message: string, extra?: Record<string, unknown>): void {
  if (level !== 'error' && LEVEL_RANK[level] < threshold) return;

  const payload: Record<string, unknown> = { level, scope, msg: message };

  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      payload[key] = value instanceof Error ? { message: value.message, stack: value.stack } : value;
    }
  }

  payload.ts = new Date().toISOString();

  const line = JSON.stringify(payload);
  if (level === 'warn' || level === 'error') {
    console.error(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (scope: string, message: string, extra?: Record<string, unknown>) => write('debug', scope, message, extra),
  info: (scope: string, message: string, extra?: Record<string, unknown>) => write('info', scope, message, extra),
  warn: (scope: string, message: string, extra?: Record<string, unknown>) => write('warn', scope, message, extra),
  error: (scope: string, message: string, extra?: Record<string, unknown>) => write('error', scope, message, extra),
};
