import { expect, test } from '@playwright/test';

test.describe('Top Opportunities mobile layout', () => {
  test.beforeEach(async ({ page: _page }, testInfo) => {
    test.skip(!testInfo.project.name.includes('mobile'), 'Mobile layout only');
  });

  test('mini card labels do not overlap total APY value', async ({ page }) => {
    await page.goto('/');

    const cards = page.locator('div.h-\\[68px\\].flex.flex-col.justify-between');
    await expect(cards.first()).toBeVisible();

    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i += 1) {
      const card = cards.nth(i);
      const leftBlock = card.locator('div.min-w-0.flex-1').first();
      const rightValue = card.locator('div.shrink-0.tabular-nums.text-right').first();

      await expect(leftBlock).toBeVisible();
      await expect(rightValue).toBeVisible();

      const leftBox = await leftBlock.boundingBox();
      const rightBox = await rightValue.boundingBox();

      expect(leftBox, `missing left box for card ${i}`).not.toBeNull();
      expect(rightBox, `missing right box for card ${i}`).not.toBeNull();

      if (!leftBox || !rightBox) continue;

      expect(
        leftBox.x + leftBox.width,
        `card ${i} left content overlaps right value`
      ).toBeLessThanOrEqual(rightBox.x + 0.5);
    }
  });
});
