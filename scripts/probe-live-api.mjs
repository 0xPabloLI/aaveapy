#!/usr/bin/env node
import { DEFAULT_STAGING_API_BASE } from './lib/default-api-bases.mjs';

/**
 * Probe staging/live API from CI before running apiSchemas.live.test.ts.
 *
 * Exit codes:
 *   0 — /markets returned 200 with JSON-looking body (safe to run schema tests)
 *   1 — Network error, non-OK HTTP, or non-JSON body (fail CI)
 *   2 — Likely Cloudflare challenge (403 + interstitial HTML)
 *
 * Env:
 *   LIVE_TEST_API_BASE — same as apiSchemas.live.helpers (default: staging)
 */
const DEFAULT_BASE = DEFAULT_STAGING_API_BASE;

function isLikelyCloudflareChallenge(snippet) {
  const s = snippet.toLowerCase();
  return (
    s.includes('just a moment') ||
    s.includes('cf-challenge') ||
    s.includes('challenge-platform') ||
    s.includes('cf-mitigated')
  );
}

const base = (process.env.LIVE_TEST_API_BASE || DEFAULT_BASE).replace(/\/$/, '');
const url = `${base}/markets`;

async function main() {
  let res;
  try {
    res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
  } catch (e) {
    console.error('probe-live-api: fetch failed:', e?.message ?? e);
    process.exit(1);
  }

  const text = await res.text();
  const snippet = text.slice(0, 800);

  if (res.status === 403 && isLikelyCloudflareChallenge(snippet)) {
    console.error('probe-live-api: Cloudflare challenge (403), url:', url);
    process.exit(2);
  }

  if (!res.ok) {
    console.error(`probe-live-api: HTTP ${res.status} ${res.statusText}, url:`, url);
    console.error(snippet.slice(0, 300));
    process.exit(1);
  }

  const trimmed = text.trimStart();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    process.exit(0);
  }

  console.error('probe-live-api: expected JSON array/object, got non-JSON body');
  console.error(snippet.slice(0, 300));
  process.exit(1);
}

main();
