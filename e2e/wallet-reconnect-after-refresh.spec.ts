import { expect, test, type Page } from '@playwright/test';

/**
 * Wallet reconnect after page refresh — regression for AAV-562.
 *
 * Bug: After connecting wallet and refreshing the page, the wallet appears
 * disconnected. Clicking "Connect" has no response. A second refresh is
 * needed for "Connect" to work again.
 *
 * Root cause hypothesis: wagmi's `ssr: true` + default localStorage storage
 * can leave the store in a stale intermediate state after a failed
 * auto-reconnect, causing RainbowKit's modal logic to get stuck.
 *
 * These tests verify:
 * 1. Watch-mode reconnects correctly after page refresh
 * 2. Connect button stays clickable after refresh (not stuck)
 * 3. Stale wagmi.store state doesn't block Connect button
 * 4. Clearing wagmi store + refresh yields clean disconnected state
 *
 * NOTE: On mobile the Connect / View-address affordances are compacted behind
 * a "Wallet actions" icon Popover trigger (WalletButton renders an icon button +
 * Popover). The helpers below make the flow resilient to both the desktop
 * (direct buttons) and mobile (popover) layouts.
 */

import { WATCH_ADDRESS, waitForWalletControls } from './test-wallets';
const WAGMI_STORE_KEY = 'wagmi.store';
const WAGMI_WATCH_KEY = 'wagmi.watchAddress';

/**
 * Intercept live Aave GraphQL so these tests no longer depend on api.aave.com
 * availability or a real funded wallet. The request still fires (and is counted
 * by page.on('request') in the watch-resubmit spec), but we fulfill it instantly
 * so the SDK never hangs on a slow/blocked network. Watch-mode UI state
 * ("Viewing 0x…") is address-driven and does not depend on the response body.
 * See docs/specs/e2e-suite-boundary-cleanup.md (T5).
 */
async function mockAaveGraphql(page: Page) {
  await page.route(
    (url) =>
      (url.hostname === 'api.aave.com' || url.hostname === 'api.staging.aave.com') &&
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

/** Assert that a Connect entry point is visible (direct button on desktop, "Wallet actions" trigger on mobile). */
async function expectConnectAffordanceVisible(page: Page) {
  await waitForWalletControls(page);
  const direct = page.getByRole('button', { name: /Connect wallet/i });
  if (await direct.isVisible().catch(() => false)) {
    await expect(direct).toBeVisible();
    return;
  }
  await expect(page.getByRole('button', { name: /Wallet actions/i })).toBeVisible();
}

/** Open the RainbowKit connect modal from either layout. */
async function openConnect(page: Page) {
  await waitForWalletControls(page);
  const direct = page.getByRole('button', { name: /Connect wallet/i });
  if (await direct.isVisible().catch(() => false)) {
    await direct.click();
    return;
  }
  await page.getByRole('button', { name: /Wallet actions/i }).click();
  await page.getByRole('button', { name: /Connect wallet/i }).first().click();
}

/** Open the Watch-address input from either layout. */
async function openViewAddress(page: Page) {
  await waitForWalletControls(page);
  const direct = page.getByRole('button', { name: /View address/i });
  if (await direct.isVisible().catch(() => false)) {
    await direct.click();
    return;
  }
  // Connected (watch) state: trigger is "Viewing 0x…"; menu item is "View another address".
  const viewing = page.getByRole('button', { name: /Viewing 0x/i });
  if (await viewing.isVisible().catch(() => false)) {
    await viewing.click();
    await page.getByRole('button', { name: /View another address/i }).click();
    return;
  }
  await page.getByRole('button', { name: /Wallet actions/i }).click();
  await page.getByRole('button', { name: /View address/i }).first().click();
}

test.describe('Wallet reconnect after page refresh (AAV-562)', () => {
  test.skip(
    !!process.env.CI,
    'Wallet reconnect tests require live Aave API access — run locally (set E2E_PROXY if your network needs a proxy)',
  );
  test.beforeEach(async ({ page }) => {
    await mockAaveGraphql(page);
  });
  test('watch-mode reconnects correctly after page refresh', async ({ page }) => {
    test.skip(!WATCH_ADDRESS, 'E2E_WATCH_ADDRESS not set');
    test.setTimeout(180_000);

    await page.goto('/');

    // Connect via watch mode.
    await openViewAddress(page);
    const addrInput = page.getByRole('textbox', { name: /address/i }).first();
    await addrInput.fill(WATCH_ADDRESS!);
    await addrInput.press('Enter');

    // Verify watch-mode connected: button label changes to "Viewing 0x…".
    await expect(page.getByRole('button', { name: /Viewing 0x/i }).first()).toBeVisible({ timeout: 10_000 });

    // Verify localStorage has watch address persisted.
    const storedAddr = await page.evaluate((key) => localStorage.getItem(key), WAGMI_WATCH_KEY);
    expect(storedAddr).toBeTruthy();

    // Refresh the page.
    await page.reload();

    // After refresh, watch-mode should auto-reconnect from localStorage.
    // The button should show "Viewing 0x…" again, not "Connect".
    await expect(page.getByRole('button', { name: /Viewing 0x/i }).first()).toBeVisible({ timeout: 15_000 });

    // Connect button should NOT be visible (we're already connected).
    await expect(page.getByRole('button', { name: /Connect wallet/i })).not.toBeVisible();
  });

  test('Connect button stays clickable after page refresh (no wallet extension)', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/');

    // No wallet extension → should show Connect button.
    await expectConnectAffordanceVisible(page);

    // Click Connect — RainbowKit modal should open.
    await openConnect(page);
    // Modal contains "Connect Wallet" heading from RainbowKit.
    const modalHeading = page.getByRole('heading', { name: /Connect Wallet|Connect a Wallet/i });
    await expect(modalHeading).toBeVisible({ timeout: 5_000 });

    // Close the modal (Escape key).
    await page.keyboard.press('Escape');
    await expect(modalHeading).not.toBeVisible({ timeout: 3_000 });

    // Refresh the page.
    await page.reload();

    // After refresh, Connect button should still be visible and clickable.
    await expectConnectAffordanceVisible(page);

    // Click Connect again — modal should open (not stuck).
    await openConnect(page);
    const modalHeadingAfterRefresh = page.getByRole('heading', { name: /Connect Wallet|Connect a Wallet/i });
    await expect(modalHeadingAfterRefresh).toBeVisible({ timeout: 5_000 });
  });

  test('stale wagmi.store does not block Connect button after refresh', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/');

    // Inject a stale wagmi.store that simulates a previously-connected
    // injected wallet (e.g. MetaMask) that is no longer available.
    // This mimics the state left after a real wallet disconnects post-refresh.
    const staleStore = JSON.stringify({
      state: {
        connections: {
          __type: 'wagmi:connections',
          value: [
            {
              id: '1',
              connectorId: 'injected',
              accounts: ['0x000000000000000000000000000000000000dEaD'],
              chainId: 1,
            },
          ],
        },
        account: '0x000000000000000000000000000000000000dEaD',
        chainId: 1,
        status: 'connected',
      },
      version: 2,
    });

    await page.evaluate(
      ({ key, value }) => localStorage.setItem(key, value),
      { key: WAGMI_STORE_KEY, value: staleStore },
    );

    // Refresh to trigger wagmi hydration from stale store.
    await page.reload();

    // wagmi should detect the injected connector is not actually available
    // and transition to disconnected. The Connect button should appear.
    await expectConnectAffordanceVisible(page);

    // Click Connect — modal should open, not stuck.
    await openConnect(page);
    const modalHeading = page.getByRole('heading', { name: /Connect Wallet|Connect a Wallet/i });
    await expect(modalHeading).toBeVisible({ timeout: 5_000 });
  });

  test('clearing wagmi store + refresh yields clean disconnected state', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/');

    // Inject stale state.
    await page.evaluate((key) => {
      localStorage.setItem(
        key,
        JSON.stringify({
          state: {
            connections: { __type: 'wagmi:connections', value: [] },
            account: undefined,
            chainId: undefined,
            status: 'disconnected',
          },
          version: 2,
        }),
      );
    }, WAGMI_STORE_KEY);

    await page.reload();

    // Should show Connect button (disconnected state).
    await expectConnectAffordanceVisible(page);

    // Should NOT show any wallet address or "Viewing" label.
    await expect(page.getByRole('button', { name: /Viewing 0x/i })).not.toBeVisible();
    await expect(page.getByRole('button', { name: /Wallet 0x/i })).not.toBeVisible();

    // Connect button is functional.
    await openConnect(page);
    const modalHeading = page.getByRole('heading', { name: /Connect Wallet|Connect a Wallet/i });
    await expect(modalHeading).toBeVisible({ timeout: 5_000 });
  });

  test('watch-mode persists across double refresh', async ({ page }) => {
    test.skip(!WATCH_ADDRESS, 'E2E_WATCH_ADDRESS not set');
    test.setTimeout(180_000);

    await page.goto('/');

    // Connect via watch mode.
    await openViewAddress(page);
    const addrInput = page.getByRole('textbox', { name: /address/i }).first();
    await addrInput.fill(WATCH_ADDRESS!);
    await addrInput.press('Enter');

    await expect(page.getByRole('button', { name: /Viewing 0x/i }).first()).toBeVisible({ timeout: 10_000 });

    // First refresh.
    await page.reload();
    await expect(page.getByRole('button', { name: /Viewing 0x/i }).first()).toBeVisible({ timeout: 15_000 });

    // Second refresh — should still reconnect.
    await page.reload();
    await expect(page.getByRole('button', { name: /Viewing 0x/i }).first()).toBeVisible({ timeout: 15_000 });

    // Connect button should NOT be visible.
    await expect(page.getByRole('button', { name: /Connect wallet/i })).not.toBeVisible();
  });
});
