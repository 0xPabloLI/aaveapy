/**
 * Sentry error tracking — activated only when a DSN is configured.
 *
 * Setup (owner step, one time):
 *   1. Create the project at sentry.io (or self-hosted GlitchTip) → copy DSN
 *   2. Add VITE_SENTRY_DSN=<dsn> to the Vercel project env vars (Production +
 *      Preview); redeploy
 *   3. Optional (source maps): SENTRY_AUTH_TOKEN + SENTRY_ORG/PROJECT as CI
 *      secrets enable map uploads — see vite.config.ts build.sourcemap:'hidden'
 *
 * Design constraints honored:
 *   - Bundle: the SDK is dynamically imported from main.tsx so it never lands
 *     on the first-paint path (repo FCP invariant — see vite.config.ts).
 *   - Privacy: event payloads pass through logRedaction before leaving the
 *     browser; no user identifying fields are attached (wallet addresses are
 *     quasi-PII and stay out of user context on purpose).
 *   - No DSN → every helper is a safe no-op (local dev, tests, staging
 *     without config).
 */
import { redactValue } from '@/lib/logRedaction';

let sentryEnabled = false;

export function isSentryEnabled(): boolean {
  return sentryEnabled;
}

/** Pure event scrubber (Sentry beforeSend) — exported for unit tests. */
export function scrubSentryEvent<T extends object>(event: T): T {
  const source = event as { extra?: unknown; request?: unknown };
  const scrubbed = { ...source } as Record<string, unknown>;
  if (source.extra !== undefined) scrubbed.extra = redactValue(source.extra);
  if (source.request !== undefined) scrubbed.request = redactValue(source.request);
  return scrubbed as unknown as T;
}

export async function initSentry(): Promise<void> {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn || typeof window === 'undefined') return;

  try {
    const Sentry = await import('@sentry/react');
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      // SPA with few high-value errors: generous session sampling, modest
      // performance tracing until backend correlation is wired up.
      sampleRate: 1.0,
      tracesSampleRate: 0.1,
      beforeSend: (event) => {
        const scrubbed = scrubSentryEvent(event);
        return scrubbed as typeof event;
      },
    });
    sentryEnabled = true;
  } catch (error) {
    // Never let telemetry break the app.
    console.warn('[sentry] SDK failed to initialize:', error);
  }
}

/** Boundary/try-catch hook: forwards to Sentry when enabled, no-op otherwise. */
export function captureError(error: Error, context?: Record<string, unknown>): void {
  if (!sentryEnabled) return;
  void import('@sentry/react').then((Sentry) => {
    Sentry.withScope((scope) => {
      if (context) scope.setExtras(redactValue(context) as Record<string, unknown>);
      Sentry.captureException(error);
    });
  });
}
