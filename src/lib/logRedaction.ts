/**
 * Log scrubbing — PII / secret redaction utilities.
 *
 * The dashboard touches values that must never reach logs or error trackers
 * verbatim: wallet addresses (quasi-PII in DeFi), private keys / signatures,
 * bearer tokens from misconfigured headers, and user emails. These helpers
 * are used by `src/lib/logger.ts` (and may be reused before persisting
 * anything) so redaction has exactly one source of truth.
 */

const WALLET_ADDRESS = /\b0x[a-fA-F0-9]{40}\b/g;
const HEX_SECRET = /\b0x[a-fA-F0-9]{64}\b/g; // private keys, raw signatures
const BEARER_TOKEN = /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/g;
const API_KEY_PARAM = /([?&](?:api[_-]?key|key|access[_-]?token|token)=)[^&\s]+/gi;
const EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

/** Scrub every PII/secret pattern out of a plain string. */
export function redactText(text: string): string {
  return text
    .replace(HEX_SECRET, '[REDACTED_HEX_SECRET]')
    .replace(WALLET_ADDRESS, (m) => `${m.slice(0, 6)}…${m.slice(-4)}`)
    .replace(BEARER_TOKEN, 'Bearer [REDACTED]')
    .replace(API_KEY_PARAM, '$1[REDACTED]')
    .replace(EMAIL, '[REDACTED_EMAIL]');
}

/** Key names whose values must be dropped entirely, not just pattern-scrubbed. */
const SENSITIVE_KEY = /private[_-]?key|mnemonic|seed[_-]?phrase|password|secret|authorization|api[_-]?key|token/i;

const MAX_DEPTH = 4;

/**
 * Recursively redact strings, arrays, plain objects, and Errors.
 * Cycles are handled via WeakSet; depth is capped to keep logging O(1)-ish.
 */
export function redactValue(value: unknown, depth = 0, seen: WeakSet<object> = new WeakSet()): unknown {
  if (value == null) return value;

  if (typeof value === 'string') return redactText(value);

  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return value;

  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactText(value.message),
      stack: value.stack ? redactText(value.stack) : undefined,
    };
  }

  if (depth >= MAX_DEPTH) return '[MAX_DEPTH]';

  if (Array.isArray(value)) {
    if (seen.has(value)) return '[CYCLIC]';
    seen.add(value);
    return value.map((item) => redactValue(item, depth + 1, seen));
  }

  if (value instanceof Map) {
    if (seen.has(value)) return '[CYCLIC]';
    seen.add(value);
    return redactValue(Object.fromEntries(value), depth + 1, seen);
  }

  if (value instanceof Set) {
    if (seen.has(value)) return '[CYCLIC]';
    seen.add(value);
    return redactValue([...value], depth + 1, seen);
  }

  if (typeof value === 'object') {
    if (seen.has(value)) return '[CYCLIC]';
    seen.add(value);
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY.test(key)) {
        out[key] = '[REDACTED]';
      } else {
        out[key] = redactValue(val, depth + 1, seen);
      }
    }
    return out;
  }

  // Functions, symbols, etc. — not serializable, drop to a marker.
  return `[${typeof value}]`;
}
