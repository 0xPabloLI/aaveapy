/**
 * Runtime feature-flag resolution.
 *
 * `features.ts` holds the build-time defaults (single source of truth for
 * what ships). This layer adds override channels so new/rolled-back code can
 * be toggled without a rebuild — the lightweight alternative to a hosted flag
 * platform, with resolution order (lowest → highest):
 *
 *   1. static default        — features.ts
 *   2. build env             — VITE_FLAG_<NAME>=true|false (per-environment
 *                              defaults baked by Vercel/CI, no repo change)
 *   3. localStorage          — persistent per-browser override
 *                              (aaveapy:feature-flags, JSON map)
 *   4. URL query             — ?ff=<name>:1,<name2>:0 (ephemeral, shareable)
 *
 * URL wins so a support/agent URL can force a state for one page view even
 * when a stale localStorage override exists.
 *
 * All parsers are lenient: unknown flags and malformed values are ignored
 * (fall through to the next layer), never throw.
 */
import { features } from '@/config/features';

export type FeatureFlagName = Extract<keyof typeof features, string>;
export type FlagOverrideTable = Partial<Record<FeatureFlagName, boolean>>;

const STORAGE_KEY = 'aaveapy:feature-flags';
const URL_PARAM = 'ff';

/** Lenient boolean parser: 1/true/on/enabled → true; 0/false/off/disabled → false; else null. */
export function parseFlagValue(raw: unknown): boolean | null {
  if (raw == null) return null;
  const v = String(raw).trim().toLowerCase();
  if (['1', 'true', 'on', 'enabled'].includes(v)) return true;
  if (['0', 'false', 'off', 'disabled'].includes(v)) return false;
  return null;
}

function flagsFromEnv(): FlagOverrideTable {
  const env = import.meta.env as Record<string, unknown>;
  const out: FlagOverrideTable = {};
  for (const name of Object.keys(features) as FeatureFlagName[]) {
    const envKey = `VITE_FLAG_${name.toUpperCase()}`;
    const value = parseFlagValue(env[envKey]);
    if (value !== null) out[name] = value;
  }
  return out;
}

function flagsFromSearchParams(search: string): FlagOverrideTable {
  const out: FlagOverrideTable = {};
  const params = new URLSearchParams(search).get(URL_PARAM);
  if (!params) return out;
  for (const pair of params.split(',')) {
    const [rawName, rawValue] = pair.split(':');
    if (!(rawName in features)) continue; // unknown flag — ignore
    const value = parseFlagValue(rawValue);
    if (value !== null) out[rawName as FeatureFlagName] = value;
  }
  return out;
}

function flagsFromStorage(): FlagOverrideTable {
  if (typeof window === 'undefined' || !('localStorage' in window)) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: FlagOverrideTable = {};
    for (const name of Object.keys(features) as FeatureFlagName[]) {
      const value = parseFlagValue(parsed[name]);
      if (value !== null) out[name] = value;
    }
    return out;
  } catch {
    return {}; // malformed JSON — treat as absent
  }
}

let cachedOverrides: FlagOverrideTable | null = null;

/** Layers are re-resolved lazily; the cache invalidates on storage writes. */
function resolveOverrides(): FlagOverrideTable {
  if (cachedOverrides) return cachedOverrides;
  const search = typeof window !== 'undefined' ? window.location.search : '';
  cachedOverrides = {
    ...flagsFromEnv(),
    ...flagsFromStorage(),
    ...flagsFromSearchParams(search),
  };
  return cachedOverrides;
}

/** Test/dev hook — forces re-resolution after URL or storage changes. */
export function resetFlagCacheForTest(): void {
  cachedOverrides = null;
}

/**
 * Final flag value for the current browser context.
 * Unknown flag names throw — flags are code-reviewed artifacts, not data.
 */
export function isFeatureEnabled(name: FeatureFlagName): boolean {
  if (!(name in features)) {
    throw new Error(`Unknown feature flag: ${name}`);
  }
  const override = resolveOverrides()[name];
  return override ?? features[name];
}

/** Persist a per-browser override (dev/staging convenience). */
export function setFlagOverride(name: FeatureFlagName, value: boolean): void {
  if (typeof window === 'undefined' || !('localStorage' in window)) return;
  let current = {};
  try {
    current = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as FlagOverrideTable;
  } catch {
    current = {};
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, [name]: value }));
  resetFlagCacheForTest();
}

/** Remove all per-browser overrides. */
export function clearFlagOverrides(): void {
  if (typeof window === 'undefined' || !('localStorage' in window)) return;
  window.localStorage.removeItem(STORAGE_KEY);
  resetFlagCacheForTest();
}
