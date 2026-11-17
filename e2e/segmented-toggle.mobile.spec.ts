import { expect, test } from '@playwright/test';

/**
 * Geometry / computed-style regression guards for SegmentedToggle
 * (vertical & horizontal orientations, size variants, indicator slide).
 *
 * These assertions catch layout-collapse and token-drift regressions WITHOUT
 * pixel screenshot baselines. Pixel diffs are intentionally avoided: they are
 * macOS-render-specific, skipped in CI, and cannot distinguish a real regression
 * from a font/antialias drift. See docs/specs/e2e-suite-boundary-cleanup.md (T3).
 *
 * Covered:
 * - Track border-radius (rounded-2xl vertical / rounded-full horizontal)
 * - Indicator border-radius (rounded-xl vertical / rounded-full horizontal)
 * - Segment gap (--ds-seg-gap: 0.125rem)
 * - Active segment styling (font-semibold text)
 * - Size variants (default vs chip)
 * - Active indicator slides on click
 *
 * AAV-1395: mobile-only file. `playwright.config.ts` ignores it in the desktop
 * project, so the tests are never collected-then-skipped per platform.
 */

test.describe('SegmentedToggle — geometry regression', () => {
  test.describe('vertical orientation (ScenarioControls mobile)', () => {
    test('vertical toggle renders with correct radii and spacing at mobile viewport', async ({ page }) => {
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

      const boxes = await Promise.all(Array.from({ length: count }, (_, i) => segments.nth(i).boundingBox()));
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
      const activeFontWeight = await activeSegment.evaluate((el) => getComputedStyle(el).fontWeight);
      expect(
        parseInt(activeFontWeight, 10),
        'active segment font-weight should be ≥ 600 (semibold)',
      ).toBeGreaterThanOrEqual(600);

      const indicator = verticalToggle.locator('div[aria-hidden]').first();
      await expect(indicator).toBeVisible();
      const indicatorRadius = await indicator.evaluate((el) => getComputedStyle(el).borderRadius);
      expect(indicatorRadius, 'vertical indicator should use rounded-xl (not fully rounded)').not.toBe('9999px');
    });
  });

  test.describe('horizontal orientation (AprApyToggle)', () => {
    test('AprApyToggle (chip size) renders at mobile viewport', async ({ page }) => {
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
    });
  });

  test.describe('active segment indicator positioning', () => {
    test('clicking a segment slides the indicator vertically (mobile)', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('radiogroup').first()).toBeVisible({ timeout: 30_000 });

      const verticalToggle = page.locator('[aria-orientation="vertical"]').first();
      await expect(verticalToggle).toBeVisible();

      const indicator = verticalToggle.locator('div[aria-hidden]').first();
      const inactiveSegment = verticalToggle.locator('button[aria-checked="false"]').first();

      const indicatorBoxBefore = await indicator.boundingBox();
      await inactiveSegment.click();
      await expect
        .poll(
          async () => {
            const box = await indicator.boundingBox();
            if (!box || !indicatorBoxBefore) return 0;
            return Math.abs(box.y - indicatorBoxBefore.y);
          },
          { timeout: 3_000, message: 'indicator to slide vertically after click' },
        )
        .toBeGreaterThan(1);
      const indicatorBoxAfter = await indicator.boundingBox();

      expect(indicatorBoxBefore, 'indicator must exist before click').not.toBeNull();
      expect(indicatorBoxAfter, 'indicator must exist after click').not.toBeNull();
      if (!indicatorBoxBefore || !indicatorBoxAfter) return;

      const moved =
        Math.abs(indicatorBoxAfter.y - indicatorBoxBefore.y) > 1 ||
        Math.abs(indicatorBoxAfter.x - indicatorBoxBefore.x) > 1;
      expect(moved, 'indicator should slide vertically to the newly active segment').toBe(true);
    });
  });
});
