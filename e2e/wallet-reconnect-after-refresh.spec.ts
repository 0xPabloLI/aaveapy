import { expect, test } from '@playwright/test';

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
 */

import { WATCH_ADDRESS } from './test-wallets';
const WAGMI_STORE_KEY = 'wagmi.store';
const WAGMI_WATCH_KEY = 'wagmi.watchAddress';

test.describe('Wallet reconnect after page refresh (AAV-562)', () => {
  test('watch-mode reconnects correctly after page refresh', async ({ page }) => {
    test.skip(!WATCH_ADDRESS, 'E2E_WATCH_ADDRESS not set');
    test.setTimeout(180_000);

    await page.goto('/');

    // Connect via watch mode.
    await page.getByRole('button', { name: /View address/i }).first().click();
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
    const connectBtn = page.getByRole('button', { name: /Connect wallet/i }).first();
    await expect(connectBtn).toBeVisible({ timeout: 10_000 });

    // Click Connect — RainbowKit modal should open.
    await connectBtn.click();
    // Modal contains "Connect Wallet" heading from RainbowKit.
    const modalHeading = page.getByRole('heading', { name: /Connect Wallet|Connect a Wallet/i });
    await expect(modalHeading).toBeVisible({ timeout: 5_000 });

    // Close the modal (Escape key).
    await page.keyboard.press('Escape');
    await expect(modalHeading).not.toBeVisible({ timeout: 3_000 });

    // Refresh the page.
    await page.reload();

    // After refresh, Connect button should still be visible and clickable.
    const connectBtnAfterRefresh = page.getByRole('button', { name: /Connect wallet/i }).first();
    await expect(connectBtnAfterRefresh).toBeVisible({ timeout: 10_000 });

    // Click Connect again — modal should open (not stuck).
    await connectBtnAfterRefresh.click();
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
    const connectBtn = page.getByRole('button', { name: /Connect wallet/i }).first();

    // Give wagmi time to attempt reconnect and fail.
    await expect(connectBtn).toBeVisible({ timeout: 15_000 });

    // Click Connect — modal should open, not stuck.
    await connectBtn.click();
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
    const connectBtn = page.getByRole('button', { name: /Connect wallet/i }).first();
    await expect(connectBtn).toBeVisible({ timeout: 10_000 });

    // Should NOT show any wallet address or "Viewing" label.
    await expect(page.getByRole('button', { name: /Viewing 0x/i })).not.toBeVisible();
    await expect(page.getByRole('button', { name: /Wallet 0x/i })).not.toBeVisible();

    // Connect button is functional.
    await connectBtn.click();
    const modalHeading = page.getByRole('heading', { name: /Connect Wallet|Connect a Wallet/i });
    await expect(modalHeading).toBeVisible({ timeout: 5_000 });
  });

  test('watch-mode persists across double refresh', async ({ page }) => {
    test.skip(!WATCH_ADDRESS, 'E2E_WATCH_ADDRESS not set');
    test.setTimeout(180_000);

    await page.goto('/');

    // Connect via watch mode.
    await page.getByRole('button', { name: /View address/i }).first().click();
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
