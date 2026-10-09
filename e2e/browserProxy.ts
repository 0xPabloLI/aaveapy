/**
 * Single source of truth for the browser proxy used by e2e runs.
 *
 * Why this exists: `E2E_PROXY` used to be read only inside `playwright.config.ts`
 * and spread into `use`, which covers the browsers Playwright launches *for
 * tests* — but `e2e/global-setup.ts` prewarm launches its own browser, and that
 * one silently kept talking to the staging API over direct egress. On a machine
 * whose direct path crawls (measured 2026-10-07: `/markets` returned 200 with
 * 1.6s TTFB but took 82–150s to transfer 413KB, while the local mixed port did
 * it in 4.2s), the prewarm timed out waiting for `portfolio-mode-toggle` and
 * aborted the whole run before a single test started — so `E2E_PROXY=...`
 * appeared to have no effect at all.
 *
 * Both call sites now take their arguments from here, so a config drift between
 * "the browser that tests use" and "the browser that warms the server" cannot
 * come back. Behaviour contract rows: `src/test/browserProxy.test.ts`.
 */

/** Env var that opts an e2e run into proxy egress for Chromium. */
export const E2E_PROXY_ENV = 'E2E_PROXY';

/**
 * Launch/use arguments that route Chromium through `E2E_PROXY`, or none.
 *
 * Loopback is never proxied by Chromium, so the local dev/preview server stays
 * direct regardless of this setting.
 *
 * @param {Record<string, string|undefined>} [env]
 * @returns {{proxy?: {server: string}}}
 */
export function browserProxyArgs(env = process.env) {
  const server = (env[E2E_PROXY_ENV] ?? '').trim();
  return server ? { proxy: { server } } : {};
}
