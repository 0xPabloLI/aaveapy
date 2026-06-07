/**
 * Idempotent prefetch helpers for the Portfolio experience.
 *
 * PortfolioPanel itself does not issue any network requests — it consumes
 * `reserves` / `tokenPrices` already fetched by the main dashboard. The only
 * deferred work is the `PortfolioCompareView` lazy chunk. Trigger it ahead
 * of time (e.g. on hover/focus of the Portfolio toggle, or right after the user
 * enters Portfolio mode) so opening the compare view never waits on the network.
 */

let compareViewPromise: Promise<unknown> | null = null;

export function prefetchPortfolioCompareView(): Promise<unknown> {
  if (!compareViewPromise) {
    compareViewPromise = import('./PortfolioCompareView').catch((err) => {
      // Reset so a later attempt can retry after a transient failure.
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
