/**
 * Outbound API tracing.
 *
 * The backend (and any intermediary) can correlate a failing request across
 * logs when the client sends `X-Request-ID`. Every API call through
 * `fetchWithTracing` gets a fresh UUID, and failures / slow responses are
 * logged through the structured logger (scrubbed) with the same ID — so a
 * user-visible error message can be traced to exact backend log lines by
 * sharing the request ID.
 */
import { logger } from '@/lib/logger';

/** Fresh request id (UUID v4 when the platform provides it, else fallback). */
export function newRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Non-secure contexts / older engines: avoid Math.random-only ids.
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const SLOW_REQUEST_MS = 8_000;

/**
 * fetch() wrapper that propagates X-Request-ID and structured-logs outcomes.
 * Response semantics are identical to fetch(); only headers/telemetry change.
 */
export async function fetchWithTracing(url: string, init?: RequestInit): Promise<Response> {
  const requestId = newRequestId();
  const startedAt = Date.now();
  // Splitting URL from base keeps backend logs aligned with the path they see.
  const path = url.replace(/^https?:\/\/[^/]+/, '');

  try {
    const response = await fetch(url, {
      ...init,
      headers: { 'X-Request-ID': requestId, ...(init?.headers ?? {}) },
    });
    const durationMs = Date.now() - startedAt;

    if (!response.ok) {
      logger.warn('api request failed', {
        path,
        requestId,
        status: response.status,
        durationMs,
      });
    } else if (durationMs > SLOW_REQUEST_MS) {
      logger.warn('api request slow', { path, requestId, status: response.status, durationMs });
    }

    return response;
  } catch (error) {
    logger.error('api request network error', {
      path,
      requestId,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error : String(error),
    });
    throw error;
  }
}
