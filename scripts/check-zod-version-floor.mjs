#!/usr/bin/env node
/**
 * zod floor guard (AAV-1367).
 *
 * `GHSA-mrhx-c7xc-m3w5` / `CVE-2023-54404` declares every zod version below
 * 4.6.6 vulnerable (there is no 3.x backport), so the repository keeps a single
 * tree-wide floor through `overrides.zod`. This guard reads `package-lock.json`
 * — the committed artefact, not `node_modules` — and fails when:
 *
 *   1. any resolved `node_modules/…/zod` entry is below the floor, or
 *   2. a package declares a zod range that cannot reach the floor and is not on
 *      the exact allowlist below, or
 *   3. an allowlist entry no longer has a declarer in the tree (stale entry).
 *
 * (2) is the point of the allowlist: the root override can force zod 4 into any
 * package, but a *new* wallet SDK that only speaks zod 3 must be a deliberate
 * decision, not something the override silently absorbs.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const ZOD_FLOOR = '4.6.6';

/**
 * Packages allowed to *declare* a zod-3 range while the tree still installs
 * zod 4 for them. Keep this list exactly as long as the evidence supports.
 */
export const KNOWN_ZOD3_DECLARERS = [
  {
    name: '@reown/appkit-wallet',
    reason:
      'WalletConnect provider 的嵌入式钱包帧。W3mFrameSchema 是树内唯一用 zod 校验 postMessage 的消费者，且当前不进产物（未启用 embedded wallet）。上游 2.0.0 仍精确钉 zod 3.22.4，见 AAV-1348。',
  },
  {
    name: '@coinbase/cdp-sdk',
    reason:
      'Base Account connector 的 API 客户端，只校验 Coinbase 自家 API 响应；当前不进产物（未启用该 connector）。上游 1.62.0 仍声明 ^3.25.76。',
  },
  {
    name: '@zodios/core',
    reason:
      'generated api schemas 的运行时消费者（进主包）。仓库既有 `overrides["@zodios/core"].zod = "$zod"` 早已把它跑在 zod 4 上并经单测/构建验证；peer ^3.x 只是上游声明滞后。',
  },
  {
    name: 'openapi-zod-client',
    reason:
      'devDependency，只用于 schema codegen；dist 无运行时 zod 引用，产物由根 zod 4 消费。上游 1.18.3 仍声明 ^3.19.1。',
  },
];

function parseVersion(value) {
  const raw = String(value ?? '')
    .trim()
    .replace(/^v/, '');
  const [core, prerelease = ''] = raw.split('-');
  const numbers = core.split('+')[0].split('.');
  return {
    parts: [0, 1, 2].map((index) => {
      const parsed = Number.parseInt(numbers[index] ?? '0', 10);
      return Number.isFinite(parsed) ? parsed : 0;
    }),
    prerelease,
  };
}

/** Compare two semver-ish strings; build metadata ignored, prerelease sorts below release. */
export function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  for (let index = 0; index < 3; index += 1) {
    if (a.parts[index] !== b.parts[index]) {
      return a.parts[index] > b.parts[index] ? 1 : -1;
    }
  }
  if (a.prerelease === b.prerelease) return 0;
  if (!a.prerelease) return 1;
  if (!b.prerelease) return -1;
  return a.prerelease > b.prerelease ? 1 : -1;
}

const UNBOUNDED = null;

function caretUpperBound(parts) {
  const [major, minor, patch] = parts;
  if (major > 0) return [major + 1, 0, 0];
  if (minor > 0) return [0, minor + 1, 0];
  return [0, 0, patch + 1];
}

function partialUpperBound(parts, isTilde, precision) {
  const [major, minor, patch] = parts;
  if (isTilde) return [major, minor + 1, 0];
  if (precision === 1) return [major + 1, 0, 0];
  if (precision === 2) return [major, minor + 1, 0];
  return [major, minor, patch + 1];
}

/** One comparator token → an interval; `null` bound means unbounded on that side. */
function intervalForToken(token) {
  let raw = String(token ?? '').trim();
  if (!raw || raw === '*' || raw === 'x' || raw === 'X' || raw === 'latest') {
    return { lower: UNBOUNDED, upper: UNBOUNDED };
  }

  let operator = '';
  for (const candidate of ['>=', '<=', '>', '<', '=', '^', '~']) {
    if (raw.startsWith(candidate)) {
      operator = candidate;
      raw = raw.slice(candidate.length).trim();
      break;
    }
  }
  if (!raw || !/^[0-9]+(\.[0-9]+)*$/.test(raw)) return null;

  const precision = raw.split('.').length;
  const parts = parseVersion(raw).parts;

  switch (operator) {
    case '^':
      return { lower: { parts, inclusive: true }, upper: { parts: caretUpperBound(parts), inclusive: false } };
    case '~':
      return {
        lower: { parts, inclusive: true },
        upper: { parts: partialUpperBound(parts, true, precision), inclusive: false },
      };
    case '>=':
      return { lower: { parts, inclusive: true }, upper: UNBOUNDED };
    case '>':
      return { lower: { parts, inclusive: false }, upper: UNBOUNDED };
    case '<':
      return { lower: UNBOUNDED, upper: { parts, inclusive: false } };
    case '<=':
      return { lower: UNBOUNDED, upper: { parts, inclusive: true } };
    case '=':
      return { lower: { parts, inclusive: true }, upper: { parts, inclusive: true } };
    default:
      if (precision === 3) {
        return { lower: { parts, inclusive: true }, upper: { parts, inclusive: true } };
      }
      return {
        lower: { parts, inclusive: true },
        upper: { parts: partialUpperBound(parts, false, precision), inclusive: false },
      };
  }
}

function intersectIntervals(intervals) {
  let lower = UNBOUNDED;
  let upper = UNBOUNDED;
  for (const interval of intervals) {
    if (!interval) return null;
    if (interval.lower) {
      if (
        lower === UNBOUNDED ||
        compareVersions(interval.lower.parts.join('.'), lower.parts.join('.')) > 0 ||
        (compareVersions(interval.lower.parts.join('.'), lower.parts.join('.')) === 0 && !interval.lower.inclusive)
      ) {
        lower = interval.lower;
      }
    }
    if (interval.upper) {
      if (
        upper === UNBOUNDED ||
        compareVersions(interval.upper.parts.join('.'), upper.parts.join('.')) < 0 ||
        (compareVersions(interval.upper.parts.join('.'), upper.parts.join('.')) === 0 && !interval.upper.inclusive)
      ) {
        upper = interval.upper;
      }
    }
  }
  return { lower, upper };
}

/**
 * Could this declared range install a version at or above `target`?
 *
 * This is the question the guard needs: `4.6.7` and `>=4.7` are safe even
 * though they do not contain `4.6.6` itself; `^3.22.4` is not.
 * Unrecognised ranges fail closed.
 */
export function rangeAllowsAtOrAbove(range, target) {
  const raw = String(range ?? '').trim();
  if (!raw) return true;
  if (raw.includes('||')) {
    return raw.split('||').some((part) => rangeAllowsAtOrAbove(part, target));
  }
  const hyphen = raw.match(/^([0-9][^\s]*)\s-\s([0-9][^\s]*)$/);
  if (hyphen) {
    return rangeAllowsAtOrAbove(`>=${hyphen[1]} <=${hyphen[2]}`, target);
  }
  const tokens = raw.split(/\s+/).filter(Boolean);
  const intervals = tokens.map((token) => intervalForToken(token));
  if (intervals.some((interval) => interval === null)) return false;

  const { lower, upper } = intersectIntervals(intervals);

  // Empty interval (lower > upper, or a single point excluded on either side).
  if (lower && upper) {
    const lowerVsUpper = compareVersions(lower.parts.join('.'), upper.parts.join('.'));
    if (lowerVsUpper > 0) return false;
    if (lowerVsUpper === 0 && !(lower.inclusive && upper.inclusive)) return false;
  }

  // No upper bound: any bound below infinity still admits versions at or above
  // the floor, so the range is safe.
  if (!upper) return true;

  const upperVsTarget = compareVersions(upper.parts.join('.'), target);
  if (upperVsTarget < 0) return false;
  if (upperVsTarget === 0 && !upper.inclusive) return false;
  return true;
}

function packageNameFromPath(packagePath) {
  const marker = 'node_modules/';
  const index = packagePath.lastIndexOf(marker);
  if (index === -1) return packagePath;
  return packagePath.slice(index + marker.length);
}

const DECLARATION_FIELDS = ['dependencies', 'optionalDependencies', 'peerDependencies'];

/**
 * @returns {{ belowFloor: Array<{path: string, version: string}>,
 *             undeclared: Array<{name: string, path: string, range: string, field: string}>,
 *             staleAllowlist: string[] }}
 */
export function evaluateLockfile(lockfile, options = {}) {
  const floor = options.floor ?? ZOD_FLOOR;
  const allowlist = options.allowlist ?? KNOWN_ZOD3_DECLARERS;
  const packages = lockfile?.packages;

  // Fail closed: a lockfile without a `packages` map (v1 format, truncated file)
  // would otherwise look clean because there is nothing to iterate.
  if (!packages || typeof packages !== 'object') {
    return { belowFloor: [], undeclared: [], staleAllowlist: [], unreadable: true };
  }

  const belowFloor = [];
  const declarers = new Map();

  for (const [packagePath, entry] of Object.entries(packages)) {
    if (!entry) continue;
    const name = packageNameFromPath(packagePath);
    if (name === 'zod' && entry.version) {
      if (compareVersions(entry.version, floor) < 0) {
        belowFloor.push({ path: packagePath, version: entry.version });
      }
      continue;
    }
    if (packagePath === '') continue;
    const zodPeerIsOptional = entry.peerDependenciesMeta?.zod?.optional === true;
    for (const field of DECLARATION_FIELDS) {
      if (field === 'peerDependencies' && zodPeerIsOptional) continue;
      const range = entry[field]?.zod;
      if (!range || rangeAllowsAtOrAbove(range, floor)) continue;
      if (!declarers.has(name)) {
        declarers.set(name, { name, path: packagePath, range, field });
      }
    }
  }

  const allowNames = new Set(allowlist.map((entry) => entry.name));
  const undeclared = [...declarers.values()].filter((declarer) => !allowNames.has(declarer.name));
  const present = new Set(declarers.keys());
  const staleAllowlist = allowlist.map((entry) => entry.name).filter((name) => !present.has(name));

  return { belowFloor, undeclared, staleAllowlist };
}

export function formatReport(result) {
  const lines = [];
  if (result.unreadable) {
    lines.push('package-lock.json has no `packages` map (lockfileVersion >= 2 required) — cannot verify the zod floor');
    return lines.join('\n');
  }
  if (result.belowFloor.length > 0) {
    lines.push(`installed zod below ${ZOD_FLOOR}:`);
    for (const entry of result.belowFloor) {
      lines.push(`  - ${entry.path} (${entry.version})`);
    }
  }
  if (result.undeclared.length > 0) {
    lines.push(`unregistered zod-3 declarer(s) — add to KNOWN_ZOD3_DECLARERS with evidence, or upgrade:`);
    for (const entry of result.undeclared) {
      lines.push(`  - ${entry.name} @ ${entry.path} (${entry.field}.zod = ${entry.range})`);
    }
  }
  if (result.staleAllowlist.length > 0) {
    lines.push(`stale allowlist entry/entries (no declarer left in the tree):`);
    for (const name of result.staleAllowlist) {
      lines.push(`  - ${name}`);
    }
  }
  return lines.join('\n');
}

function main(argv) {
  const lockPath = path.resolve(process.cwd(), argv[2] ?? 'package-lock.json');
  const lockfile = JSON.parse(readFileSync(lockPath, 'utf8'));
  const result = evaluateLockfile(lockfile);
  const report = formatReport(result);

  if (report) {
    console.error(`❌ [zod-floor] ${path.basename(lockPath)} violates the zod safety floor`);
    console.error(report);
    return 1;
  }

  const copies = Object.entries(lockfile.packages ?? {}).filter(
    ([packagePath, entry]) => packageNameFromPath(packagePath) === 'zod' && entry?.version,
  );
  console.log(
    `✅ [zod-floor] ${copies.length} zod copy/copies, all >= ${ZOD_FLOOR}: ${copies
      .map(([packagePath, entry]) => `${packagePath}@${entry.version}`)
      .join(', ')}`,
  );
  return 0;
}

const isDirectRun = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isDirectRun) {
  process.exitCode = main(process.argv);
}
