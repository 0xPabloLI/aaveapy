import { expect, test } from '@playwright/test';

/**
 * Visual regression screenshot tests for SegmentedToggle — Desktop.
 *
 * Uses `toHaveScreenshot()` for automatic pixel-diff snapshot comparison.
 * Captures the component in-situ within the live dashboard at desktop viewport.
 *
 * Desktop-only — routed via `*.desktop.spec.ts` glob in playwright.config.ts.
 */

test.describe('SegmentedToggle — visual regression', () => {
  test.describe('horizontal orientation (ScenarioControls desktop + AprApyToggle)', () => {
    test('horizontal toggle in ScenarioControls renders at desktop viewport', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('radiogroup').first()).toBeVisible({ timeout: 30_000 });

      const horizontalToggle = page.locator('[aria-orientation="horizontal"]').first();
      await expect(horizontalToggle).toBeVisible();

      const trackBox = await horizontalToggle.boundingBox();
      expect(trackBox, 'horizontal track must have non-zero bounding box').not.toBeNull();
      if (!trackBox) return;

      expect(
        trackBox.width,
        `horizontal track width (${trackBox.width}) should exceed height (${trackBox.height})`,
      ).toBeGreaterThan(trackBox.height);

      const segments = horizontalToggle.locator('button[role="radio"]');
      const count = await segments.count();
      expect(count, 'horizontal toggle should have at least 2 segments').toBeGreaterThanOrEqual(2);

      const boxes = await Promise.all(
        Array.from({ length: count }, (_, i) => segments.nth(i).boundingBox()),
      );
      for (let i = 1; i < boxes.length; i++) {
        const prev = boxes[i - 1]!;
        const curr = boxes[i]!;
        expect(
          curr.x - (prev.x + prev.width),
          `horizontal gap between segment ${i - 1} and ${i} should be ≥ 0`,
        ).toBeGreaterThanOrEqual(0);
        expect(
          curr.x - (prev.x + prev.width),
          `horizontal gap between segment ${i - 1} and ${i} should be ≤ 4px`,
        ).toBeLessThanOrEqual(4);
      }

      const indicator = horizontalToggle.locator('div[aria-hidden]').first();
      await expect(indicator).toBeVisible();
      const indicatorRadius = await indicator.evaluate(
        (el) => getComputedStyle(el).borderRadius,
      );
      expect(
        indicatorRadius,
        'horizontal indicator should use rounded-full (fully round pill)',
      ).toBe('9999px');

      const trackRadius = await horizontalToggle.evaluate(
        (el) => getComputedStyle(el).borderRadius,
      );
      expect(
        trackRadius,
        'horizontal track should use rounded-full',
      ).toBe('9999px');

      await expect(horizontalToggle).toHaveScreenshot();
    });

    test('AprApyToggle (chip size) renders at desktop viewport', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('radiogroup').first()).toBeVisible({ timeout: 30_000 });

      const aprApyGroup = page.locator('[aria-orientation="horizontal"]').filter({
        has: page.locator('button[role="radio"]', { hasText: 'APR' }),
      }).first();
      await expect(aprApyGroup).toBeVisible();

      const trackBox = await aprApyGroup.boundingBox();
      expect(trackBox, 'AprApyToggle track must render').not.toBeNull();
      if (!trackBox) return;

      expect(
        trackBox.height,
        'chip toggle height should be ≤ 28px (smaller than default 2rem)',
      ).toBeLessThanOrEqual(28);

      await expect(aprApyGroup).toHaveScreenshot();
    });
  });

  test.describe('active segment indicator positioning', () => {
    test('clicking a segment slides the indicator to the new position (desktop)', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('radiogroup').first()).toBeVisible({ timeout: 30_000 });

      const horizontalToggle = page.locator('[aria-orientation="horizontal"]').first();
      await expect(horizontalToggle).toBeVisible();

      const indicator = horizontalToggle.locator('div[aria-hidden]').first();
      const inactiveSegment = horizontalToggle.locator('button[aria-checked="false"]').first();

      const indicatorBoxBefore = await indicator.boundingBox();
      await inactiveSegment.click();
      await page.waitForTimeout(350);
      const indicatorBoxAfter = await indicator.boundingBox();

      expect(indicatorBoxBefore, 'indicator must exist before click').not.toBeNull();
      expect(indicatorBoxAfter, 'indicator must exist after click').not.toBeNull();
      if (!indicatorBoxBefore || !indicatorBoxAfter) return;

      const moved =
        Math.abs(indicatorBoxAfter.x - indicatorBoxBefore.x) > 1 ||
        Math.abs(indicatorBoxAfter.y - indicatorBoxBefore.y) > 1;
      expect(moved, 'indicator should slide to the newly active segment').toBe(true);

      await expect(horizontalToggle).toHaveScreenshot();
    });
  });
});
