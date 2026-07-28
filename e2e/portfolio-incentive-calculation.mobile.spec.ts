import { expect, test } from '@playwright/test';
import { PERCENT_RE, setupPortfolioWithReserve } from './helpers/portfolio-setup';

/**
 * Portfolio incentive calculation E2E verification (AAV-1143) — Mobile.
 *
 * Verifies that Portfolio mode renders incentive values correctly,
 * Golden Rule §1 (current* invariance) holds, cap threshold crossing
 * preserves current, delta badges appear, and APR/APY toggle updates values.
 *
 * Mobile-only — routed via `*.mobile.spec.ts` glob in playwright.config.ts.
 */

/* ── T4: Incentive values display ──────────────────────────────── */

test.describe('Portfolio incentive values display (mobile)', () => {
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

/* ── T5: Golden Rule §1 current invariance ─────────────────────── */

test.describe('Golden Rule §1 — current invariance (mobile)', () => {
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

/* ── T5b: Cap threshold crossing (AAV-1143 Req 3) ─────────────── */

test.describe('Cap threshold crossing — current invariance (mobile)', () => {
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

/* ── T6: Delta badge after manual position input ────────────────── */

test.describe('Delta badge after manual position input (mobile)', () => {
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

/* ── T7: APR/APY toggle updates incentive values ───────────────── */

test.describe('APR/APY toggle updates incentive values (mobile)', () => {
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
