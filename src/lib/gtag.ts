/**
 * Google Analytics (GA4) bootstrap.
 *
 * Loads gtag.js once at app startup using the measurement ID injected by the
 * Google Analytics connector. Safe no-op when the ID is missing (local dev,
 * tests, SSR) so analytics never breaks the app.
 */

const MEASUREMENT_ID = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_ANALYTICS_API_KEY as
  | string
  | undefined;

let initialized = false;

export function initAnalytics(): void {
  if (initialized) return;
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (!MEASUREMENT_ID) return;

  initialized = true;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer!.push(args);
  };
  window.gtag('js', new Date());
  // SPA: we send page_view manually on route change.
  window.gtag('config', MEASUREMENT_ID, { send_page_view: true });
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
