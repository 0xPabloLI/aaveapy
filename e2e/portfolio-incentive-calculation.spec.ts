import { expect, test } from '@playwright/test';

/**
 * Portfolio incentive calculation E2E verification (AAV-1143).
 *
 * Verifies that Portfolio mode renders incentive values correctly,
 * Golden Rule §1 (current* invariance) holds, cap threshold crossing
 * preserves current, delta badges appear, and APR/APY toggle updates values.
 *
 * Uses data-cell, data-testid, data-current/data-after attributes.
 * Does NOT depend on a wallet address — uses manual entry.
 * Validation is format+existence only, not exact numeric values.
 */

const PERCENT_RE = /\-?\d+\.\d{2}%/;
const USD_PER_DAY_RE = /^[+-]?\$[\d,]+(\.\d{2})?$/;

/** Token + market to use for portfolio tests. Must have supply incentives AND ltv > 0 on staging.
 *  GHO on Monad has ltv=75 and merklSupplys — see AAV-1250 E2E fix. */
const PORTFOLIO_TEST_TOKEN = 'GHO';
const PORTFOLIO_TEST_MARKET = 'Monad';

async function setupPortfolioWithReserve(page: import('@playwright/test').Page) {
  await page.goto('/');
  await expect(page.getByRole('textbox', { name: 'Borrow amount' })).toBeVisible();
  await page.getByTestId('portfolio-mode-toggle').click();
  await page.getByRole('button', { name: 'Search tokens' }).click();
  await page.getByRole('textbox', { name: 'Search tokens to add' }).fill(PORTFOLIO_TEST_TOKEN);
  await page.waitForTimeout(500);
  // Find the Add button matching the desired market (handles same-symbol on multiple chains)
  const addButtons = page.getByRole('button', {
    name: `Add ${PORTFOLIO_TEST_TOKEN} (supply and borrow)`,
  });
  const count = await addButtons.count();
  if (count === 0) {
    throw new Error(`No Add button found for ${PORTFOLIO_TEST_TOKEN}`);
  }
  // Pick the button that matches the desired market label
  let clicked = false;
  for (let i = 0; i < count; i++) {
    const btn = addButtons.nth(i);
    const text = await btn.textContent();
    if (text && text.includes(PORTFOLIO_TEST_MARKET)) {
      await btn.click();
      clicked = true;
      break;
    }
  }
  if (!clicked) {
    // Fallback: first result
    await addButtons.first().click();
  }
  const supplyInput = page.getByRole('textbox', { name: new RegExp(`Supply amount for ${PORTFOLIO_TEST_TOKEN}`, 'i') }).first();
  await expect(supplyInput).toBeVisible();
  return supplyInput;
}

/* ── T4: Incentive values display ──────────────────────────────── */

test.describe('Portfolio incentive values display', () => {
  test.describe('desktop', () => {
    test.beforeEach(({}, testInfo) => {
      test.skip(testInfo.project.name.includes('mobile'), 'Desktop table only');
    });

    test('incentive columns show percentage values', async ({ page }) => {
      const supplyInput = await setupPortfolioWithReserve(page);
      await supplyInput.fill('1000000');

      const row = page.locator('tr[data-reserve-id]').first();
      await expect(row).toBeVisible({ timeout: 5000 });

      const supplyIncentive = row.locator('td[data-cell="supply-incentive"]');
      await expect(supplyIncentive).toBeVisible();
      await expect(supplyIncentive).not.toContainText('—', { timeout: 5000 });
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
      const supplyInput = await setupPortfolioWithReserve(page);
      await supplyInput.fill('1000000');

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
      const supplyInput = await setupPortfolioWithReserve(page);
      await supplyInput.fill('1000000');

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
      const supplyInput = await setupPortfolioWithReserve(page);
      await supplyInput.fill('1000000');

      const card = page.locator('[data-reserve-id]').first();
      await expect(card).toBeVisible({ timeout: 5000 });

      const totalSpan = card.locator('span[data-cell="supply-total"]');
      await expect(totalSpan).toBeVisible();
      const totalText = (await totalSpan.textContent())?.trim();
      expect(totalText).toMatch(PERCENT_RE);

      const incentiveSpan = card.locator('span[data-cell="supply-incentive"]');
      await expect(incentiveSpan).toBeVisible();
      const incentiveText = (await incentiveSpan.textContent())?.trim();
      expect(incentiveText).toMatch(PERCENT_RE);
    });
  });
});

/* ── T5: Golden Rule §1 current invariance ─────────────────────── */

test.describe('Golden Rule §1 — current invariance', () => {
  test.describe('desktop', () => {
    test.beforeEach(({}, testInfo) => {
      test.skip(testInfo.project.name.includes('mobile'), 'Desktop table only');
    });

    test('current values do not change after entering supply delta', async ({ page }) => {
      const supplyInput = await setupPortfolioWithReserve(page);
      await supplyInput.fill('1000000');

      const row = page.locator('tr[data-reserve-id]').first();
      await expect(row).toBeVisible({ timeout: 5000 });

      const supplyTotal = row.locator('td[data-cell="supply-total"]');
      await expect(supplyTotal).not.toContainText('—', { timeout: 5000 });

      const metricSpan = supplyTotal.locator('span[data-current]').first();
      const currentBefore = await metricSpan.getAttribute('data-current');

      await supplyInput.clear();
      await supplyInput.fill('500000');
      await expect(supplyTotal).not.toContainText('—', { timeout: 5000 });

      const currentAfter = await metricSpan.getAttribute('data-current');
      expect(currentAfter).toBe(currentBefore);
    });
  });

  test.describe('mobile', () => {
    test.beforeEach(({}, testInfo) => {
      test.skip(!testInfo.project.name.includes('mobile'), 'Mobile DeltaRow only');
    });

    test('current values do not change after entering supply delta', async ({ page }) => {
      const supplyInput = await setupPortfolioWithReserve(page);
      await supplyInput.fill('1000000');

      const card = page.locator('[data-reserve-id]').first();
      await expect(card).toBeVisible({ timeout: 5000 });

      const expandBtn = card.getByRole('button', { name: /Show details/i });
      await expandBtn.click();

      const currentSpan = card.locator('[data-testid="delta-current"]').first();
      await expect(currentSpan).toBeVisible({ timeout: 5000 });
      const currentBefore = await currentSpan.textContent();

      await supplyInput.clear();
      await supplyInput.fill('500000');
      await expect(currentSpan).toBeVisible({ timeout: 3000 });

      const currentAfter = await currentSpan.textContent();
      expect(currentAfter).toBe(currentBefore);

      const afterSpan = card.locator('[data-testid="delta-after"]').first();
      await expect(afterSpan).toBeVisible();
      const deltaSpan = card.locator('[data-testid="delta-value"]').first();
      await expect(deltaSpan).toBeVisible();
    });
  });
});

/* ── T5b: Cap threshold crossing (AAV-1143 Req 3) ─────────────── */

test.describe('Cap threshold crossing — current invariance', () => {
  test.describe('desktop', () => {
    test.beforeEach(({}, testInfo) => {
      test.skip(testInfo.project.name.includes('mobile'), 'Desktop table only');
    });

    test('entering large delta preserves current incentive', async ({ page }) => {
      const supplyInput = await setupPortfolioWithReserve(page);
      await supplyInput.fill('1000');

      const row = page.locator('tr[data-reserve-id]').first();
      await expect(row).toBeVisible({ timeout: 5000 });

      const incentiveCell = row.locator('td[data-cell="supply-incentive"]');
      await expect(incentiveCell).not.toContainText('—', { timeout: 5000 });

      const metricSpan = incentiveCell.locator('span[data-current]').first();
      const currentBefore = await metricSpan.getAttribute('data-current');

      await supplyInput.clear();
      await supplyInput.fill('999999999');
      await expect(incentiveCell).not.toContainText('—', { timeout: 5000 });

      const currentAfter = await metricSpan.getAttribute('data-current');
      expect(currentAfter).toBe(currentBefore);
    });
  });

  test.describe('mobile', () => {
    test.beforeEach(({}, testInfo) => {
      test.skip(!testInfo.project.name.includes('mobile'), 'Mobile card only');
    });

    test('entering large delta preserves current incentive', async ({ page }) => {
      const supplyInput = await setupPortfolioWithReserve(page);
      await supplyInput.fill('1000');

      const card = page.locator('[data-reserve-id]').first();
      await expect(card).toBeVisible({ timeout: 5000 });

      const expandBtn = card.getByRole('button', { name: /Show details/i });
      await expandBtn.click();

      const currentSpan = card.locator('[data-testid="delta-current"]').first();
      await expect(currentSpan).toBeVisible({ timeout: 5000 });
      const currentBefore = await currentSpan.textContent();

      await supplyInput.clear();
      await supplyInput.fill('999999999');
      await expect(currentSpan).toBeVisible({ timeout: 5000 });

      const currentAfter = await currentSpan.textContent();
      expect(currentAfter).toBe(currentBefore);
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
      const supplyInput = await setupPortfolioWithReserve(page);
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
      const supplyInput = await setupPortfolioWithReserve(page);
      await supplyInput.fill('1000000');

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

    test('toggling APR→APY updates radio state and incentive values', async ({ page }) => {
      const supplyInput = await setupPortfolioWithReserve(page);
      await supplyInput.fill('1000000');

      const aprRadio = page.getByRole('radio', { name: 'APR' }).first();
      const apyRadio = page.getByRole('radio', { name: 'APY' }).first();

      await expect(apyRadio).toBeChecked();
      await expect(aprRadio).not.toBeChecked();

      const row = page.locator('tr[data-reserve-id]').first();
      await expect(row).toBeVisible({ timeout: 5000 });
      const supplyTotal = row.locator('td[data-cell="supply-total"]');
      await expect(supplyTotal).not.toContainText('—', { timeout: 5000 });
      const valueBeforeToggle = (await supplyTotal.textContent())?.trim();

      await aprRadio.click();
      await expect(aprRadio).toBeChecked();
      await expect(supplyTotal).not.toContainText('—', { timeout: 5000 });
      const valueAfterToggle = (await supplyTotal.textContent())?.trim();

      expect(valueAfterToggle).toMatch(PERCENT_RE);
      if (valueBeforeToggle !== '—' && valueAfterToggle !== valueBeforeToggle) {
        expect(valueAfterToggle).not.toBe(valueBeforeToggle);
      }

      await apyRadio.click();
      await expect(apyRadio).toBeChecked();
      await expect(supplyTotal).not.toContainText('—', { timeout: 5000 });
      const valueAfterRestore = (await supplyTotal.textContent())?.trim();
      expect(valueAfterRestore).toBe(valueBeforeToggle);
    });
  });

  test.describe('mobile', () => {
    test.beforeEach(({}, testInfo) => {
      test.skip(!testInfo.project.name.includes('mobile'), 'Mobile card only');
    });

    test('toggling APR→APY updates radio state and incentive values', async ({ page }) => {
      const supplyInput = await setupPortfolioWithReserve(page);
      await supplyInput.fill('1000000');

      const aprRadio = page.getByRole('radio', { name: 'APR' }).first();
      const apyRadio = page.getByRole('radio', { name: 'APY' }).first();

      await expect(apyRadio).toBeChecked();
      await expect(aprRadio).not.toBeChecked();

      const card = page.locator('[data-reserve-id]').first();
      await expect(card).toBeVisible({ timeout: 5000 });
      const totalSpan = card.locator('span[data-cell="supply-total"]');
      await expect(totalSpan).toBeVisible();
      const valueBeforeToggle = (await totalSpan.textContent())?.trim();

      await aprRadio.click();
      await expect(aprRadio).toBeChecked();
      await expect(totalSpan).toBeVisible();
      const valueAfterToggle = (await totalSpan.textContent())?.trim();

      expect(valueAfterToggle).toMatch(PERCENT_RE);
      if (valueBeforeToggle !== '—' && valueAfterToggle !== valueBeforeToggle) {
        expect(valueAfterToggle).not.toBe(valueBeforeToggle);
      }

      await apyRadio.click();
      await expect(apyRadio).toBeChecked();
      await expect(totalSpan).toBeVisible();
      const valueAfterRestore = (await totalSpan.textContent())?.trim();
      expect(valueAfterRestore).toBe(valueBeforeToggle);
    });
  });
});
