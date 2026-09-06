/**
 * Vendor-agnostic lightweight event tracking.
 *
 * Events are forwarded to `window.gtag` when available, and always pushed to
 * `window.dataLayer` so any tag manager (GTM, GA4, self-hosted) can consume them.
 * No-ops safely when nothing is installed.
 */

export type AnalyticsParams = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackEvent(event: string, params: AnalyticsParams = {}): void {
  if (typeof window === 'undefined') return;

  const payload = { event, ...params };

  try {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(payload);
    window.gtag?.('event', event, params);
  } catch {
    // Analytics must never break the page.
  }
}

/** Internal link click on a content/SEO page. */
export function trackInternalLink(page: string, label: string, href: string): void {
  trackEvent('internal_link_click', { page, link_label: label, link_url: href });
}

/** FAQ accordion opened (we only count expansions, not collapses). */
export function trackFaqToggle(page: string, question: string, opened: boolean): void {
  if (!opened) return;
  trackEvent('faq_expand', { page, faq_question: question });
}

/** Total seconds spent on the page, sent on unmount / tab close. */
export function trackTimeOnPage(page: string, seconds: number): void {
  trackEvent('time_on_page', { page, seconds });
}
