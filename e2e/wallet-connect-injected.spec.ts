import { expect, test, type Page } from '@playwright/test';

/**
 * Real injected-wallet connect lifecycle via a mock EIP-1193 provider.
 *
 * Existing wallet tests only cover watch mode (view-only address) and
 * "Connect modal opens" — no test ever walked the actual injected-connector
 * path (RainbowKit modal → wagmi `injected()` connect → connected header →
 * persistence → disconnect). This spec fills that gap by injecting a fake
 * MetaMask provider BEFORE page scripts run, so the whole lifecycle runs
 * offline and deterministically.
 *
 * Unlike the other wallet specs, these tests run in CI too: nothing here
 * touches a real network (Aave GraphQL is intercepted below).
 *
 * Scenario coverage maps to the matrix in
 * docs/specs/e2e-wallet-connect-injected.md:
 *   row 2 → cold start test; rows 3-6 → lifecycle test; row 7 → beforeEach mock.
 */

import { injectEip1193Mock } from './eip1193-mock';
import { waitForWalletControls } from './test-wallets';

const WAGMI_STORE_KEY = 'wagmi.store';

/** Hosts the Aave SDK posts GraphQL to: V4 (+staging) and the V3 backend. */
const AAVE_GRAPHQL_HOSTS = new Set([
  'api.aave.com',
  'api.staging.aave.com',
  'api.v3.aave.com',
]);

/**
 * Fulfill Aave GraphQL instantly so connect triggers no real network. The
 * request still fires (position import on connect), but the response body
 * does not affect header wallet state. Same pattern as
 * watch-resubmit-refresh.spec.ts (docs/specs/e2e-suite-boundary-cleanup.md T5).
 */
async function mockAaveGraphql(page: Page) {
  await page.route(
    (url) =>
      AAVE_GRAPHQL_HOSTS.has(url.hostname) && url.pathname.endsWith('/graphql'),
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
 * Wallet header affordances differ between layouts: direct buttons on desktop,
 * a "Wallet actions" icon popover on mobile. Same resilient helpers as
 * wallet-reconnect-after-refresh.spec.ts.
 */
async function expectConnectAffordanceVisible(page: Page) {
  await waitForWalletControls(page);
  const direct = page.getByRole('button', { name: /Connect wallet/i });
  if (await direct.isVisible().catch(() => false)) {
    await expect(direct).toBeVisible();
    return;
  }
  await expect(page.getByRole('button', { name: /Wallet actions/i })).toBeVisible();
}

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

test.describe('Wallet connect via mock injected provider', () => {
  // No CI skip by design: fully offline, deterministic — that is the point of
  // this spec relative to the watch-mode wallet family.
  test.beforeEach(async ({ page }) => {
    await injectEip1193Mock(page);
    await mockAaveGraphql(page);
  });

  test('cold start with a provider but no prior session does not auto-connect', async ({ page }) => {
    test.setTimeout(120_000);

    await page.goto('/');

    // Mock ethereum exists, but wagmi has no persisted injected session
    // (shim marker), so the header must still show the disconnected state.
    await expectConnectAffordanceVisible(page);
    await expect(page.getByRole('button', { name: /Wallet 0x/i })).not.toBeVisible();
    await expect(page.getByRole('button', { name: /Viewing 0x/i })).not.toBeVisible();
  });

  test('connect via modal → persists → auto-reconnects after reload → disconnect', async ({ page }) => {
    test.setTimeout(180_000);

    // Row 5 of the scenario matrix: the init script re-runs on every
    // navigation — an idempotency failure would throw here as a page error.
    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => pageErrors.push(error));

    await page.goto('/');
    await openConnect(page);
    await expect(
      page.getByRole('heading', { name: /Connect Wallet|Connect a Wallet/i }),
    ).toBeVisible({ timeout: 10_000 });

    // The mock advertises isMetaMask, so RainbowKit lists the injected wallet
    // under a MetaMask/Browser-Wallet style label depending on its detection.
    const injectedOption = page
      .getByRole('button', { name: /MetaMask|Browser Wallet|Injected/i })
      .first();
    await expect(injectedOption).toBeVisible({ timeout: 10_000 });
    await injectedOption.click();

    // Connected header state (WalletButton aria-label contract: "Wallet 0x…",
    // distinct from watch mode's "Viewing 0x…").
    await expect(page.getByRole('button', { name: /Wallet 0x/i }).first()).toBeVisible({
      timeout: 15_000,
    });

    // wagmi persisted the injected connection.
    const stored = await page.evaluate((key) => localStorage.getItem(key), WAGMI_STORE_KEY);
    expect(stored).toContain('injected');

    // Reload — the init script re-registers the mock idempotently and wagmi
    // auto-reconnects from the persisted session without any user gesture.
    await page.reload();
    await expect(page.getByRole('button', { name: /Wallet 0x/i }).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('button', { name: /Connect wallet/i })).not.toBeVisible();

    // Disconnect from the wallet popover returns to a clean disconnected state.
    await page.getByRole('button', { name: /Wallet 0x/i }).first().click();
    await page.getByRole('button', { name: 'Disconnect' }).click();
    await expectConnectAffordanceVisible(page);
    await expect(page.getByRole('button', { name: /Wallet 0x/i })).not.toBeVisible();
    await expect(page.getByRole('button', { name: /Viewing 0x/i })).not.toBeVisible();
    expect(pageErrors).toEqual([]);
  });
});
