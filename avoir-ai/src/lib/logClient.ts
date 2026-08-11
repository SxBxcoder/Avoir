/**
 * Avoir — client-side logger.
 *
 * Wraps the console API but emits nothing in production builds, so dev noise
 * and identifiers never reach the browser console of real users. Keep messages
 * short and pass Error objects as the last argument so browsers print the full
 * stack.
 */

type Args = unknown[];

const enabled = process.env.NODE_ENV !== 'production';

export const clientLog = {
  debug: (...args: Args) => {
    if (enabled) console.debug(...args);
  },
  info: (...args: Args) => {
    if (enabled) console.info(...args);
  },
  warn: (...args: Args) => {
    if (enabled) console.warn(...args);
  },
  error: (...args: Args) => {
    if (enabled) console.error(...args);
  },
};
