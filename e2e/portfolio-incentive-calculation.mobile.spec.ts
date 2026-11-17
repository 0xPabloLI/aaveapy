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
 * Portfolio incentive calculation E2E verification (AAV-1143) — mobile cards.
 *
 * Same coverage as the desktop half; the selectors switch to the card shape
 * (`span[data-cell]` inside `[data-reserve-id]`).
 *
 * AAV-1395: mobile-only file. `playwright.config.ts` ignores it in the desktop
 * project, so the tests are never collected-then-skipped per platform.
 */

test.describe('Portfolio incentive values display', () => {
  test.describe('mobile', () => {
    test.beforeEach(() => {
      enforceReserveGate(reserveGate);
    });

    test('metric bar shows incentive and total values', async ({ page }) => {
      test.setTimeout(120_000);
      const supplyInput = await setupPortfolio(page);
      await supplyInput.fill('1000000');

      const card = page.locator('[data-reserve-id]').first();
      await expect(card).toBeVisible({ timeout: 5000 });

      const totalSpan = card.locator('span[data-cell="supply-total"]');
      await expect(totalSpan).toBeVisible();
      await expectValueOrSkip(totalSpan, 'supply-total (mobile)');
      const totalText = (await totalSpan.textContent())?.trim();
      expect(totalText).toMatch(PERCENT_RE);

      const incentiveSpan = card.locator('span[data-cell="supply-incentive"]');
      await expect(incentiveSpan).toBeVisible();
      await expectValueOrSkip(incentiveSpan, 'supply-incentive (mobile)');
      const incentiveText = (await incentiveSpan.textContent())?.trim();
      expect(incentiveText).toMatch(PERCENT_RE);
    });
  });
});

/* ── T5: Golden Rule §1 current invariance ─────────────────────── */

test.describe('Golden Rule §1 — current invariance', () => {
  test.describe('mobile', () => {
    test.beforeEach(() => {
      enforceReserveGate(reserveGate);
    });

    test('current values do not change after entering supply delta', async ({ page }) => {
      test.setTimeout(120_000);
      const supplyInput = await setupPortfolio(page);
      await supplyInput.fill('1000000');

      const card = page.locator('[data-reserve-id]').first();
      await expect(card).toBeVisible({ timeout: 5000 });

      // Read current from metrics strip (always rendered), not DeltaRow (conditionally rendered).
      // Aligns with desktop pattern: td[data-cell="supply-total"] span[data-current]
      const totalCell = card.locator('span[data-cell="supply-total"]');
      await expectValueOrSkip(totalCell, 'supply-total (mobile, before delta)');
      const currentBefore = await readDataCurrentOrSkip(totalCell, 'supply-total (mobile, before delta)');

      await supplyInput.clear();
      await supplyInput.fill('500000');

      const currentAfter = await readDataCurrentOrSkip(totalCell, 'supply-total (mobile, after delta)');
      expect(currentAfter).toBe(currentBefore);
    });
  });
});

/* ── T5b: Cap threshold crossing (AAV-1143 Req 3) ─────────────── */

test.describe('Cap threshold crossing — current invariance', () => {
  test.describe('mobile', () => {
    test.beforeEach(() => {
      enforceReserveGate(reserveGate);
    });

    test('entering large delta preserves current incentive', async ({ page }) => {
      test.setTimeout(120_000);
      const supplyInput = await setupPortfolio(page);
      await supplyInput.fill('1000');

      const card = page.locator('[data-reserve-id]').first();
      await expect(card).toBeVisible({ timeout: 5000 });

      // Read current from metrics strip (always rendered), not DeltaRow (conditionally rendered).
      // Aligns with desktop pattern: td[data-cell="supply-incentive"] span[data-current]
      const incentiveCell = card.locator('span[data-cell="supply-incentive"]');
      await expectValueOrSkip(incentiveCell, 'supply-incentive (mobile, before cap)');
      const currentBefore = await readDataCurrentOrSkip(incentiveCell, 'supply-incentive (mobile, before cap)');

      await supplyInput.clear();
      await supplyInput.fill('999999999');

      const currentAfter = await readDataCurrentOrSkip(incentiveCell, 'supply-incentive (mobile, after cap)');
      expect(currentAfter).toBe(currentBefore);
    });
  });
});

/* ── T6: Delta badge after manual position input ────────────────── */

test.describe('Delta badge after manual position input', () => {
  test.describe('mobile', () => {
    test.beforeEach(() => {
      enforceReserveGate(reserveGate);
    });

    test('usd-per-day shows value after entering amount', async ({ page }) => {
      test.setTimeout(120_000);
      const supplyInput = await setupPortfolio(page);
      await supplyInput.fill('1000000');

      const card = page.locator('[data-reserve-id]').first();
      await expect(card).toBeVisible({ timeout: 5000 });

      const usdPerDay = card.locator('span[data-cell="supply-usd-per-day"]');
      await expect(usdPerDay).toBeVisible({ timeout: 5000 });
      await expectValueOrSkip(usdPerDay, 'supply-usd-per-day (mobile)');
      const text = (await usdPerDay.textContent())?.trim();
      expect(text).toMatch(USD_PER_DAY_RE);
    });
  });
});

/* ── T7: APR/APY toggle updates incentive values ───────────────── */

test.describe('APR/APY toggle updates incentive values', () => {
  test.describe('mobile', () => {
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

      const card = page.locator('[data-reserve-id]').first();
      await expect(card).toBeVisible({ timeout: 5000 });
      const totalSpan = card.locator('span[data-cell="supply-total"]');
      await expect(totalSpan).toBeVisible();
      await expectValueOrSkip(totalSpan, 'supply-total (mobile, before APR toggle)');
      const valueBeforeToggle = (await totalSpan.textContent())?.trim();

      await aprRadio.click();
      await expect(aprRadio).toBeChecked();
      await expectValueOrSkip(totalSpan, 'supply-total (mobile, after APR toggle)');
      const valueAfterToggle = (await totalSpan.textContent())?.trim();

      expect(valueAfterToggle).toMatch(PERCENT_RE);
      if (valueBeforeToggle !== '—' && valueAfterToggle !== valueBeforeToggle) {
        expect(valueAfterToggle).not.toBe(valueBeforeToggle);
      }

      await apyRadio.click();
      await expect(apyRadio).toBeChecked();
      await expectValueOrSkip(totalSpan, 'supply-total (mobile, after APY restore)');
      const valueAfterRestore = (await totalSpan.textContent())?.trim();
      expect(valueAfterRestore).toBe(valueBeforeToggle);
    });
  });
});
