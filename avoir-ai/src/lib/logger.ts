/**
 * Avoir — Structured logger.
 *
 * Zero-dependency replacement for `console.*` in server code. Features:
 *   - Level gating via LOG_LEVEL (debug | info | warn | error), default info.
 *   - PII redaction as a second line of defense: emails, Bearer tokens and
 *     Cognito subs are scrubbed from every message even if a call site
 *     accidentally includes them. Call sites must still not log user ids.
 *   - Structured JSON lines when LOG_FORMAT=json (log-aggregation friendly);
 *     human-readable lines otherwise.
 *   - Never throws, so logging cannot take down a request path.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const REDACT_PATTERNS: RegExp[] = [
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, // email addresses
  /(Bearer\s+)[A-Za-z0-9._~+/=-]+/g, // Authorization headers
  /\bsub_[A-Za-z0-9-]{4,}/g, // Cognito subject claims
];

function redact(value: string): string {
  let text = value;
  for (const pattern of REDACT_PATTERNS) {
    text = text.replace(pattern, '$1[REDACTED]');
  }
  return text;
}

function sanitize(value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  return value;
}

function sanitizeMeta(meta: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    const cleaned = sanitize(value);
    out[key] = typeof cleaned === 'string' ? redact(cleaned) : cleaned;
  }
  return out;
}

function threshold(): number {
  const configured = process.env.LOG_LEVEL as LogLevel | undefined;
  return configured && configured in LEVEL_ORDER ? LEVEL_ORDER[configured] : LEVEL_ORDER.info;
}

function emit(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  if (LEVEL_ORDER[level] < threshold()) return;

  const entry = {
    level,
    time: new Date().toISOString(),
    msg: redact(message),
    ...(meta ? { meta: sanitizeMeta(meta) } : {}),
  };

  const line =
    process.env.LOG_FORMAT === 'json'
      ? JSON.stringify(entry)
      : `[${level.toUpperCase()}] ${entry.msg}`;

  try {
    const stream = level === 'error' ? process.stderr : process.stdout;
    stream.write(line + '\n');
  } catch {
    // Logging must never break a request path.
  }
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>): void => emit('debug', message, meta),
  info: (message: string, meta?: Record<string, unknown>): void => emit('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>): void => emit('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>): void => emit('error', message, meta),
};
