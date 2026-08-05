import { test, expect, type Page } from '@playwright/test';

// faqSlug must match the implementation in src/pages/DefiYieldTracker.tsx
function faqSlug(q: string) {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .substring(0, 64);
}

const FAQ_QUESTIONS = {
  debank: 'Aave APY vs DeBank: which should I use?',
  zerion: 'Aave APY vs Zerion: what is the difference?',
  noWallet: 'Is there a DeFi portfolio tracker that does not need a wallet connection?',
} as const;

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

// scroll-mt-24 = 6rem = 96px. Allow extra slack for sticky header height
// variations across viewports and sub-pixel rounding.
const MAX_TOP_OFFSET_PX = 200;

async function assertTargetWellPositioned(page: Page, slug: string) {
  const target = page.locator(`#${slug}`);
  await expect(target).toBeInViewport();
  const box = await target.boundingBox();
  expect(box, `bounding box for #${slug}`).not.toBeNull();
  // Target top should be at or below the viewport top (not clipped above 0)
  // and not pushed too far down — i.e. the scroll-mt offset is respected.
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeLessThanOrEqual(MAX_TOP_OFFSET_PX);
}

test.describe('/defi-yield-tracker Related FAQs anchor jump', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'chromium only');

  for (const vp of VIEWPORTS) {
    test.describe(`${vp.name} (${vp.width}x${vp.height})`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      test('clicking each Related FAQ link scrolls the target into view with correct offset', async ({ page }) => {
        await page.goto('/defi-yield-tracker');
        await expect(page.getByRole('heading', { level: 1, name: /DeFi Yield Tracker for Aave/i })).toBeVisible();

        for (const [label, question] of [
          ['Aave APY vs DeBank', FAQ_QUESTIONS.debank],
          ['Aave APY vs Zerion', FAQ_QUESTIONS.zerion],
          ['No-wallet portfolio tracker', FAQ_QUESTIONS.noWallet],
        ] as const) {
          const slug = faqSlug(question);
          // Reset scroll & hash so each iteration is independent.
          await page.evaluate(() => {
            history.replaceState(null, '', location.pathname);
            window.scrollTo(0, 0);
          });

          const link = page.getByRole('link', { name: label, exact: true });
          await expect(link).toHaveAttribute('href', `#${slug}`);
          await link.click();

          // Wait for smooth scroll to settle.
          await page.waitForTimeout(1500);

          await assertTargetWellPositioned(page, slug);
          await expect.poll(() => page.evaluate(() => location.hash)).toBe(`#${slug}`);
        }
      });

      test('loading the page with a FAQ hash scrolls the target into view and focuses it', async ({ page }) => {
        const slug = faqSlug(FAQ_QUESTIONS.debank);
        await page.goto(`/defi-yield-tracker#${slug}`);

        const target = page.locator(`#${slug}`);
        await expect(target).toBeVisible();
        // Wait for the hash-effect's smooth scroll + focus timeout (~600ms).
        await page.waitForTimeout(1500);
        await assertTargetWellPositioned(page, slug);

        await expect.poll(
          () => page.evaluate((id) => document.activeElement?.id ?? null, slug),
          { timeout: 5_000 },
        ).toBe(slug);
      });

      test('loading with #faq scrolls to and focuses the FAQ heading', async ({ page }) => {
        await page.goto('/defi-yield-tracker#faq');
        const heading = page.locator('h2#faq');
        await page.waitForTimeout(1500);
        await assertTargetWellPositioned(page, 'faq');
        await expect.poll(
          () => page.evaluate(() => document.activeElement?.id ?? null),
          { timeout: 5_000 },
        ).toBe('faq');
        // Sanity check the element type at this id is the FAQ heading.
        await expect(heading).toBeVisible();
      });
    });
  }
});
