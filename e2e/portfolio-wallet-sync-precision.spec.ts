import { expect, test, type Page } from '@playwright/test';

/**
 * Wallet Sync precision regression.
 *
 * After clicking Wallet Sync, every amount input in the portfolio panel must
 * preserve the 8-significant-digit format produced by `formatConvertedAmount`
 * (see src/lib/portfolioCalculator.ts). Raw floats like
 * "1737.4839284729384" are a regression — see fix in
 * src/lib/walletPositionToPortfolio.ts that switched from `String(...)` to
 * `formatConvertedAmount(...)`.
 *
 * This test requires a watch-mode-compatible address that actually holds
 * Aave positions (WETH/GHO ideally). Provide it via env:
 *   E2E_WATCH_ADDRESS=0x...    (skips otherwise)
 */

import { WATCH_ADDRESS, waitForWalletControls } from './test-wallets';
import { setupPortfolioMode } from './test-reserves';

/**
 * Open the Watch-address input. On mobile the Connect / View-address
 * affordances are compacted behind a "Wallet actions" icon Popover, so the
 * "View address" button is not directly visible — fall back to the popover.
 */
async function openViewAddress(page: Page) {
  await waitForWalletControls(page);
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

/** Max significant digits emitted by `formatConvertedAmount`. */
const MAX_SIG_DIGITS = 8;

function significantDigits(raw: string): number {
  const cleaned = raw.replace(/,/g, '').replace(/^[-+]/, '');
  if (!/^\d*(\.\d*)?$/.test(cleaned) || cleaned === '' || cleaned === '.') return 0;
  const [intPart = '', fracPart = ''] = cleaned.split('.');
  const digits = (intPart + fracPart).replace(/^0+/, '');
  // Trailing zeros in the fractional part are significant for display, but
  // `formatConvertedAmount` strips them — treat any trailing zero in the
  // fractional part as non-significant so the assertion stays meaningful.
  const trimmed = fracPart ? digits.replace(/0+$/, '') : digits;
  return trimmed.length;
}

test.describe('Portfolio — Wallet Sync precision', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(!WATCH_ADDRESS, 'E2E_WATCH_ADDRESS not set');
    test.skip(
      !!process.env.CI,
      'Requires live Aave SDK GraphQL connections — run locally (set E2E_PROXY if your network needs a proxy)',
    );
  });

  test('amount inputs keep ≤8 significant digits after Wallet Sync', async ({ page }) => {
    test.setTimeout(180_000);

    // Enable portfolio mode (also waits for the app-ready signal).
    await setupPortfolioMode(page);

    // Open Watch Address input, submit the address.
    await openViewAddress(page);
    const addrInput = page.getByRole('textbox', { name: /address/i }).first();
    await addrInput.fill(WATCH_ADDRESS!);
    await addrInput.press('Enter');

    // Wait for the wallet-synced rows to render at least one amount input.
    const amountInputs = page.locator('input[inputmode="decimal"]');
    await expect.poll(async () => amountInputs.count(), { timeout: 20_000 }).toBeGreaterThan(0);

    const snapshot = async () =>
      Promise.all((await amountInputs.all()).map(async (el) => (await el.inputValue()) ?? ''));

    const initial = (await snapshot()).filter((v) => v.trim() !== '');
    expect(initial.length, 'wallet sync produced at least one populated amount').toBeGreaterThan(0);
    for (const v of initial) {
      expect(significantDigits(v), `initial value "${v}" within ${MAX_SIG_DIGITS} sig digits`).toBeLessThanOrEqual(MAX_SIG_DIGITS);
    }

    // Click Wallet Sync again (refresh) — find by accessible label.
    await page.getByRole('button', { name: /Wallet sync|Sync wallet|Refresh wallet/i }).first().click();

    // Wait for the resync to land by polling for amount inputs to be populated.
    await expect.poll(
      async () => {
        const vals = (await snapshot()).filter((v) => v.trim() !== '');
        return vals.length;
      },
      { timeout: 15_000, message: 'wallet sync re-sync to populate amount inputs' },
    ).toBeGreaterThan(0);

    const after = (await snapshot()).filter((v) => v.trim() !== '');
    expect(after.length).toBeGreaterThan(0);
    for (const v of after) {
      expect(significantDigits(v), `post-sync value "${v}" within ${MAX_SIG_DIGITS} sig digits`).toBeLessThanOrEqual(MAX_SIG_DIGITS);
    }

    // And the populated value set should not regress to longer strings than
    // what we saw on the first render (the precision should be identical).
    // Determinism guard: the same address re-synced produces identical values,
    // so the max significant-digit count must match EXACTLY. A loose `≤` would
    // mask a precision-loss regression (fewer digits after resync). See
    // docs/specs/e2e-suite-boundary-cleanup.md (T6, S19).
    const maxBefore = Math.max(...initial.map(significantDigits));
    const maxAfter = Math.max(...after.map(significantDigits));
    expect(maxAfter, `precision after resync (${maxAfter}) must equal initial (${maxBefore})`).toBe(maxBefore);
  });
});
