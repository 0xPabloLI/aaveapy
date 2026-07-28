import { expect, test } from '@playwright/test';

async function waitForMobileReservesReady(page: Parameters<typeof test>[0]['page']) {
  await expect(page.getByRole('textbox', { name: 'Borrow amount' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Expand details panel/i }).first()).toBeVisible();
}

test.describe('Reserves mobile interaction matrix', () => {
  test('expand + scenario input keeps expanded card coherent on mobile', async ({ page }) => {
    await page.goto('/');
    await waitForMobileReservesReady(page);

    const expandButton = page.getByRole('button', { name: /Expand details panel/i }).first();
    await expandButton.click();

    const collapseButton = page.getByRole('button', { name: /Collapse details panel/i }).first();
    await expect(collapseButton).toBeVisible();

    await page.getByRole('textbox', { name: 'Borrow amount' }).fill('250000');
    await page.waitForTimeout(900);

    await expect(collapseButton).toBeVisible();
  });

  test('market toggle + search cleanup does not leave dangling expanded mobile state', async ({ page }) => {
    await page.goto('/');
    await waitForMobileReservesReady(page);

    const expandButton = page.getByRole('button', { name: /Expand details panel/i }).first();
    await expandButton.click();
    await expect(page.getByRole('button', { name: /Collapse details panel/i })).toHaveCount(1);

    const arbitrumChip = page.locator('button:has-text("Arbitrum")').first();
    await expect(arbitrumChip).toBeVisible();
    await arbitrumChip.click();

    const expandedCountAfterMarket = await page.getByRole('button', { name: /Collapse details panel/i }).count();
    expect(expandedCountAfterMarket).toBeLessThanOrEqual(1);

    await page.getByRole('textbox', { name: 'Search token' }).fill('__no_match_for_mobile_e2e__');
    await expect(page.getByRole('button', { name: /Collapse details panel/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Expand details panel/i })).toHaveCount(0);
  });
});
