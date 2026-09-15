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
 * @param {string} diffText
 * @returns {{ name: string, version: string }[]}
 */
export function parseAddedLockEntries(diffText) {
  const lines = diffText.split('\n');
  const results = [];
  let currentPackage = null;
  let currentVersion = null;

  for (const line of lines) {
    // Only added lines can introduce new packages/versions.
    if (!line.startsWith('+')) {
      // A context/removed line between an added package header and its added
      // version line means the block boundary was interrupted — reset.
      if (currentPackage !== null && !line.startsWith(' ')) {
        // `-` lines belong to the changed block: keep tracking.
        if (!line.startsWith('-')) {
          if (currentVersion) results.push({ name: currentPackage, version: currentVersion });
          currentPackage = null;
          currentVersion = null;
        }
      }
      continue;
    }

    const body = line.slice(1);

    const pkgMatch = body.match(/^\s*"(node_modules\/[^"]+)":\s*\{/);
    if (pkgMatch) {
      // Flush the previous added block before starting a new one.
      if (currentPackage && currentVersion) {
        results.push({ name: currentPackage, version: currentVersion });
      }
      const segments = pkgMatch[1].split('node_modules/');
      currentPackage = segments[segments.length - 1];
      currentVersion = null;
      continue;
    }

    const versionMatch = body.match(/^\s*"version":\s*"([^"]+)"/);
    if (versionMatch && currentPackage) {
      currentVersion = versionMatch[1];
      // Lockfile v3 puts "version" as the first key of the block, so flush
      // eagerly; a later "version" line for the same block (rare) overwrites.
      results.push({ name: currentPackage, version: currentVersion });
      currentPackage = null;
      currentVersion = null;
    }
  }

  if (currentPackage && currentVersion) {
    results.push({ name: currentPackage, version: currentVersion });
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
