import { expect, test } from '@playwright/test';

test.describe('Top Opportunities mobile layout', () => {
  test.beforeEach(async ({ page: _page }, testInfo) => {
    test.skip(!testInfo.project.name.includes('mobile'), 'Mobile layout only');
  });

  test('mini card labels do not overlap total APY value', async ({ page }) => {
    await page.goto('/');

    // Mini cards live inside the mobile carousel. They use a flex column layout
    // with a token identity row + an APY row; the right-aligned total APY value
    // sits in `div.shrink-0.tabular-nums.text-right`.
    const cards = page.locator('[data-embla-slide], .embla__slide, [role="group"][aria-roledescription="slide"]')
      .first()
      .locator('div.rounded-xl.border.cursor-pointer');
    await expect(cards.first()).toBeVisible({ timeout: 30_000 });

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

  test('carousel second page snaps within the viewport', async ({ page }) => {
    test.skip(!!process.env.CI, 'Carousel snap animation timing varies in CI — run locally');
    await page.goto('/');

    // App-ready signal before the tight default expect timeout: the carousel
    // renders only after market data loads, which can exceed 10s under
    // full-suite load (observed flake). Same canonical signal as the helpers.
    await expect(page.getByTestId('portfolio-mode-toggle')).toBeVisible({ timeout: 30_000 });

    const slides = page.locator('[role="group"][aria-roledescription="slide"]');
    await expect(slides.first()).toBeVisible();
    const slideCount = await slides.count();
    if (slideCount < 2) {
      test.skip(true, 'Carousel has fewer than two pages');
    }

    // Click the next-page chevron to advance.
    const nextBtn = page.getByRole('button', { name: /next slide/i }).first();
    await nextBtn.click();

    // Wait for the second slide to snap into the viewport by polling its position.
    const second = slides.nth(1);
    await expect.poll(
      async () => {
        const box = await second.boundingBox();
        return box?.x ?? Number.POSITIVE_INFINITY;
      },
      { timeout: 5_000, message: 'carousel second slide to snap into viewport' },
    ).toBeGreaterThanOrEqual(-2);

    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();
    if (!viewport) return;

    // After snapping, the second slide must be horizontally inside the viewport
    // (allow 2px tolerance for sub-pixel transforms). Poll because the snap
    // animation may still be settling at the first measurement.
    await expect.poll(
      async () => {
        const box = await second.boundingBox();
        if (!box) return false;
        return box.x >= -2 && box.x + box.width <= viewport.width + 2;
      },
      { timeout: 5_000, message: 'carousel second slide to settle within viewport' },
    ).toBe(true);
  });

  test('mobile frozen / paused badge uses frozen/paused semantic color tokens', async ({ page }) => {
    await page.goto('/');

    // Ready-wait so the count===0 skip below means "genuinely no frozen/paused
    // reserves", not "data has not loaded yet" under full-suite load.
    await expect(page.getByTestId('portfolio-mode-toggle')).toBeVisible({ timeout: 30_000 });

    const badges = page.locator('[data-testid="mobile-reserve-status-badge"]');
    const total = await badges.count();
    if (total === 0) {
      test.skip(true, 'No frozen/paused reserves visible');
    }

    for (let i = 0; i < total; i += 1) {
      const badge = badges.nth(i);
      const status = await badge.getAttribute('data-status');
      const visual = badge.locator('span').first();
      const cls = (await visual.getAttribute('class')) ?? '';

      if (status === 'paused' || status === 'paused-frozen') {
        expect(cls, `badge ${i} (paused) should use paused token`).toContain('bg-[rgb(var(--ds-paused-rgb))]');
        expect(cls, `badge ${i} (paused) should not use rose token`).not.toContain('bg-rose-500');
      } else {
        expect(cls, `badge ${i} (frozen) should use sky token`).toContain('bg-sky-500');
      }
    }
  });
});
