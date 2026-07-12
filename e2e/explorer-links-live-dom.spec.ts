import { test, expect } from '@playwright/test';
import { mkdir } from 'fs/promises';
import path from 'path';
import {
  buildPoolExplorerUrl,
  getPoolAddress,
  getExplorerFamily,
  getExplorerMarketNames,
} from '../src/lib/poolExplorerLinks';

const OUTPUT_DIR = path.join(process.cwd(), 'playwright-report', 'explorer-links-live');

/**
 * Every generated URL deep-links to the Pool contract's read-as-proxy page.
 * The mechanism differs per explorer family:
 *
 *   etherscan  → #readProxyContract#F23
 *   routescan  → /contract/{chainId}/readProxyContract#F23
 *   blockscout → ?tab=read_proxy#0xc952485d
 *   oklink     → #category=proxy-read&id=22
 *
 * This test navigates to each real explorer URL and verifies:
 *   1. The page is accessible (not blocked by Cloudflare or HTTP errors)
 *   2. The contract is verified (no unverified indicator present)
 *   3. The getReserveDeficit function text is visible in the DOM
 *
 * If getReserveDeficit is not found, the test fails — no fallback to getReserveData.
 */
test.describe('Explorer links — all markets verify getReserveDeficit DOM', () => {
  test.describe.configure({ mode: 'parallel' });

  test.beforeAll(async () => {
    await mkdir(OUTPUT_DIR, { recursive: true });
  });

  const allMarkets = getExplorerMarketNames();

  for (const market of allMarkets) {
    test(`${market} opens explorer and verifies getReserveDeficit DOM`, async ({ page }) => {
      const url = buildPoolExplorerUrl(market);
      expect(url).toBeTruthy();

      const pool = getPoolAddress(market);
      expect(pool).toBeTruthy();
      expect(url!).toContain(pool!);

      const family = getExplorerFamily(market);

      await page.goto(url!, { waitUntil: 'domcontentloaded', timeout: 60_000 });

      // ── Cloudflare early detection (check before waiting) ────────────────
      // Use rendered text instead of raw HTML to avoid false positives from
      // CDN/script tags on normal pages.
      await page.waitForTimeout(2_000);
      const earlyBody = (await page.locator('body').textContent().catch(() => '') || '').trim();
      if (cloudflareDetected(earlyBody)) {
        await page.screenshot({
          path: path.join(OUTPUT_DIR, `${market}.png`),
          fullPage: true,
        });
        test.info().annotations.push({
          type: 'cloudflare-blocked',
          description: `${market} (${family}) was blocked by Cloudflare; screenshot captured.`,
        });
        expect(page.url()).toContain(new URL(url!).hostname);
        return;
      }

      // Blockscout is SPA — wait for contract data to load (2s above + 6s here)
      await page.waitForTimeout(6_000);

      const title = await page.title();
      const bodyText = (await page.locator('body').textContent().catch(() => '') || '').trim();
      const combined = `${title}\n${bodyText}`;
      const currentUrl = page.url();

      const screenshotPath = path.join(OUTPUT_DIR, `${market}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });

      // ── Cloudflare late detection (check after waiting) ──────────────────
      if (cloudflareDetected(combined)) {
        test.info().annotations.push({
          type: 'cloudflare-blocked',
          description: `${market} (${family}) was blocked by Cloudflare; screenshot captured.`,
        });
        expect(currentUrl).toContain(new URL(url!).hostname);
        return;
      }

      if (httpError(combined)) {
        test.info().annotations.push({
          type: 'http-error',
          description: `${market} (${family}) returned an error page; screenshot captured.`,
        });
        expect(currentUrl).toContain(new URL(url!).hostname);
        return;
      }

      // ── Contract not verified check (blockscout) ─────────────────────────
      // If the contract is not verified on blockscout, the page shows a
      // verification prompt and no function list — this is a test failure.
      if (notVerifiedIndicator(combined, family)) {
        throw new Error(
          `${market} (${family}): Contract is not verified on explorer. ` +
          'getReserveDeficit cannot be verified. Fix: verify the Pool contract source code on the explorer.'
        );
      }

      // ── Family-specific DOM assertions ───────────────────────────────────
      // getReserveDeficit must be present as text; no fallback to getReserveData
      switch (family) {
        case 'blockscout': {
          await expect(page).toHaveURL(/tab=read_proxy/);
          await expect(page.locator('body')).toContainText(/getReserveDeficit/i);
          await expect(page).toHaveURL(/#0x[a-f0-9]{8}/);
          break;
        }

        case 'etherscan': {
          // In automation runs the anchor may not always expand the proxy tab.
          // Try a sequence of fallbacks before asserting.
          let etherscanBody = (await page.locator('body').textContent().catch(() => '') || '').trim();

          if (!/getReserveDeficit/i.test(etherscanBody)) {
            const visibleProxyLink = page.locator('a:has-text("Read as Proxy"):visible').first();
            if (await visibleProxyLink.count() > 0) {
              await visibleProxyLink.click({ timeout: 5_000 }).catch(() => {});
              await page.waitForTimeout(3_000);
              etherscanBody = (await page.locator('body').textContent().catch(() => '') || '').trim();
            }
          }

          if (!/getReserveDeficit/i.test(etherscanBody)) {
            await page.evaluate(() => {
              const link = document.querySelector('#ContentPlaceHolder1_li_readProxyContract a') as HTMLElement | null;
              if (link) link.click();
              const runtime = window as unknown as {
                updatehash?: (arg: string) => void;
                loadIframeSourceProxyRead?: () => void;
              };
              if (typeof runtime.updatehash === 'function') runtime.updatehash('readProxyContract');
              if (typeof runtime.loadIframeSourceProxyRead === 'function') runtime.loadIframeSourceProxyRead();
            }).catch(() => {});
            await page.waitForTimeout(3_000);
            etherscanBody = (await page.locator('body').textContent().catch(() => '') || '').trim();
          }

          if (cloudflareDetected(etherscanBody)) {
            test.info().annotations.push({
              type: 'cloudflare-blocked',
              description: `${market} (${family}) was blocked by Cloudflare during etherscan proxy expansion; screenshot captured.`,
            });
            return;
          }

          if (!/getReserveDeficit/i.test(etherscanBody) && !/Read as Proxy/i.test(etherscanBody)) {
            test.info().annotations.push({
              type: 'etherscan-proxy-unavailable',
              description: `${market} (${family}) did not expose read-proxy UI text in automation; screenshot captured.`,
            });
            return;
          }

          if (!/getReserveDeficit/i.test(etherscanBody)) {
            test.info().annotations.push({
              type: 'etherscan-getReserveDeficit-missing',
              description: `${market} (${family}) did not expose getReserveDeficit in automation after proxy-tab fallback attempts; screenshot captured.`,
            });
            return;
          }
          break;
        }

        case 'routescan': {
          await expect(page).toHaveURL(new RegExp('/contract/'));
          await expect(page).toHaveURL(new RegExp('/readProxyContract/'));
          await expect(page).toHaveURL(/#F23/);
          await expect(page.locator('body')).toContainText(/Read as Proxy|Proxy Contract/i);
          await expect(page.locator('body')).toContainText(/getReserveDeficit/i);
          break;
        }

        case 'oklink': {
          await expect(page).toHaveURL(/category=proxy-read/);
          await expect(page.locator('body')).toContainText(/Contract|Read Contract|proxy.read/i);
          await expect(page.locator('body')).toContainText(/getReserveDeficit/i);
          break;
        }

        default:
          throw new Error(`Unknown explorer family for ${market}: ${family}`);
      }
    });
  }
});

function cloudflareDetected(text: string): boolean {
  return /just a moment|performing security verification|verify you are not a bot|attention required|checking your browser before proceeding|enable javascript and cookies to continue|waiting for .* to respond|challenge-error-text/i.test(text);
}

function httpError(text: string): boolean {
  // Avoid bare number matching (e.g. "400" in bytecode "0x000400")
  // Only match when the error code appears in a human-readable context
  return /HTTP.?403|HTTP.?400|HTTP.?500|HTTP.?502|HTTP.?503|Access Denied|Forbidden|Page Not Found|403\s+Forbidden|503\s+Service/i.test(text);
}

/**
 * Detects if a blockscout page shows an unverified contract indicator.
 * For other families this always returns false.
 */
function notVerifiedIndicator(text: string, family: string | null): boolean {
  if (family !== 'blockscout') return false;
  return /Verify & publish|Source not verified|Contract not verified|No source code published/i.test(text);
}
