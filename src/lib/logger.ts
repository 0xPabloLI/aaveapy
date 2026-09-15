/**
 * Structured application logger.
 *
 * Frontend logs end up in browser consoles (and, via the Sentry SDK, in
 * breadcrumbs — see src/lib/sentry.ts). Free-form console messages are hard
 * to correlate; every message through this logger carries:
 *   - an ISO timestamp
 *   - a level (debug | info | warn | error)
 *   - the message
 *   - scrubbed structured context (via logRedaction — wallets, tokens, and
 *     emails never leave in the clear)
 *
 * Output shape: JSON lines in production builds (machine-parseable), compact
 * prefixed lines in development (human-friendly consoles). Minimum level
 * comes from VITE_LOG_LEVEL (debug | info | warn | error), default `info`.
 */
import { redactValue } from '@/lib/logRedaction';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogFormat = 'json' | 'compact';

const LEVEL_WEIGHT: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function resolveMinLevel(): LogLevel {
  const raw = (import.meta.env.VITE_LOG_LEVEL as string | undefined)?.toLowerCase();
  if (raw && raw in LEVEL_WEIGHT) return raw as LogLevel;
  return 'info';
}

let minLevel = resolveMinLevel();

/** Test hook / runtime override. */
export function setLogLevel(level: LogLevel): void {
  minLevel = level;
}

/** Production builds emit JSON lines; dev/test emit compact readable lines. */
function resolveFormat(): LogFormat {
  return import.meta.env.PROD ? 'json' : 'compact';
}

/** Pure formatter so both output shapes are unit-testable. */
export function formatLogEntry(
  level: LogLevel,
  message: string,
  context: Record<string, unknown> | undefined,
  format: LogFormat,
): string {
  if (format === 'json') {
    const entry = {
      ts: new Date().toISOString(),
      level,
      msg: message,
      ...(context !== undefined ? { ctx: context } : {}),
    };
    return JSON.stringify(entry);
  }
  const suffix = context !== undefined ? ` ${JSON.stringify(context)}` : '';
  return `[${level.toUpperCase()}] ${message}${suffix}`;
}

function emit(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[minLevel]) return;

  const scrubbed = context ? (redactValue(context) as Record<string, unknown>) : undefined;
  const line = formatLogEntry(level, message, scrubbed, resolveFormat());

  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => emit('debug', message, context),
  info: (message: string, context?: Record<string, unknown>) => emit('info', message, context),
  warn: (message: string, context?: Record<string, unknown>) => emit('warn', message, context),
  error: (message: string, context?: Record<string, unknown>) => emit('error', message, context),
};
