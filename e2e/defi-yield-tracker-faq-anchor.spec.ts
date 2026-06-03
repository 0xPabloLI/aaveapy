import { test, expect } from '@playwright/test';

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

test.describe('/defi-yield-tracker Related FAQs anchor jump', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'desktop chromium only');

  test('clicking each Related FAQ link scrolls the target into view and updates the hash', async ({ page }) => {
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

      const target = page.locator(`#${slug}`);
      await expect(target).toBeInViewport();
      await expect.poll(() => page.evaluate(() => location.hash)).toBe(`#${slug}`);
    }
  });

  test('loading the page with a FAQ hash scrolls the target into view and focuses it', async ({ page }) => {
    const slug = faqSlug(FAQ_QUESTIONS.debank);
    await page.goto(`/defi-yield-tracker#${slug}`);

    const target = page.locator(`#${slug}`);
    await expect(target).toBeVisible();
    await expect(target).toBeInViewport();

    // The implementation sets tabindex=-1 and focuses the target after ~600ms.
    await expect.poll(
      () => page.evaluate((id) => document.activeElement?.id ?? null, slug),
      { timeout: 5_000 },
    ).toBe(slug);
  });

  test('loading with #faq scrolls to and focuses the FAQ heading', async ({ page }) => {
    await page.goto('/defi-yield-tracker#faq');
    const heading = page.locator('h2#faq');
    await expect(heading).toBeInViewport();
    await expect.poll(
      () => page.evaluate(() => document.activeElement?.id ?? null),
      { timeout: 5_000 },
    ).toBe('faq');
  });
});
