import { expect, test } from '@playwright/test';

/**
 * Visual regression screenshot tests for SegmentedToggle (vertical & horizontal).
 *
 * Captures the component in-situ within the live dashboard at both desktop and
 * mobile viewports, covering:
 * - Track border-radius (rounded-2xl vertical / rounded-full horizontal)
 * - Indicator border-radius (rounded-xl vertical / rounded-full horizontal)
 * - Segment gap (--ds-seg-gap: 0.125rem)
 * - Active segment styling (bg-card indicator, font-semibold text)
 * - Size variants (default vs chip)
 *
 * Screenshots are saved per-project for manual diff review.
 * Bounding-box assertions guard against layout collapse regressions.
 */

test.describe('SegmentedToggle — visual regression', () => {
  test.describe('vertical orientation (ScenarioControls mobile)', () => {
    test('vertical toggle renders with correct radii and spacing at mobile viewport', async ({ page }, testInfo) => {
      test.skip(!testInfo.project.name.includes('mobile'), 'Mobile-only check');

      await page.goto('/');
      await expect(page.getByRole('radiogroup').first()).toBeVisible({ timeout: 30_000 });

      const verticalToggle = page.locator('[aria-orientation="vertical"]').first();
      await expect(verticalToggle).toBeVisible();

      const trackBox = await verticalToggle.boundingBox();
      expect(trackBox, 'vertical track must have non-zero bounding box').not.toBeNull();
      if (!trackBox) return;

      // Vertical track height > width (stacked segments)
      expect(
        trackBox.height,
        `vertical track height (${trackBox.height}) should exceed width (${trackBox.width})`,
      ).toBeGreaterThan(trackBox.width);

      // Verify segments are stacked (each segment's top > previous segment's bottom)
      const segments = verticalToggle.locator('button[role="radio"]');
      const count = await segments.count();
      expect(count, 'vertical toggle should have at least 2 segments').toBeGreaterThanOrEqual(2);

      const boxes = await Promise.all(
        Array.from({ length: count }, (_, i) => segments.nth(i).boundingBox()),
      );
      for (let i = 1; i < boxes.length; i++) {
        const prev = boxes[i - 1]!;
        const curr = boxes[i]!;
        expect(
          curr.y - (prev.y + prev.height),
          `segment ${i} should be below segment ${i - 1} with small gap`,
        ).toBeGreaterThanOrEqual(0);
        expect(
          curr.y - (prev.y + prev.height),
          `gap between segment ${i - 1} and ${i} should be ≤ 4px (ds-seg-gap)`,
        ).toBeLessThanOrEqual(4);
      }

      // Active segment has font-semibold
      const activeSegment = verticalToggle.locator('button[aria-checked="true"]');
      await expect(activeSegment).toBeVisible();
      const activeFontWeight = await activeSegment.evaluate(
        (el) => getComputedStyle(el).fontWeight,
      );
      expect(
        parseInt(activeFontWeight, 10),
        'active segment font-weight should be ≥ 600 (semibold)',
      ).toBeGreaterThanOrEqual(600);

      // Indicator element (absolute positioned div) exists
      const indicator = verticalToggle.locator('div[aria-hidden]').first();
      await expect(indicator).toBeVisible();
      const indicatorRadius = await indicator.evaluate(
        (el) => getComputedStyle(el).borderRadius,
      );
      expect(
        indicatorRadius,
        'vertical indicator should use rounded-xl (not fully rounded)',
      ).not.toBe('9999px');

      // Screenshot for visual review
      await verticalToggle.screenshot({
        path: testInfo.outputPath('seg-toggle-vertical-mobile.png'),
      });
    });
  });

  test.describe('horizontal orientation (ScenarioControls desktop + AprApyToggle)', () => {
    test('horizontal toggle in ScenarioControls renders at desktop viewport', async ({ page }, testInfo) => {
      test.skip(testInfo.project.name.includes('mobile'), 'Desktop-only check');

      await page.goto('/');
      await expect(page.getByRole('radiogroup').first()).toBeVisible({ timeout: 30_000 });

      const horizontalToggle = page.locator('[aria-orientation="horizontal"]').first();
      await expect(horizontalToggle).toBeVisible();

      const trackBox = await horizontalToggle.boundingBox();
      expect(trackBox, 'horizontal track must have non-zero bounding box').not.toBeNull();
      if (!trackBox) return;

      // Horizontal track width > height (pill shape)
      expect(
        trackBox.width,
        `horizontal track width (${trackBox.width}) should exceed height (${trackBox.height})`,
      ).toBeGreaterThan(trackBox.height);

      // Segments are side by side
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

      // Indicator uses rounded-full (fully round)
      const indicator = horizontalToggle.locator('div[aria-hidden]').first();
      await expect(indicator).toBeVisible();
      const indicatorRadius = await indicator.evaluate(
        (el) => getComputedStyle(el).borderRadius,
      );
      expect(
        indicatorRadius,
        'horizontal indicator should use rounded-full (fully round pill)',
      ).toBe('9999px');

      // Track also uses rounded-full
      const trackRadius = await horizontalToggle.evaluate(
        (el) => getComputedStyle(el).borderRadius,
      );
      expect(
        trackRadius,
        'horizontal track should use rounded-full',
      ).toBe('9999px');

      // Screenshot
      await horizontalToggle.screenshot({
        path: testInfo.outputPath('seg-toggle-horizontal-desktop.png'),
      });
    });

    test('AprApyToggle (chip size) renders at desktop viewport', async ({ page }, testInfo) => {
      test.skip(testInfo.project.name.includes('mobile'), 'Desktop-only check');

      await page.goto('/');
      await expect(page.getByRole('radiogroup').first()).toBeVisible({ timeout: 30_000 });

      // AprApyToggle is a horizontal radiogroup with APR/APY options
      const aprApyGroup = page.locator('[aria-orientation="horizontal"]').filter({
        has: page.locator('button[role="radio"]', { hasText: 'APR' }),
      }).first();
      await expect(aprApyGroup).toBeVisible();

      const trackBox = await aprApyGroup.boundingBox();
      expect(trackBox, 'AprApyToggle track must render').not.toBeNull();
      if (!trackBox) return;

      // Chip size should be shorter than default size
      // Default track-h = 2rem = 32px; chip track uses --ds-chip-h
      expect(
        trackBox.height,
        'chip toggle height should be ≤ 28px (smaller than default 2rem)',
      ).toBeLessThanOrEqual(28);

      // Screenshot
      await aprApyGroup.screenshot({
        path: testInfo.outputPath('seg-toggle-chip-horizontal-desktop.png'),
      });
    });

    test('AprApyToggle (chip size) renders at mobile viewport', async ({ page }, testInfo) => {
      test.skip(!testInfo.project.name.includes('mobile'), 'Mobile-only check');

      await page.goto('/');
      await expect(page.getByRole('radiogroup').first()).toBeVisible({ timeout: 30_000 });

      const aprApyGroup = page.locator('[aria-orientation="horizontal"]').filter({
        has: page.locator('button[role="radio"]', { hasText: 'APR' }),
      }).first();
      await expect(aprApyGroup).toBeVisible();

      const trackBox = await aprApyGroup.boundingBox();
      expect(trackBox, 'AprApyToggle mobile track must render').not.toBeNull();

      await aprApyGroup.screenshot({
        path: testInfo.outputPath('seg-toggle-chip-horizontal-mobile.png'),
      });
    });
  });

  test.describe('active segment indicator positioning', () => {
    test('clicking a segment slides the indicator to the new position (desktop)', async ({ page }, testInfo) => {
      test.skip(testInfo.project.name.includes('mobile'), 'Desktop-only check');

      await page.goto('/');
      await expect(page.getByRole('radiogroup').first()).toBeVisible({ timeout: 30_000 });

      const horizontalToggle = page.locator('[aria-orientation="horizontal"]').first();
      await expect(horizontalToggle).toBeVisible();

      const indicator = horizontalToggle.locator('div[aria-hidden]').first();
      const inactiveSegment = horizontalToggle.locator('button[aria-checked="false"]').first();

      const indicatorBoxBefore = await indicator.boundingBox();
      await inactiveSegment.click();
      // Wait for transition (200ms ease-out + buffer)
      await page.waitForTimeout(350);
      const indicatorBoxAfter = await indicator.boundingBox();

      expect(indicatorBoxBefore, 'indicator must exist before click').not.toBeNull();
      expect(indicatorBoxAfter, 'indicator must exist after click').not.toBeNull();
      if (!indicatorBoxBefore || !indicatorBoxAfter) return;

      // Indicator should have moved
      const moved =
        Math.abs(indicatorBoxAfter.x - indicatorBoxBefore.x) > 1 ||
        Math.abs(indicatorBoxAfter.y - indicatorBoxBefore.y) > 1;
      expect(moved, 'indicator should slide to the newly active segment').toBe(true);

      // Screenshot after switch
      await horizontalToggle.screenshot({
        path: testInfo.outputPath('seg-toggle-horizontal-desktop-after-switch.png'),
      });
    });

    test('clicking a segment slides the indicator vertically (mobile)', async ({ page }, testInfo) => {
      test.skip(!testInfo.project.name.includes('mobile'), 'Mobile-only check');

      await page.goto('/');
      await expect(page.getByRole('radiogroup').first()).toBeVisible({ timeout: 30_000 });

      const verticalToggle = page.locator('[aria-orientation="vertical"]').first();
      await expect(verticalToggle).toBeVisible();

      const indicator = verticalToggle.locator('div[aria-hidden]').first();
      const inactiveSegment = verticalToggle.locator('button[aria-checked="false"]').first();

      const indicatorBoxBefore = await indicator.boundingBox();
      await inactiveSegment.click();
      await page.waitForTimeout(350);
      const indicatorBoxAfter = await indicator.boundingBox();

      expect(indicatorBoxBefore, 'indicator must exist before click').not.toBeNull();
      expect(indicatorBoxAfter, 'indicator must exist after click').not.toBeNull();
      if (!indicatorBoxBefore || !indicatorBoxAfter) return;

      const moved =
        Math.abs(indicatorBoxAfter.y - indicatorBoxBefore.y) > 1 ||
        Math.abs(indicatorBoxAfter.x - indicatorBoxBefore.x) > 1;
      expect(moved, 'indicator should slide vertically to the newly active segment').toBe(true);

      await verticalToggle.screenshot({
        path: testInfo.outputPath('seg-toggle-vertical-mobile-after-switch.png'),
      });
    });
  });
});
