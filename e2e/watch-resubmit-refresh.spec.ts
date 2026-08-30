import { expect, test, type Page } from '@playwright/test';

/**
 * Watch Mode re-submit triggers position refresh — regression for AAV-679 / AAV-699.
 *
 * Bug: After connecting via Watch Mode, re-submitting the same address did not
 * refresh the user position cache. The `useUserPositionsSdk` hook subscribes to
 * its initial args (V3/V4 urql queries) and React Query's `useQuery` is keyed
 * by address, so the SDK and RQ layers would never re-execute.
 *
 * Fix: A module-level `refetchEvent` emitter (`src/lib/userData/refetchEvent.ts`)
 * is bumped on every refresh source (F5, Refresh button, Watch Mode re-entry).
 * `useUserPositionsSdk` subscribes and calls:
 *   - `queryClient.invalidateQueries` for the onchain-fallback RQ key
 *   - `gapFallbackQuery.refetch()`
 *   - `v3Client.refreshQueryWhere` and `v4Client.refreshQueryWhere` for the
 *     V3/V4 urql-tracked `UserSupplies` and `UserBorrows` queries.
 *
 * This test verifies that re-submitting an address bumps the GraphQL
 * `UserSupplies` / `UserBorrows` request count, proving the urql refetch fires.
 */

import { WATCH_ADDRESS } from './test-wallets';
const AAVE_GRAPHQL_HOST = 'api.aave.com';
const AAVE_GRAPHQL_HOST_STAGING = 'api.staging.aave.com';
const USER_POSITION_OPS = ['UserSupplies', 'UserBorrows'];

function isUserPositionGraphqlRequest(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return (
      (hostname === AAVE_GRAPHQL_HOST || hostname === AAVE_GRAPHQL_HOST_STAGING) &&
      url.includes('/graphql')
    );
  } catch {
    return false;
  }
}

function extractOperationName(body: unknown): string | null {
  if (!body || typeof body !== 'string') return null;
  try {
    const parsed = JSON.parse(body) as { operationName?: string };
    return parsed.operationName ?? null;
  } catch {
    return null;
  }
}

/**
 * Intercept live Aave GraphQL so these tests no longer depend on api.aave.com
 * availability. The request still fires (and is counted by page.on('request')
 * below), but we fulfill it instantly so the SDK never hangs on a slow/blocked
 * network — the original 180s-timeout flakiness. Watch-mode UI state
 * ("Viewing 0x…") is address-driven and does not depend on the response body.
 * See docs/specs/e2e-suite-boundary-cleanup.md (T5).
 */
async function mockAaveGraphql(page: Page) {
  await page.route(
    (url) =>
      (url.hostname === AAVE_GRAPHQL_HOST || url.hostname === AAVE_GRAPHQL_HOST_STAGING) &&
      url.pathname.endsWith('/graphql'),
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: {} }),
      });
    },
  );
}

/**
 * Open the Watch-address input. On mobile the Connect / View-address
 * affordances are compacted behind a "Wallet actions" icon Popover, so the
 * "View address" button is not directly visible — fall back to the popover.
 */
async function openViewAddress(page: Page) {
  const direct = page.getByRole('button', { name: /View address/i });
  if (await direct.isVisible().catch(() => false)) {
    await direct.first().click();
    return;
  }
  const viewing = page.getByRole('button', { name: /Viewing 0x/i });
  if (await viewing.isVisible().catch(() => false)) {
    await viewing.click();
    await page.getByRole('button', { name: /View another address/i }).click();
    return;
  }
  await page.getByRole('button', { name: /Wallet actions/i }).click();
  await page.getByRole('button', { name: /View address/i }).first().click();
}

test.describe('Watch Mode re-submit refreshes positions (AAV-679 / AAV-699)', () => {
  test.skip(!!process.env.CI, 'Requires live Aave SDK GraphQL connections — run locally');
  test.beforeEach(async ({ page }) => {
    await mockAaveGraphql(page);
  });

  test('re-submitting the same watch address bumps UserSupplies/Borrows requests', async ({
    page,
  }) => {
    test.skip(!WATCH_ADDRESS, 'E2E_WATCH_ADDRESS not set');
    test.setTimeout(120_000);

    const userPositionRequests: number[] = [];

    // Capture only V3 + V4 user position GraphQL ops. Anything else
    // (markets list, reserve summaries, etc.) is noise.
    page.on('request', (request) => {
      if (request.method() !== 'POST') return;
      if (!isUserPositionGraphqlRequest(request.url())) return;
      const opName = extractOperationName(request.postData());
      if (opName && USER_POSITION_OPS.includes(opName)) {
        userPositionRequests.push(Date.now());
      }
    });

    await page.goto('/');

    // Connect via watch mode.
    await openViewAddress(page);
    const addrInput = page.getByRole('textbox', { name: /address/i }).first();
    await addrInput.fill(WATCH_ADDRESS!);
    await addrInput.press('Enter');

    // Wait for watch-mode to be active.
    await expect(page.getByRole('button', { name: /Viewing 0x/i }).first()).toBeVisible({
      timeout: 10_000,
    });

    // Wait for the initial position fetch to settle. urql V3 + V4 fire 4 ops
    // (UserSupplies + UserBorrows on each client). Use polling instead of a
    // fixed timeout — CI runners are slower and 4s may not be enough.
    await expect.poll(
      () => userPositionRequests.length,
      { timeout: 30_000, message: 'initial V3+V4 user-position GraphQL requests' },
    ).toBeGreaterThan(0);
    const initialCount = userPositionRequests.length;

    // Open the watch input again and re-submit the same address.
    await openViewAddress(page);
    const addrInput2 = page.getByRole('textbox', { name: /address/i }).first();
    await addrInput2.fill(WATCH_ADDRESS!);
    await addrInput2.press('Enter');

    // Watch button should re-show "Viewing 0x…" after re-entry.
    await expect(page.getByRole('button', { name: /Viewing 0x/i }).first()).toBeVisible({
      timeout: 10_000,
    });

    // Wait for the refetch to fire by polling for new requests.
    await expect.poll(
      () => userPositionRequests.length,
      { timeout: 20_000, message: 'refired V3+V4 user-position GraphQL requests after re-submit' },
    ).toBeGreaterThan(initialCount);
    const afterResubmitCount = userPositionRequests.length;

    // We expect at least the V3 + V4 UserSupplies + UserBorrows to re-fire
    // (4 requests). Allow a small margin for batching or dedup.
    expect(
      afterResubmitCount - initialCount,
      'new V3+V4 user-position GraphQL requests after re-submit',
    ).toBeGreaterThanOrEqual(2);
  });

  test('re-submitting a different watch address bumps UserSupplies/Borrows requests', async ({
    page,
  }) => {
    test.skip(!WATCH_ADDRESS, 'E2E_WATCH_ADDRESS not set');
    test.setTimeout(120_000);

    // E2E_WATCH_ADDRESS_ALT is REQUIRED for this test — it covers the
    // address-change path of `useWatchModeConnect`, which only triggers
    // when the new address differs from the active one. We deliberately
    // do not default to WATCH_ADDRESS: a self-default would silently skip
    // the test in CI and erode coverage. Provide a second throwaway
    // address via env var to exercise this path.
    const alternateAddress = process.env.E2E_WATCH_ADDRESS_ALT;
    test.skip(
      !alternateAddress ||
        alternateAddress.toLowerCase() === WATCH_ADDRESS!.toLowerCase(),
      'E2E_WATCH_ADDRESS_ALT must be set and differ from E2E_WATCH_ADDRESS',
    );

    const userPositionRequests: number[] = [];

    page.on('request', (request) => {
      if (request.method() !== 'POST') return;
      if (!isUserPositionGraphqlRequest(request.url())) return;
      const opName = extractOperationName(request.postData());
      if (opName && USER_POSITION_OPS.includes(opName)) {
        userPositionRequests.push(Date.now());
      }
    });

    await page.goto('/');

    // Initial watch-mode connect.
    await openViewAddress(page);
    const addrInput = page.getByRole('textbox', { name: /address/i }).first();
    await addrInput.fill(WATCH_ADDRESS!);
    await addrInput.press('Enter');
    await expect(page.getByRole('button', { name: /Viewing 0x/i }).first()).toBeVisible({
      timeout: 10_000,
    });

    // Wait for initial position fetch with polling — CI runners need more time.
    await expect.poll(
      () => userPositionRequests.length,
      { timeout: 30_000, message: 'initial V3+V4 user-position GraphQL requests' },
    ).toBeGreaterThan(0);
    const initialCount = userPositionRequests.length;

    // Re-submit a *different* address — exercises the address-change path of
    // `useWatchModeConnect`, which still routes through `refetchEvent`.
    await openViewAddress(page);
    const addrInput2 = page.getByRole('textbox', { name: /address/i }).first();
    await addrInput2.fill(alternateAddress);
    await addrInput2.press('Enter');
    await expect(page.getByRole('button', { name: /Viewing 0x/i }).first()).toBeVisible({
      timeout: 10_000,
    });

    // Wait for the refetch to fire by polling for new requests.
    await expect.poll(
      () => userPositionRequests.length,
      { timeout: 20_000, message: 'refired V3+V4 user-position GraphQL requests after re-submit (different address)' },
    ).toBeGreaterThan(initialCount);
    const afterResubmitCount = userPositionRequests.length;

    expect(
      afterResubmitCount - initialCount,
      'new V3+V4 user-position GraphQL requests after re-submit (different address)',
    ).toBeGreaterThanOrEqual(2);
  });
});
