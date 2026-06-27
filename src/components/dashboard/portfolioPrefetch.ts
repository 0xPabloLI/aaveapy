import { features } from '@/config/features';

/**
 * Idempotent prefetch helpers for the Portfolio experience.
 *
 * PortfolioPanel itself does not issue any network requests — it consumes
 * `reserves` / `tokenPrices` already fetched by the main dashboard. The only
 * deferred work is the `PortfolioCompareView` lazy chunk. Trigger it ahead
 * of time (e.g. on hover/focus of the Portfolio toggle, or right after the user
 * enters Portfolio mode) so opening the compare view never waits on the network.
 *
 * When the snapshot feature flag is off, prefetch is skipped entirely to avoid
 * an unnecessary chunk download.
 */

let compareViewPromise: Promise<unknown> | null | undefined = null;

export function prefetchPortfolioCompareView(): Promise<unknown> | undefined {
  if (!features.snapshot) return undefined;

  if (!compareViewPromise) {
    compareViewPromise = import('./PortfolioCompareView').catch((err) => {
      compareViewPromise = null;
      throw err;
    });
  }
  return compareViewPromise;
}

/**
 * Prefetch everything Portfolio mode might need. Currently just the compare
 * chunk; kept as a single entry point so future deferred work can be added
 * without touching call sites.
 */
export function prefetchPortfolioPanel(): void {
  void prefetchPortfolioCompareView();
}
