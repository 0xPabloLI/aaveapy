#!/usr/bin/env node
/**
 * AAV-1320 build gate: verify that every executable inline script in the built
 * index.html is allowed by the Content-Security-Policy `script-src` directive
 * in vercel.json, and that the GA4 script origins are still allowed.
 *
 * Why: the consent default-deny block in index.html is inline and needs a
 * `'sha256-…'` hash in script-src — without it, Chrome blocks the block and
 * gtag.js would run with no default-denied consent state. Inline script sets
 * drift with content edits AND bundler upgrades (the modulepreload polyfill
 * moved inline↔entry-chunk across vite patch releases), so this gate runs at
 * build time where the real artifact is produced.
 *
 * Wired at the end of `npm run build` (covers Vercel, ci:remote, local).
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { checkCsp } from './lib/csp-inline-scripts.mjs';

const repoRoot = join(fileURLToPath(import.meta.url), '..', '..');

/** GA4 delivery origins that must stay allowed (see docs/specs/aav-1320-ga4-csp-inline-scripts.md). */
const REQUIRED_SCRIPT_ORIGINS = ['https://www.googletagmanager.com', 'https://*.google-analytics.com'];

/**
 * @param {{ vercelJsonPath?: string, htmlPath?: string }} paths
 * @returns {{ ok: boolean, violations: string[] }}
 */
export function runCheck({
  vercelJsonPath = join(repoRoot, 'vercel.json'),
  htmlPath = join(repoRoot, 'dist', 'index.html'),
} = {}) {
  const violations = [];

  if (!existsSync(vercelJsonPath)) {
    violations.push(`vercel.json not found at ${vercelJsonPath} — cannot verify CSP.`);
  }
  if (!existsSync(htmlPath)) {
    violations.push(`Built index.html not found at ${htmlPath} — this gate must run AFTER vite build.`);
  }
  if (violations.length > 0) {
    return { ok: false, violations };
  }

  let vercel;
  try {
    vercel = JSON.parse(readFileSync(vercelJsonPath, 'utf8'));
  } catch (err) {
    return { ok: false, violations: [`vercel.json at ${vercelJsonPath} is not valid JSON: ${err.message}`] };
  }
  const cspHeader = vercel.headers
    ?.flatMap((entry) => entry.headers ?? [])
    .find((header) => header.key.toLowerCase() === 'content-security-policy');

  if (!cspHeader) {
    return {
      ok: false,
      violations: ['vercel.json has no Content-Security-Policy header — cannot verify inline script coverage.'],
    };
  }

  const html = readFileSync(htmlPath, 'utf8');
  return checkCsp({ cspValue: cspHeader.value, html, requiredOrigins: REQUIRED_SCRIPT_ORIGINS });
}

function main() {
  // Optional explicit paths: `node scripts/check-csp-inline-scripts.mjs [vercelJsonPath] [htmlPath]`
  const [vercelJsonPath, htmlPath] = process.argv.slice(2);
  const result = runCheck({ vercelJsonPath, htmlPath });
  if (result.ok) {
    console.log('[check-csp] All inline scripts are covered by script-src and GA origins are allowed.');
    return;
  }
  console.error('[check-csp] CSP inline-script gate FAILED:');
  for (const violation of result.violations) {
    console.error(`  - ${violation}`);
  }
  console.error('  If you edited an inline script in index.html (or the bundler started inlining one),');
  console.error('  add the reported sha256 token to the script-src directive in vercel.json.');
  process.exit(1);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main();
}
