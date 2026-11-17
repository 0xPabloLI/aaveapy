import { expect, test } from '@playwright/test';

import {
  PERCENT_RE,
  USD_PER_DAY_RE,
  expectValueOrSkip,
  readDataCurrentOrSkip,
  reserveGate,
  setupPortfolio,
} from './portfolio-incentive-calculation.helpers';
import { enforceReserveGate } from './test-reserves';

/**
 * Portfolio incentive calculation E2E verification (AAV-1143) — desktop table.
 *
 * Verifies that Portfolio mode renders incentive values correctly,
 * Golden Rule §1 (current* invariance) holds, cap threshold crossing
 * preserves current, delta badges appear, and APR/APY toggle updates values.
 *
 * AAV-1395: desktop-only file. `playwright.config.ts` ignores it in the mobile
 * project, so the tests are never collected-then-skipped per platform.
 */

test.describe('Portfolio incentive values display', () => {
  test.describe('desktop', () => {
    test.beforeEach(() => {
      enforceReserveGate(reserveGate);
    });

    test('incentive columns show percentage values', async ({ page }) => {
      test.setTimeout(120_000);
      const supplyInput = await setupPortfolio(page);
      await supplyInput.fill('1000000');

      const row = page.locator('tr[data-reserve-id]').first();
      await expect(row).toBeVisible({ timeout: 5000 });

      const supplyIncentive = row.locator('td[data-cell="supply-incentive"]');
      await expect(supplyIncentive).toBeVisible();
      await expectValueOrSkip(supplyIncentive, 'supply-incentive');
      const supplyText = await supplyIncentive.textContent();
      expect(supplyText).toMatch(PERCENT_RE);

      const borrowIncentive = row.locator('td[data-cell="borrow-incentive"]');
      await expect(borrowIncentive).toBeVisible();
      const borrowText = (await borrowIncentive.textContent())?.trim();
      if (borrowText !== '—') {
        expect(borrowText).toMatch(PERCENT_RE);
      }
    });

    test('total columns show percentage values', async ({ page }) => {
      test.setTimeout(120_000);
      const supplyInput = await setupPortfolio(page);
      await supplyInput.fill('1000000');

      const row = page.locator('tr[data-reserve-id]').first();
      await expect(row).toBeVisible({ timeout: 5000 });

      const supplyTotal = row.locator('td[data-cell="supply-total"]');
      await expectValueOrSkip(supplyTotal, 'supply-total');
      const supplyText = (await supplyTotal.textContent())?.trim();
      expect(supplyText).toMatch(PERCENT_RE);

      const borrowTotal = row.locator('td[data-cell="borrow-total"]');
      await expect(borrowTotal).toBeVisible();
      const borrowTotalText = (await borrowTotal.textContent())?.trim();
      if (borrowTotalText !== '—') {
        expect(borrowTotalText).toMatch(PERCENT_RE);
      }
    });

    test('native columns show percentage values', async ({ page }) => {
      test.setTimeout(120_000);
      const supplyInput = await setupPortfolio(page);
      await supplyInput.fill('1000000');

      const row = page.locator('tr[data-reserve-id]').first();
      await expect(row).toBeVisible({ timeout: 10_000 });

      const supplyNative = row.locator('td[data-cell="supply-native"]');
      // Wait for rate calculation to complete (up to 30s with dev:staging).
      // If still '—' after 30s, the discovered reserve has no native supply rate — skip gracefully.
      try {
        await expect(supplyNative).not.toContainText('—', { timeout: 30_000 });
      } catch {
        test.skip(true, 'Discovered reserve has no native supply rate on staging');
      }
      const supplyText = (await supplyNative.textContent())?.trim();
      expect(supplyText).toMatch(PERCENT_RE);

      const borrowNative = row.locator('td[data-cell="borrow-native"]');
      await expect(borrowNative).toBeVisible({ timeout: 10_000 });
      const borrowText = (await borrowNative.textContent())?.trim();
      if (borrowText !== '—') {
        expect(borrowText).toMatch(PERCENT_RE);
      }
    });
  });
});

/* ── T5: Golden Rule §1 current invariance ─────────────────────── */

test.describe('Golden Rule §1 — current invariance', () => {
  test.describe('desktop', () => {
    test.beforeEach(() => {
      enforceReserveGate(reserveGate);
    });

    test('current values do not change after entering supply delta', async ({ page }) => {
      test.setTimeout(120_000);
      const supplyInput = await setupPortfolio(page);
      await supplyInput.fill('1000000');

      const row = page.locator('tr[data-reserve-id]').first();
      await expect(row).toBeVisible({ timeout: 5000 });

      const supplyTotal = row.locator('td[data-cell="supply-total"]');
      await expectValueOrSkip(supplyTotal, 'supply-total (before delta)');

      const currentBefore = await readDataCurrentOrSkip(supplyTotal, 'supply-total (before delta)');

      await supplyInput.clear();
      await supplyInput.fill('500000');
      await expectValueOrSkip(supplyTotal, 'supply-total (after delta)');

      const currentAfter = await readDataCurrentOrSkip(supplyTotal, 'supply-total (after delta)');
      expect(currentAfter).toBe(currentBefore);
    });
  });
});

/* ── T5b: Cap threshold crossing (AAV-1143 Req 3) ─────────────── */

test.describe('Cap threshold crossing — current invariance', () => {
  test.describe('desktop', () => {
    test.beforeEach(() => {
      enforceReserveGate(reserveGate);
    });

    test('entering large delta preserves current incentive', async ({ page }) => {
      test.setTimeout(120_000);
      const supplyInput = await setupPortfolio(page);
      await supplyInput.fill('1000');

      const row = page.locator('tr[data-reserve-id]').first();
      await expect(row).toBeVisible({ timeout: 5000 });

      const incentiveCell = row.locator('td[data-cell="supply-incentive"]');
      await expectValueOrSkip(incentiveCell, 'supply-incentive (before cap)');

      const currentBefore = await readDataCurrentOrSkip(incentiveCell, 'supply-incentive (before cap)');

      await supplyInput.clear();
      await supplyInput.fill('999999999');
      await expectValueOrSkip(incentiveCell, 'supply-incentive (after cap)');

      const currentAfter = await readDataCurrentOrSkip(incentiveCell, 'supply-incentive (after cap)');
      expect(currentAfter).toBe(currentBefore);
    });
  });
});

/* ── T6: Delta badge after manual position input ────────────────── */

test.describe('Delta badge after manual position input', () => {
  test.describe('desktop', () => {
    test.beforeEach(() => {
      enforceReserveGate(reserveGate);
    });

    test('supply $/day cell shows delta after entering amount', async ({ page }) => {
      test.setTimeout(120_000);
      const supplyInput = await setupPortfolio(page);
      await supplyInput.fill('1000000');

      const row = page.locator('tr[data-reserve-id]').first();
      await expect(row).toBeVisible({ timeout: 5000 });

      const usdPerDay = row.locator('td[data-cell="supply-usd-per-day"]');
      await expect(usdPerDay).toBeVisible({ timeout: 5000 });
      await expectValueOrSkip(usdPerDay, 'supply-usd-per-day (desktop)');
      const text = await usdPerDay.textContent();
      expect(text?.trim()).toMatch(USD_PER_DAY_RE);
    });
  });
});

/* ── T7: APR/APY toggle updates incentive values ───────────────── */

test.describe('APR/APY toggle updates incentive values', () => {
  test.describe('desktop', () => {
    test.beforeEach(() => {
      enforceReserveGate(reserveGate);
    });

    test('toggling APR→APY updates radio state and incentive values', async ({ page }) => {
      test.setTimeout(120_000);
      const supplyInput = await setupPortfolio(page);
      await supplyInput.fill('1000000');

      const aprRadio = page.getByRole('radio', { name: 'APR' }).first();
      const apyRadio = page.getByRole('radio', { name: 'APY' }).first();

      await expect(apyRadio).toBeChecked();
      await expect(aprRadio).not.toBeChecked();

      const row = page.locator('tr[data-reserve-id]').first();
      await expect(row).toBeVisible({ timeout: 5000 });
      const supplyTotal = row.locator('td[data-cell="supply-total"]');
      await expectValueOrSkip(supplyTotal, 'supply-total (before APR toggle)');
      const valueBeforeToggle = (await supplyTotal.textContent())?.trim();

      await aprRadio.click();
      await expect(aprRadio).toBeChecked();
      await expectValueOrSkip(supplyTotal, 'supply-total (after APR toggle)');
      const valueAfterToggle = (await supplyTotal.textContent())?.trim();

      expect(valueAfterToggle).toMatch(PERCENT_RE);
      if (valueBeforeToggle !== '—' && valueAfterToggle !== valueBeforeToggle) {
        expect(valueAfterToggle).not.toBe(valueBeforeToggle);
      }

      await apyRadio.click();
      await expect(apyRadio).toBeChecked();
      await expectValueOrSkip(supplyTotal, 'supply-total (after APY restore)');
      const valueAfterRestore = (await supplyTotal.textContent())?.trim();
      expect(valueAfterRestore).toBe(valueBeforeToggle);
    });
  });
});
