/**
 * Outbound API tracing.
 *
 * Every call through `fetchWithTracing` gets a fresh request ID that is
 * (a) structured-logged with the outcome (path, status, duration) so a
 * user-visible error can be correlated client-side, and (b) optionally sent
 * as an `X-Request-ID` header for server-side correlation.
 *
 * CORS constraint (why the header is gated): a custom header on a cross-origin
 * request triggers a preflight OPTIONS. The staging/production APIs allow
 * `Content-Type, Authorization, X-Admin-Token` only — adding `X-Request-ID`
 * makes every data request fail ("Failed to fetch"). Header propagation is
 * therefore enabled per deployment via `VITE_REQUEST_ID_HEADER=true` AFTER the
 * backend adds the header to its CORS allow-list. Logging-based correlation
 * works everywhere regardless of the flag.
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
 * fetch() wrapper that traces request outcomes (and, when enabled, propagates
 * X-Request-ID). Response semantics are identical to fetch(); only telemetry
 * (and optionally headers) change.
 */
export async function fetchWithTracing(url: string, init?: RequestInit): Promise<Response> {
  const requestId = newRequestId();
  const startedAt = Date.now();
  // Splitting URL from base keeps backend logs aligned with the path they see.
  const path = url.replace(/^https?:\/\/[^/]+/, '');

  // Read per call so deployments/tests can toggle via env without remounting.
  const sendHeader = (import.meta.env.VITE_REQUEST_ID_HEADER as string | undefined) === 'true';

  const headers = new Headers(init?.headers);
  if (sendHeader) {
    headers.set('X-Request-ID', requestId);
  }

  try {
    const response = await fetch(url, { ...init, headers });
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
