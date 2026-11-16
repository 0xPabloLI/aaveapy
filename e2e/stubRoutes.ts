import type { Page } from '@playwright/test';

/**
 * Shared `page.route` stub for the committed `/markets` fixtures (AAV-1316 /
 * AAV-1333).
 *
 * Pathname matching is host-agnostic on purpose: the app's API base differs
 * between dev (the staging host from apiBase.ts) and CI (VITE_API_BASE_URL),
 * and both end in `/markets` and `/meta/side-data`. The payload is validated
 * browser-side by the same schema as a live response, so a stub that drifts
 * from the API contract fails loudly instead of testing a fantasy shape.
 */

/**
 * Minimal deterministic side-data body: only `generatedAt` is required by the
 * schema; empty forecast/campaignAccess keep the incentive math on the
 * breakdown-APR path instead of forecast-TV recomputation (which a synthetic
 * payload cannot model).
 */
export const STUB_SIDE_DATA = { generatedAt: '2026-01-01T00:00:00.000Z' } as const;

export async function installMarketsStubRoutes(page: Page, payload: unknown, sideData: unknown = STUB_SIDE_DATA) {
  await page.route(
    (url) => url.pathname.endsWith('/markets'),
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(payload),
      }),
  );
  await page.route(
    (url) => url.pathname.endsWith('/meta/side-data'),
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(sideData),
      }),
  );
}
