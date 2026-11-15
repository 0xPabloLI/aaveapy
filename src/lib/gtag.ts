/**
 * Google Analytics (GA4) bootstrap.
 *
 * Loads gtag.js once, only after analytics consent (first grant, or at boot for a
 * previously-granted visitor — see src/lib/consent.ts, which owns the trigger). The
 * property ID is fixed, and a build with no `window` (tests, SSR) is a no-op.
 */

/** The AaveAPY property. No deployment overrides it, so this is the whole configuration. */
const MEASUREMENT_ID = 'G-8WRVJ711MH';

let scriptInjected = false;

export function initAnalytics(): void {
  if (scriptInjected) return;
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  scriptInjected = true;

  window.dataLayer = window.dataLayer || [];
  // index.html defines a gtag stub for Consent Mode before any script loads;
  // reuse it instead of replacing (the consent default call already queued).
  if (typeof window.gtag !== 'function') {
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer!.push(args);
    };
  }

  // Inject gtag.js on first grant (see src/lib/consent.ts).
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(script);

  window.gtag('js', new Date());
  // SPA: we send page_view manually on route change.
  window.gtag('config', MEASUREMENT_ID);
}

/** Send a GA4 page_view for a client-side route change. */
export function trackPageView(path: string, title?: string): void {
  if (typeof window === 'undefined') return;
  window.gtag?.('event', 'page_view', {
    page_path: path,
    page_location: window.location.href,
    page_title: title ?? document.title,
  });
}

export const ANALYTICS_MEASUREMENT_ID = MEASUREMENT_ID;
