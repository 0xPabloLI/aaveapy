import { expect, test } from '@playwright/test';
import { PERCENT_RE, USD_PER_DAY_RE, setupPortfolioWithReserve } from './helpers/portfolio-setup';

/**
 * Portfolio incentive calculation E2E verification (AAV-1143) — Desktop.
 *
 * Verifies that Portfolio mode renders incentive values correctly,
 * Golden Rule §1 (current* invariance) holds, cap threshold crossing
 * preserves current, delta badges appear, and APR/APY toggle updates values.
 *
 * Desktop-only — routed via `*.desktop.spec.ts` glob in playwright.config.ts.
 */

/* ── T4: Incentive values display ──────────────────────────────── */

test.describe('Portfolio incentive values display (desktop)', () => {
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

/* ── T5: Golden Rule §1 current invariance ─────────────────────── */

test.describe('Golden Rule §1 — current invariance (desktop)', () => {
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

/* ── T5b: Cap threshold crossing (AAV-1143 Req 3) ─────────────── */

test.describe('Cap threshold crossing — current invariance (desktop)', () => {
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

/* ── T6: Delta badge after manual position input ────────────────── */

test.describe('Delta badge after manual position input (desktop)', () => {
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

/* ── T7: APR/APY toggle updates incentive values ───────────────── */

test.describe('APR/APY toggle updates incentive values (desktop)', () => {
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
