#!/usr/bin/env node
/**
 * Minimum dependency release-age gate (supply-chain mitigation).
 *
 * Policy: dependency versions adopted by this repo must have been published at
 * least MIN_RELEASE_AGE_DAYS (default 7) days ago, so a freshly published
 * compromised/buggy release cannot land here on day zero. Complements
 * osv-scanner (known CVEs) and Socket Firewall (behavioural analysis) which
 * already run in CI / pre-push.
 *
 * Runs on PRs that change package-lock.json:
 *   1. diff the lockfile against the PR base
 *   2. collect added/changed `node_modules/<pkg>` versions
 *   3. query the npm registry for each version's publish time
 *   4. fail when any adopted version is younger than the configured age
 *
 * Configuration:
 *   --staged               — check STAGED changes vs HEAD (pre-commit mode);
 *                            default diffs BASE_REF...HEAD (CI PR mode)
 *   MIN_RELEASE_AGE_DAYS   — minimum age in days (default 7; 0 disables)
 *   BASE_REF               — git ref to diff against (CI sets this to the PR base)
 *
 * Usage:
 *   BASE_REF=origin/main node scripts/check-dep-release-age.mjs            (CI)
 *   node scripts/check-dep-release-age.mjs --staged                        (pre-commit)
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  parseAddedLockEntries,
  dedupeEntries,
  resolvePublishTime,
  isAtLeastDaysOld,
} from './lib/dep-release-age-parse.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const STAGED = process.argv.includes('--staged');
const BASE_REF = process.env.BASE_REF || 'origin/main';
const MIN_AGE_DAYS = Number(process.env.MIN_RELEASE_AGE_DAYS ?? 7);

if (!Number.isFinite(MIN_AGE_DAYS) || MIN_AGE_DAYS <= 0) {
  console.log(`MIN_RELEASE_AGE_DAYS=${MIN_AGE_DAYS} — release-age gate disabled.`);
  process.exit(0);
}

// ── Diff the lockfile (staged changes, or BASE...HEAD in CI) ──
let diffText;
const gitArgs = STAGED
  ? ['diff', '--cached', '--unified=2', '--', 'package-lock.json']
  : ['diff', '--unified=2', `${BASE_REF}...HEAD`, '--', 'package-lock.json'];
try {
  diffText = execFileSync('git', gitArgs, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
} catch (err) {
  // Unknown base ref (shallow checkout, force-push): fail open with a loud note
  // — the scheduled full-install jobs remain the safety net.
  console.warn(`::warning::Cannot diff lockfile (${err.message.split('\n')[0]}). Skipping release-age gate.`);
  process.exit(0);
}

if (diffText.trim() === '') {
  console.log('No package-lock.json changes against base — release-age gate satisfied trivially.');
  process.exit(0);
}

// ── Parse added entries; dedupe; classify direct vs transitive via package.json ──
// npm hoists transitive deps to top-level lockfile blocks, so the diff path
// cannot tell directness — the manifest is the source of truth. Direct
// dependencies are adopted decisions (block when fresh); transitive ones ride
// on direct choices and are covered by osv-scanner + Socket Firewall (warn).
const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));
const directNames = new Set([
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.optionalDependencies ?? {}),
  ...Object.keys(pkg.devDependencies ?? {}),
]);

const allEntries = dedupeEntries(parseAddedLockEntries(diffText));

if (allEntries.length === 0) {
  console.log('Lockfile changed but no dependency versions added — gate satisfied.');
  process.exit(0);
}

const directEntries = allEntries.filter((e) => directNames.has(e.name));
const transitiveEntries = allEntries.filter((e) => !directNames.has(e.name));
console.log(
  `Checking ${allEntries.length} adopted version(s) ` +
    `(${directEntries.length} direct, ${transitiveEntries.length} transitive) for minimum release age of ${MIN_AGE_DAYS} day(s)…`,
);

// ── Query the npm registry for publish times ──
const now = new Date();
const tooFreshDirect = [];
const tooFreshTransitive = [];
const registryErrors = [];

for (const { name, version } of allEntries) {
  let timeMap;
  try {
    const out = execFileSync('npm', ['view', `${name}@${version}`, 'time', '--json'], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      timeout: 60_000,
    });
    const parsed = JSON.parse(out);
    // `npm view <pkg>@<version> time` returns either the full time map or a
    // single-entry object depending on npm version — normalize.
    timeMap = typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    registryErrors.push(`${name}@${version}`);
    continue;
  }

  const publishTime = resolvePublishTime(timeMap, version);
  if (!publishTime) {
    // Unknown publish time (private registry quirk): fail open but flag it.
    console.warn(`::warning::Could not resolve publish time for ${name}@${version} — skipping.`);
    continue;
  }

  if (!isAtLeastDaysOld(publishTime, now, MIN_AGE_DAYS)) {
    (directNames.has(name) ? tooFreshDirect : tooFreshTransitive).push({
      name,
      version,
      publishTime: publishTime.toISOString(),
    });
  }
}

if (registryErrors.length > 0) {
  console.warn(
    `::warning::npm registry lookup failed for ${registryErrors.length} package(s): ${registryErrors.join(', ')}`,
  );
}

if (tooFreshTransitive.length > 0) {
  // Transitive versions ride on direct adoption decisions and are covered by
  // osv-scanner + Socket Firewall — surface them, don't block.
  console.warn(`⚠️ Transitive dependencies adopted below the age window (informational):`);
  for (const { name, version, publishTime } of tooFreshTransitive) {
    console.warn(`   ${name}@${version} — published ${publishTime}`);
  }
}

if (tooFreshDirect.length > 0) {
  console.error(`\n❌ Dependency release-age gate BLOCKED — direct dependencies younger than ${MIN_AGE_DAYS} day(s):`);
  for (const { name, version, publishTime } of tooFreshDirect) {
    console.error(`   ${name}@${version} — published ${publishTime}`);
  }
  console.error('\nOptions:');
  console.error(`  - Wait ${MIN_AGE_DAYS} day(s) and re-run (preferred: let the supply-chain window close)`);
  console.error('  - Pin the previous known-good version');
  console.error(`  - Override deliberately for this PR: MIN_RELEASE_AGE_DAYS=0 in the workflow dispatch,`);
  console.error('    documented in the PR description (root cause: why day-zero adoption is required).');
  process.exit(1);
}

console.log(`✅ All direct dependency versions are at least ${MIN_AGE_DAYS} day(s) old.`);
