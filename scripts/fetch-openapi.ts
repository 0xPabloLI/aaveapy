/**
 * Fetch the canonical OpenAPI spec from the backend API.
 *
 * Replaces the Zod-based generation. The backend is the source of truth
 * for the API contract; the frontend spec is a mirror.
 *
 * Usage:
 *   npm run openapi:fetch          # fetch from production
 *   LIVE_API_BASE=https://staging-api.aaveapy.com/api npm run openapi:fetch
 *
 * CI check (detects backend drift):
 *   npm run openapi:check
 *   (fetches spec + diffs against committed openapi.json; exits 1 on drift)
 *
 * Retry behaviour:
 *   Transient failures (HTTP 403, 429, 5xx) are retried with exponential
 *   backoff (3 attempts: 2s → 4s → 8s).  This handles Cloudflare WAF
 *   rate-limiting and Railway cold-start hiccups without manual re-runs.
 *   Non-retryable errors (404, 400) fail immediately.
 */

import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const API_BASE = process.env.LIVE_API_BASE || 'https://api.aaveapy.com/api';
const SPEC_URL = `${API_BASE}/docs/openapi.json`;
const OUTPUT_FILE = resolve(__dirname, '..', 'public', 'openapi.json');

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 2000;

/** HTTP status codes that are worth retrying (transient failures). */
function isRetryable(status: number): boolean {
  return (
    status === 403 || // Cloudflare WAF / rate-limit (often transient for CI IPs)
    status === 429 || // Too Many Requests
    (status >= 500 && status <= 599) // Server errors
  );
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(
  url: string,
  maxRetries: number,
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const backoff = INITIAL_BACKOFF_MS * 2 ** (attempt - 1);
      console.log(`  Retry ${attempt}/${maxRetries} after ${backoff}ms...`);
      await sleep(backoff);
    }

    try {
      const res = await fetch(url);

      if (res.ok) {
        if (attempt > 0) {
          console.log(`  ✅ Succeeded on attempt ${attempt + 1}`);
        }
        return res;
      }

      if (isRetryable(res.status) && attempt < maxRetries) {
        console.warn(
          `  ⚠️ HTTP ${res.status}: ${res.statusText} (attempt ${attempt + 1}/${maxRetries + 1})`,
        );
        lastError = new Error(`HTTP ${res.status}: ${res.statusText}`);
        continue;
      }

      // Non-retryable or out of retries — return the response so the caller
      // can produce a precise error message.
      return res;
    } catch (err) {
      // Network error (DNS, connection refused, timeout, etc.)
      if (attempt < maxRetries) {
        console.warn(
          `  ⚠️ Network error (attempt ${attempt + 1}/${maxRetries + 1}): ${err instanceof Error ? err.message : String(err)}`,
        );
        lastError = err instanceof Error ? err : new Error(String(err));
        continue;
      }
      throw err;
    }
  }

  // Should not reach here, but satisfy the type checker.
  throw lastError ?? new Error('fetchWithRetry exhausted retries');
}

async function main() {
  console.log(`Fetching OpenAPI spec from ${SPEC_URL}...`);
  const res = await fetchWithRetry(SPEC_URL, MAX_RETRIES);
  if (!res.ok) {
    console.error(`HTTP ${res.status}: ${res.statusText}`);
    if (res.status === 403) {
      console.error(
        'Hint: 403 usually means Cloudflare WAF blocked the request.\n' +
          '  In CI, this happens when LIVE_TEST_API_BASE_CI secret is unavailable\n' +
          '  (e.g. Dependabot PRs).  The openapi-check job should be skipped for\n' +
          '  such PRs — see ci.yml openapi-check.if condition.',
      );
    }
    process.exit(1);
  }

  const json = await res.json();

  // Validate it looks like an OpenAPI spec
  if (!json.openapi || !json.paths || !json.components) {
    console.error('Response does not look like an OpenAPI 3.x spec');
    process.exit(1);
  }

  writeFileSync(OUTPUT_FILE, JSON.stringify(json, null, 2) + '\n', 'utf-8');
  console.log(`Wrote OpenAPI ${json.openapi} spec to ${OUTPUT_FILE}`);
  console.log(`  Endpoints: ${Object.keys(json.paths).join(', ')}`);
  console.log(`  Schemas: ${Object.keys(json.components.schemas).join(', ')}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
