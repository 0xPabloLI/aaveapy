import { expect, test } from '@playwright/test';

/**
 * Staging smoke test — API availability checks against staging.aaveapy.com.
 * Run with: npx playwright test e2e/staging-smoke.spec.ts --project=chromium
 *
 * API: https://staging-api.aaveapy.com/api
 *
 * NOTE: Entire suite is skipped in CI because staging-api.aaveapy.com returns
 * 403 from Cloudflare/WAF for CI IPs. API tests also self-skip on 403.
 *
 * Per docs/specs/e2e-suite-boundary-cleanup.md (T4): the UI-navigation smoke
 * tests that hit the live Vercel-auth-gated frontend were removed — they
 * measure deployment health (an uptime concern), not a reproducible app
 * regression, and `networkidle` never settles behind Vercel auth. UI-flow
 * coverage already exists locally in api-fields-verification and friends.
 */

const STAGING_API = 'https://staging-api.aaveapy.com/api';

// Skip entire suite in CI — staging API returns 403 (Cloudflare/WAF)
const stagingDescribe = process.env.CI ? test.describe.skip : test.describe;

stagingDescribe('Staging smoke tests', () => {
  test('API /markets returns valid data', async ({ request }) => {
    const res = await request.get(`${STAGING_API}/markets`);
    // 403 = Cloudflare/WAF blocking CI IP — staging infra issue, not a code bug
    test.skip(res.status() === 403, 'Staging API returned 403 (likely Cloudflare)');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.reserves).toBeDefined();
    expect(Array.isArray(body.reserves)).toBe(true);
    expect(body.reserves.length).toBeGreaterThan(0);
    // Verify a reserve has required fields
    const r = body.reserves[0];
    expect(r.reserveId).toBeDefined();
    expect(r.chainId).toBeDefined();
    expect(r.tokenSymbol).toBeDefined();
  });

  test('API /meta/side-data returns valid data', async ({ request }) => {
    // 403 = Cloudflare/WAF blocking CI IP — staging infra issue, not a code bug
    const res = await request.get(`${STAGING_API}/meta/side-data`);
    if (res.status() === 403) {
      test.skip(true, 'Staging API returned 403 (likely Cloudflare)');
      return;
    }
    expect(res.status()).toBe(200);
    const body = await res.json();
    const keys = Object.keys(body);
    expect(keys.length).toBeGreaterThan(0);
  });
});
