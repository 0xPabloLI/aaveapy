/**
 * Shared test wallet addresses and header-wallet helpers for E2E and
 * integration tests.
 *
 * Addresses are view-only (no private keys) and hold Aave positions
 * suitable for testing portfolio / wallet-sync features.
 *
 * Env vars (E2E_WATCH_ADDRESS, E2E_WATCH_ADDRESS_ALT) take precedence
 * so CI can inject different addresses without changing source.
 */

import { expect, type Page } from '@playwright/test';

/** Primary wallet — holds Aave V3 positions on mainnet and Celo. */
export const DEFAULT_WATCH_ADDRESS = '0x4D1c0C87D6f3Bcc4698BBd88A9Da5e4f92B65314';

/** Convenience: read from env or fall back to the default. */
export const WATCH_ADDRESS: string | undefined =
  process.env.E2E_WATCH_ADDRESS ?? DEFAULT_WATCH_ADDRESS;

/**
 * Wait until the header renders *some* wallet affordance.
 *
 * The controls appear only after the app shell has committed and
 * `ConnectButton.Custom` reports `mounted`. Branching on a one-shot
 * `isVisible()` before that always falls through to the mobile-only
 * "Wallet actions" popover trigger — which never exists in the desktop
 * project — turning a plain load race into a selector timeout.
 */
export async function waitForWalletControls(page: Page): Promise<void> {
  const controls = page
    .getByRole('button', { name: /Connect wallet/i })
    .or(page.getByRole('button', { name: /Viewing 0x/i }))
    .or(page.getByRole('button', { name: /^Wallet 0x/i }))
    .or(page.getByRole('button', { name: /View address/i }))
    .or(page.getByRole('button', { name: /Wallet actions/i }));
  await expect(controls.first()).toBeVisible({ timeout: 30_000 });
}
