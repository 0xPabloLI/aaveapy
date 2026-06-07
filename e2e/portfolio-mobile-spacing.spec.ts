import { expect, test } from '@playwright/test';

/**
 * Mobile-only screenshot + spacing assertion for the portfolio input rows.
 *
 * Verifies the parent grid's horizontal gap correctly propagates through
 * `grid-cols-subgrid` so the token-info column and the supply input column
 * never touch. Regression guard for the recent gap-x-2 fix.
 */
test.describe('Portfolio input — mobile spacing', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(!testInfo.project.name.includes('mobile'), 'Mobile-only check');
  });

  test('token info column keeps a visible gap from the supply input', async ({ page }, testInfo) => {
    await page.goto('/');

    // Wait for the reserves grid to mount so the panel has data to search.
    await expect(page.getByRole('textbox', { name: 'Borrow amount' })).toBeVisible();

    // 1) Enable Portfolio mode by clicking the "Portfolio" label (wraps the Switch).
    await page.getByText('Portfolio', { exact: true }).first().click();

    // 2) Open the in-panel search and pick the first available reserve.
    await page.getByRole('button', { name: 'Search tokens' }).click();
    await page.getByRole('textbox', { name: 'Search tokens to add' }).fill('USDC');

    const addBtn = page
      .getByRole('button', { name: /^Add .+ \(supply and borrow\)$/ })
      .first();
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    // 3) Locate the parent grid wrapping PortfolioTokenRow. It uses an inline
    //    template with `minmax(0,max-content)_minmax(11rem,1fr)` on mobile.
    const grid = page
      .locator('div.grid')
      .filter({
        has: page.locator(':scope > div.grid-cols-subgrid'),
      })
      .first();
    await expect(grid).toBeVisible();

    const row = grid.locator(':scope > div.grid-cols-subgrid').first();
    await expect(row).toBeVisible();

    // The mobile row contains exactly two grid children: token info | inputs.
    const tokenCol = row.locator(':scope > div').nth(0);
    const inputCol = row.locator(':scope > div').nth(1);

    const [leftBox, rightBox] = await Promise.all([
      tokenCol.boundingBox(),
      inputCol.boundingBox(),
    ]);
    expect(leftBox, 'token-info column must render').not.toBeNull();
    expect(rightBox, 'input column must render').not.toBeNull();
    if (!leftBox || !rightBox) return;

    // Parent grid declares `gap-x-2` (0.5rem ≈ 8px). Allow a ≥6px floor to
    // tolerate sub-pixel rounding while still failing if gap-x is removed
    // and the subgrid row collapses to 0px column gap.
    const gap = rightBox.x - (leftBox.x + leftBox.width);
    expect(
      gap,
      `Token info and input columns must not touch (measured gap=${gap}px)`,
    ).toBeGreaterThanOrEqual(6);

    // Sanity: the input column should be wide enough to host the supply input.
    expect(rightBox.width).toBeGreaterThan(80);

    // Capture a screenshot of the row for visual review (attached on failure
    // automatically by Playwright; saved unconditionally for manual review).
    await row.screenshot({
      path: testInfo.outputPath('portfolio-row-mobile.png'),
    });
  });
});
