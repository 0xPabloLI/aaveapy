import { expect, test } from '@playwright/test';

/**
 * Geometry guard for the PortfolioPanel header toggle across Single and
 * Portfolio modes.
 *
 * Previously this spec asserted a pixel screenshot of the toggle's `xpath=../..`
 * ancestor. That ancestor is fragile: a header DOM refactor changed which
 * element it resolved to (the captured box collapsed from ~235px to ~33px with
 * no functional regression — pure selector drift), and the macOS-only baselines
 * are skipped in CI, so the test could neither catch real regressions nor be
 * trusted. See docs/specs/e2e-suite-boundary-cleanup.md (T3, S8).
 *
 * We now guard the toggle itself via `data-testid="portfolio-mode-toggle"`
 * (stable, not subject to ancestor nesting), asserting it renders in BOTH modes
 * with a sane, non-collapsed box that stays within the viewport. The test runs
 * in both the `chromium` and `mobile-chromium` Playwright projects, so we use
 * each project's native viewport rather than calling `setViewportSize`, which
 * can leave the dev-mode page in a skeleton state.
 */

test('Portfolio header toggle renders in both modes', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/', { waitUntil: 'load' });

  // Guard the toggle itself (stable testid, not an ancestor box that drifts
  // with header DOM refactors). Assert it renders in BOTH modes, is
  // non-collapsed, and its center stays inside the viewport — the regression
  // class we care about is the toggle disappearing / collapsing / overflowing.
  const assertToggle = async (label: string) => {
    const toggle = page.getByTestId('portfolio-mode-toggle');
    await expect(toggle, `${label}: toggle must be visible`).toBeVisible({ timeout: 30_000 });

    const box = await toggle.boundingBox();
    expect(box, `${label}: toggle must have a non-zero box`).not.toBeNull();
    if (!box) return;

    expect(box.width, `${label}: toggle must not be collapsed (width)`).toBeGreaterThan(8);
    expect(box.height, `${label}: toggle must not be collapsed (height)`).toBeGreaterThan(8);

    // Horizontal overflow would be a real regression (toggle pushed off-screen
    // sideways). We intentionally do NOT assert the toggle's vertical position
    // is within the viewport: on mobile it lives in a sticky bottom action bar,
    // whose center sits near the viewport bottom by design — not a collapse.
    const viewport = page.viewportSize();
    expect(viewport, `${label}: viewport size must be known`).not.toBeNull();
    if (!viewport) return;

    const cx = box.x + box.width / 2;
    expect(cx, `${label}: toggle center must be horizontally within the viewport`).toBeGreaterThanOrEqual(0);
    expect(cx, `${label}: toggle center must be horizontally within the viewport`).toBeLessThanOrEqual(viewport.width);
  };

  // Single (default) mode.
  await assertToggle('single-mode');

  // Switch to Portfolio mode and re-assert the toggle stays intact.
  await page.getByTestId('portfolio-mode-toggle').click();
  await assertToggle('portfolio-mode');
});
