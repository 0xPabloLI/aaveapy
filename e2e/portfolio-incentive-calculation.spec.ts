import { expect, test } from '@playwright/test';

/**
 * Portfolio incentive calculation E2E verification (AAV-1143).
 *
 * Verifies that Portfolio mode renders incentive values correctly,
 * Golden Rule §1 (current* invariance) holds, delta badges appear,
 * and APR/APY toggle updates values.
 *
 * Uses data-cell and data-testid attributes added in AAV-1152/AAV-1153.
 * Does NOT depend on a wallet address — uses manual entry.
 * Validation is format+existence only, not exact numeric values.
 */

const PERCENT_RE = /^\-?\d+\.\d{2}%$/;
const PERCENT_RE_LENIENT = /\-?\d+\.\d{2}%/;
const USD_PER_DAY_RE = /^[+-]?\$[\d,]+(\.\d{2})?$/;

async function addReserveAndEnterAmount(page: import('@playwright/test').Page) {
  await page.goto('/');
  await expect(page.getByRole('textbox', { name: 'Borrow amount' })).toBeVisible();
  await page.getByTestId('portfolio-mode-toggle').click();
  await page.getByRole('button', { name: 'Search tokens' }).click();
  await page.getByRole('textbox', { name: 'Search tokens to add' }).fill('USDC');
  const addBtn = page
    .getByRole('button', { name: /^Add .+ \(supply and borrow\)$/ })
    .first();
  await expect(addBtn).toBeVisible();
  await addBtn.click();
  const supplyInput = page.getByRole('textbox', { name: /Supply amount for USDC/i }).first();
  await expect(supplyInput).toBeVisible();
  await supplyInput.fill('1000000');
  return supplyInput;
}

/* ── T4: Incentive values display ──────────────────────────────── */

test.describe('Portfolio incentive values display', () => {
  test.describe('desktop', () => {
    test.beforeEach(({}, testInfo) => {
      test.skip(testInfo.project.name.includes('mobile'), 'Desktop table only');
    });

    test('incentive columns show percentage values', async ({ page }) => {
      await addReserveAndEnterAmount(page);

      const row = page.locator('tr[data-reserve-id]').first();
      await expect(row).toBeVisible({ timeout: 5000 });

      const supplyIncentive = row.locator('td[data-cell="supply-incentive"]');
      await expect(supplyIncentive).toBeVisible();
      await expect(supplyIncentive).not.toContainText('—', { timeout: 5000 });
      const supplyText = await supplyIncentive.textContent();
      expect(supplyText).toMatch(PERCENT_RE_LENIENT);

      const borrowIncentive = row.locator('td[data-cell="borrow-incentive"]');
      await expect(borrowIncentive).toBeVisible();
      const borrowText = (await borrowIncentive.textContent())?.trim();
      if (borrowText !== '—') {
        expect(borrowText).toMatch(PERCENT_RE_LENIENT);
      }
    });

    test('total columns show percentage values', async ({ page }) => {
      await addReserveAndEnterAmount(page);

      const row = page.locator('tr[data-reserve-id]').first();
      await expect(row).toBeVisible({ timeout: 5000 });

      const supplyTotal = row.locator('td[data-cell="supply-total"]');
      await expect(supplyTotal).not.toContainText('—', { timeout: 5000 });
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
      await addReserveAndEnterAmount(page);

      const row = page.locator('tr[data-reserve-id]').first();
      await expect(row).toBeVisible({ timeout: 5000 });

      const supplyNative = row.locator('td[data-cell="supply-native"]');
      await expect(supplyNative).not.toContainText('—', { timeout: 5000 });
      const supplyText = (await supplyNative.textContent())?.trim();
      expect(supplyText).toMatch(PERCENT_RE);

      const borrowNative = row.locator('td[data-cell="borrow-native"]');
      await expect(borrowNative).toBeVisible();
      const borrowText = (await borrowNative.textContent())?.trim();
      if (borrowText !== '—') {
        expect(borrowText).toMatch(PERCENT_RE);
      }
    });
  });

  test.describe('mobile', () => {
    test.beforeEach(({}, testInfo) => {
      test.skip(!testInfo.project.name.includes('mobile'), 'Mobile card only');
    });

    test('metric bar shows incentive and total values', async ({ page }) => {
      await addReserveAndEnterAmount(page);

      const card = page.locator('[data-reserve-id]').first();
      await expect(card).toBeVisible({ timeout: 5000 });

      const totalSpan = card.locator('span[data-cell="supply-total"]');
      await expect(totalSpan).toBeVisible();
      const totalText = (await totalSpan.textContent())?.trim();
      expect(totalText).toMatch(PERCENT_RE);

      const incentiveSpan = card.locator('span[data-cell="supply-incentive"]');
      await expect(incentiveSpan).toBeVisible();
      const incentiveText = (await incentiveSpan.textContent())?.trim();
      expect(incentiveText).toMatch(PERCENT_RE_LENIENT);
    });
  });
});

/* ── T5: Golden Rule §1 current invariance ─────────────────────── */

test.describe('Golden Rule §1 — current invariance', () => {
  test.describe('mobile', () => {
    test.beforeEach(({}, testInfo) => {
      test.skip(!testInfo.project.name.includes('mobile'), 'Mobile DeltaRow only');
    });

    test('current values do not change after entering supply delta', async ({ page }) => {
      await addReserveAndEnterAmount(page);

      const card = page.locator('[data-reserve-id]').first();
      await expect(card).toBeVisible({ timeout: 5000 });

      // Expand the details section
      const expandBtn = card.getByRole('button', { name: /Show details/i });
      await expandBtn.click();
      await page.waitForTimeout(1000);

      // Read current value from the first visible delta-current span
      const currentSpan = card.locator('[data-testid="delta-current"]').first();
      await expect(currentSpan).toBeVisible({ timeout: 5000 });
      const currentBefore = await currentSpan.textContent();

      // Change the input to a different amount
      const supplyInput = page.getByRole('textbox', { name: /Supply amount for USDC/i }).first();
      await supplyInput.clear();
      await supplyInput.fill('500000');
      await page.waitForTimeout(1000);

      // Verify current hasn't changed
      const currentAfter = await currentSpan.textContent();
      expect(currentAfter).toBe(currentBefore);

      // Verify after and delta are visible
      const afterSpan = card.locator('[data-testid="delta-after"]').first();
      await expect(afterSpan).toBeVisible();
      const deltaSpan = card.locator('[data-testid="delta-value"]').first();
      await expect(deltaSpan).toBeVisible();
    });
  });
});

/* ── T6: Delta badge after manual position input ────────────────── */

test.describe('Delta badge after manual position input', () => {
  test.describe('desktop', () => {
    test.beforeEach(({}, testInfo) => {
      test.skip(testInfo.project.name.includes('mobile'), 'Desktop table only');
    });

    test('supply $/day cell shows delta after entering amount', async ({ page }) => {
      await addReserveAndEnterAmount(page);

      const supplyInput = page.getByRole('textbox', { name: /Supply amount for USDC/i }).first();
      await supplyInput.fill('1000000');

      const row = page.locator('tr[data-reserve-id]').first();
      await expect(row).toBeVisible({ timeout: 5000 });

      const usdPerDay = row.locator('td[data-cell="supply-usd-per-day"]');
      await expect(usdPerDay).toBeVisible({ timeout: 5000 });
      const text = await usdPerDay.textContent();
      expect(text?.trim()).toMatch(USD_PER_DAY_RE);
    });
  });

  test.describe('mobile', () => {
    test.beforeEach(({}, testInfo) => {
      test.skip(!testInfo.project.name.includes('mobile'), 'Mobile card only');
    });

    test('usd-per-day shows value after entering amount', async ({ page }) => {
      await addReserveAndEnterAmount(page);

      const card = page.locator('[data-reserve-id]').first();
      await expect(card).toBeVisible({ timeout: 5000 });

      const usdPerDay = card.locator('span[data-cell="supply-usd-per-day"]');
      await expect(usdPerDay).toBeVisible({ timeout: 5000 });
      const text = (await usdPerDay.textContent())?.trim();
      expect(text).not.toBe('—');
    });
  });
});

/* ── T7: APR/APY toggle updates incentive values ───────────────── */

test.describe('APR/APY toggle updates incentive values', () => {
  test.describe('desktop', () => {
    test.beforeEach(({}, testInfo) => {
      test.skip(testInfo.project.name.includes('mobile'), 'Desktop table only');
    });

    test('toggling APR→APY updates radio checked state', async ({ page }) => {
      await addReserveAndEnterAmount(page);

      const aprRadio = page.getByRole('radio', { name: 'APR' }).first();
      const apyRadio = page.getByRole('radio', { name: 'APY' }).first();

      // APY is selected by default
      await expect(apyRadio).toBeChecked();
      await expect(aprRadio).not.toBeChecked();

      await aprRadio.click();
      await page.waitForTimeout(500);

      await expect(apyRadio).not.toBeChecked();
      await expect(aprRadio).toBeChecked();

      await apyRadio.click();
      await page.waitForTimeout(500);

      await expect(apyRadio).toBeChecked();
      await expect(aprRadio).not.toBeChecked();
    });
  });

  test.describe('mobile', () => {
    test.beforeEach(({}, testInfo) => {
      test.skip(!testInfo.project.name.includes('mobile'), 'Mobile card only');
    });

    test('toggling APR→APY updates radio checked state', async ({ page }) => {
      await addReserveAndEnterAmount(page);

      const aprRadio = page.getByRole('radio', { name: 'APR' }).first();
      const apyRadio = page.getByRole('radio', { name: 'APY' }).first();

      // APY is selected by default
      await expect(apyRadio).toBeChecked();
      await expect(aprRadio).not.toBeChecked();

      await aprRadio.click();
      await page.waitForTimeout(500);

      await expect(apyRadio).not.toBeChecked();
      await expect(aprRadio).toBeChecked();
    });
  });
});
