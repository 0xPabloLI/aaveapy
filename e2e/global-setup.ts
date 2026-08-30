import { chromium, type FullConfig } from '@playwright/test';

/**
 * Prewarm the web server before any worker starts.
 *
 * Root cause this guards against (verified via failure traces, 2026-08-30):
 * with a cold Vite dev server, ~10 parallel browsers each request hundreds of
 * ESM modules at once; individual module requests queued for 8–40s, so the
 * React tree never mounted and pages stalled in the skeleton LoadingState
 * past the 30s app-ready waits — while the /markets API itself had already
 * returned 200 in ~1s. Serializing one full page load per layout before the
 * parallel wave lets Vite finish dep-optimization + transforms once, so all
 * workers then hit a warm cache.
 */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL ?? 'http://127.0.0.1:4173';
  const browser = await chromium.launch();
  try {
    // One visit per layout: desktop table and mobile cards pull in the
    // module graph we want pre-transformed.
    for (const viewport of [
      { width: 1600, height: 1200 },
      { width: 412, height: 915 },
    ]) {
      const page = await browser.newPage({ viewport });
      await page.goto(`${baseURL}/`, { waitUntil: 'domcontentloaded' });
      // App-ready signal (same canonical signal as the test helpers): the
      // toggle renders only after market data loads and the app shell
      // commits, i.e. the critical module graph is fully served.
      await page
        .getByTestId('portfolio-mode-toggle')
        .waitFor({ state: 'visible', timeout: 120_000 });
      await page.close();
    }
  } finally {
    await browser.close();
  }
}
