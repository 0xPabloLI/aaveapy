/**
 * Analytics consent (GDPR/CCPA).
 *
 * GA4 is wired through Google Consent Mode v2:
 *   - index.html sets `consent, default` with every signal denied BEFORE any
 *     Google script exists
 *   - the gtag.js script itself is only injected once the visitor grants
 *     analytics consent (privacy-max: no cookieless measurement pings)
 *   - consent state persists in localStorage (`aaveapy:consent-v2`); no PII
 *     is stored — just the decision + timestamp
 *
 * UI entry point: ConsentBanner (App root). Agents: never call initAnalytics
 * directly at boot — go through bootstrapAnalytics()/setConsent().
 */
import { initAnalytics } from '@/lib/gtag';

export type AnalyticsConsent = 'granted' | 'denied';

export interface ConsentState {
  analytics: AnalyticsConsent;
  respondedAt: string;
}

const STORAGE_KEY = 'aaveapy:consent-v2';

/** Consent Mode v2 signal set — all denied by default (see index.html). */
export const CONSENT_DENY_ALL = {
  analytics_storage: 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
} as const;

export function getConsent(): ConsentState | null {
  if (typeof window === 'undefined' || !('localStorage' in window)) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConsentState>;
    if (parsed.analytics !== 'granted' && parsed.analytics !== 'denied') return null;
    return { analytics: parsed.analytics, respondedAt: String(parsed.respondedAt ?? '') };
  } catch {
    return null; // malformed — treat as not responded
  }
}

export function hasResponded(): boolean {
  return getConsent() !== null;
}

export function hasAnalyticsConsent(): boolean {
  return getConsent()?.analytics === 'granted';
}

function gtagConsentUpdate(analytics: AnalyticsConsent): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  window.gtag('consent', 'update', {
    ...CONSENT_DENY_ALL,
    analytics_storage: analytics,
  });
}

/**
 * Record the visitor's decision. Persists first (so the banner never
 * re-appears on a reload race), fires the Consent Mode update, and loads
 * gtag.js only on grant.
 */
export function setConsent(analytics: AnalyticsConsent): void {
  if (typeof window === 'undefined' || !('localStorage' in window)) return;
  const state: ConsentState = { analytics, respondedAt: new Date().toISOString() };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  gtagConsentUpdate(analytics);
  if (analytics === 'granted') {
    initAnalytics();
  }
}

/** App-boot hook: load analytics only for previously-granted visitors. */
export function bootstrapAnalytics(): void {
  if (hasAnalyticsConsent()) {
    initAnalytics();
  }
}
