import { expect, test, type Locator } from '@playwright/test';

/**
 * Visual regression screenshot tests for SegmentedToggle (vertical & horizontal).
 *
 * Uses `toHaveScreenshot()` for automatic pixel-diff snapshot comparison.
 * Captures the component in-situ within the live dashboard at both desktop and
 * mobile viewports, covering:
 * - Track border-radius (rounded-2xl vertical / rounded-full horizontal)
 * - Indicator border-radius (rounded-xl vertical / rounded-full horizontal)
 * - Segment gap (--ds-seg-gap: 0.125rem)
 * - Active segment styling (bg-card indicator, font-semibold text)
 * - Size variants (default vs chip)
 *
 * Bounding-box assertions guard against layout collapse regressions.
 * Screenshot baselines are platform-specific (darwin/linux). CI runs on Linux
 * but baselines were generated on macOS, so `toHaveScreenshot()` is skipped in
 * CI. Run `npx playwright test --update-snapshots` locally to regenerate.
 */

/**
 * Skip `toHaveScreenshot()` in CI — baselines are macOS-specific and
 * Playwright reports "no baseline" as a FAILURE (not a pass) on first run.
 * Run `npx playwright test --update-snapshots` locally to generate baselines.
 */
async function expectScreenshot(locator: Locator, _label: string) {
  if (process.env.CI) return; // Skip screenshot comparison in CI
  await expect(locator).toHaveScreenshot(undefined, { maxDiffPixelRatio: 0.01 });
}

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

      expect(
        trackBox.height,
        `vertical track height (${trackBox.height}) should exceed width (${trackBox.width})`,
      ).toBeGreaterThan(trackBox.width);

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

      const activeSegment = verticalToggle.locator('button[aria-checked="true"]');
      await expect(activeSegment).toBeVisible();
      const activeFontWeight = await activeSegment.evaluate(
        (el) => getComputedStyle(el).fontWeight,
      );
      expect(
        parseInt(activeFontWeight, 10),
        'active segment font-weight should be ≥ 600 (semibold)',
      ).toBeGreaterThanOrEqual(600);

      const indicator = verticalToggle.locator('div[aria-hidden]').first();
      await expect(indicator).toBeVisible();
      const indicatorRadius = await indicator.evaluate(
        (el) => getComputedStyle(el).borderRadius,
      );
      expect(
        indicatorRadius,
        'vertical indicator should use rounded-xl (not fully rounded)',
      ).not.toBe('9999px');

      await expectScreenshot(verticalToggle, 'vertical toggle');
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

      await expectScreenshot(horizontalToggle, 'horizontal toggle desktop');
    });

    test('AprApyToggle (chip size) renders at desktop viewport', async ({ page }, testInfo) => {
      test.skip(testInfo.project.name.includes('mobile'), 'Desktop-only check');

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

      await expectScreenshot(aprApyGroup, 'AprApyToggle desktop');
    });

    test('AprApyToggle (chip size) renders at mobile viewport', async ({ page }, testInfo) => {
      test.skip(!testInfo.project.name.includes('mobile'), 'Mobile-only check');

      await page.goto('/');
      await expect(page.getByRole('radiogroup').first()).toBeVisible({ timeout: 30_000 });

      const aprApyGroup = page.locator('[aria-orientation="horizontal"]').filter({
        has: page.locator('button[role="radio"]', { hasText: 'APR' }),
      });
      const aprApyCount = await aprApyGroup.count();
      const aprApy = aprApyCount > 1 ? aprApyGroup.nth(1) : aprApyGroup.first();
      await aprApy.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await expect(aprApy).toBeVisible();

      const trackBox = await aprApy.boundingBox();
      expect(trackBox, 'AprApyToggle mobile track must render').not.toBeNull();

      await expectScreenshot(aprApy, 'AprApyToggle mobile');
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
      // Wait for indicator to slide to new position.
      await expect.poll(
        async () => {
          const box = await indicator.boundingBox();
          if (!box || !indicatorBoxBefore) return 0;
          return Math.abs(box.x - indicatorBoxBefore.x);
        },
        { timeout: 3_000, message: 'indicator to slide after click' },
      ).toBeGreaterThan(1);
      const indicatorBoxAfter = await indicator.boundingBox();

      expect(indicatorBoxBefore, 'indicator must exist before click').not.toBeNull();
      expect(indicatorBoxAfter, 'indicator must exist after click').not.toBeNull();
      if (!indicatorBoxBefore || !indicatorBoxAfter) return;

      const moved =
        Math.abs(indicatorBoxAfter.x - indicatorBoxBefore.x) > 1 ||
        Math.abs(indicatorBoxAfter.y - indicatorBoxBefore.y) > 1;
      expect(moved, 'indicator should slide to the newly active segment').toBe(true);

      await expectScreenshot(horizontalToggle, 'indicator desktop');
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
      // Wait for indicator to slide vertically to new position.
      await expect.poll(
        async () => {
          const box = await indicator.boundingBox();
          if (!box || !indicatorBoxBefore) return 0;
          return Math.abs(box.y - indicatorBoxBefore.y);
        },
        { timeout: 3_000, message: 'indicator to slide vertically after click' },
      ).toBeGreaterThan(1);
      const indicatorBoxAfter = await indicator.boundingBox();

      expect(indicatorBoxBefore, 'indicator must exist before click').not.toBeNull();
      expect(indicatorBoxAfter, 'indicator must exist after click').not.toBeNull();
      if (!indicatorBoxBefore || !indicatorBoxAfter) return;

      const moved =
        Math.abs(indicatorBoxAfter.y - indicatorBoxBefore.y) > 1 ||
        Math.abs(indicatorBoxAfter.x - indicatorBoxBefore.x) > 1;
      expect(moved, 'indicator should slide vertically to the newly active segment').toBe(true);

      await expectScreenshot(verticalToggle, 'indicator mobile');
    });
  });
});
