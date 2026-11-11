/**
 * Pure helpers for scripts/check-dep-release-age.mjs — parsing the added
 * `node_modules/<pkg>` entries out of a `git diff` of package-lock.json.
 *
 * Kept dependency-free and framework-free so both the script (plain node) and
 * the vitest suite (src/test/depReleaseAge.test.ts) can import it directly.
 */

/**
 * Parse a unified diff of package-lock.json and return every dependency
 * version *added or changed* by the diff.
 *
 * The npm lockfile v3 shape is:
 *     "node_modules/<name>": {
 *         "version": "1.2.3",
 *         ...
 *     },
 * Note: npm hoists transitive dependencies to top-level blocks too, so
 * "directness" cannot be derived from the block path — callers classify via
 * package.json instead.
 *
 * An in-place upgrade keeps the block header as a *context* line and rewrites
 * only the `version`/`resolved`/`integrity` lines, so headers must be tracked
 * from context lines as well — otherwise every version bump of an existing
 * package is silently skipped and the gate only ever sees brand-new packages.
 *
 * @param {string} diffText
 * @returns {{ name: string, version: string }[]}
 */
export function parseAddedLockEntries(diffText) {
  const lines = diffText.split('\n');
  const results = [];
  let currentPackage = null;

  for (const line of lines) {
    // A hunk boundary breaks the block context: a header seen in one hunk must
    // never be attributed to a version line in the next one.
    if (line.startsWith('@@') || line.startsWith('diff --git') || line.startsWith('index ')) {
      currentPackage = null;
      continue;
    }

    // `-` lines belong to the block being replaced — keep tracking across them,
    // but never start tracking from one (a removed header names a package that
    // is going away).
    if (line.startsWith('-')) continue;

    const isAdded = line.startsWith('+');
    if (!isAdded && !line.startsWith(' ')) continue;

    const body = line.slice(1);

    // Block headers are tracked from *context* lines too: when npm upgrades a
    // package in place it rewrites only `version`/`resolved`/`integrity`, so
    // `"node_modules/x": {` stays unchanged and appears as a context line. Only
    // reading added headers missed every version bump of an existing package.
    // The path group must allow the empty string: the lockfile's root entry is
    // `"": {`, and failing to recognise it would leave a stale attribution.
    const headerMatch = body.match(/^\s*"([^"]*)":\s*\{/);
    if (headerMatch) {
      const path = headerMatch[1];
      if (path.includes('node_modules/')) {
        const segments = path.split('node_modules/');
        currentPackage = segments[segments.length - 1];
      } else {
        // Any other object (e.g. the root `"": {` block, `"dependencies"`) is
        // not a package block — drop the stale attribution rather than letting
        // a following `"version"` line inherit it.
        currentPackage = null;
      }
      continue;
    }

    if (!isAdded) continue;

    const versionMatch = body.match(/^\s*"version":\s*"([^"]+)"/);
    if (versionMatch && currentPackage) {
      // Lockfile v3 puts "version" as the first key of the block, so the
      // nearest preceding header is this block's own header.
      results.push({ name: currentPackage, version: versionMatch[1] });
      currentPackage = null;
    }
  }

  return results;
}

/** Dedupe parsed entries by name@version, keeping the first occurrence. */
export function dedupeEntries(entries) {
  const seen = new Set();
  return entries.filter((entry) => {
    const key = `${entry.name}@${entry.version}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Resolve the publish time of a package version from an npm registry
 * `time` map (as returned by `npm view <pkg> time --json`).
 * @param {Record<string, string>} timeMap
 * @param {string} version
 * @returns {Date | null}
 */
export function resolvePublishTime(timeMap, version) {
  // Lockfile versions may carry prerelease/build suffixes that the registry
  // keys slightly differently (e.g. "1.0.0-alpha.1" matches).
  if (timeMap[version]) return new Date(timeMap[version]);
  const normalized = version.split('+')[0];
  if (timeMap[normalized]) return new Date(timeMap[normalized]);
  return null;
}

/**
 * @param {Date} publishTime
 * @param {Date} now
 * @param {number} minAgeDays
 * @returns {boolean}
 */
export function isAtLeastDaysOld(publishTime, now, minAgeDays) {
  const ageMs = now.getTime() - publishTime.getTime();
  return ageMs >= minAgeDays * 24 * 60 * 60 * 1000;
}
