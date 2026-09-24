// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearFlagOverrides,
  isFeatureEnabled,
  parseFlagValue,
  resetFlagCacheForTest,
  setFlagOverride,
} from '@/config/featureFlags';
import { features } from '@/config/features';

const FLAG_NAME = Object.keys(features)[0];

function setUrlSearch(search: string): void {
  window.history.replaceState(null, '', search || '/');
}

beforeEach(() => {
  clearFlagOverrides();
  setUrlSearch('/');
  resetFlagCacheForTest();
});

afterEach(() => {
  clearFlagOverrides();
  setUrlSearch('/');
  resetFlagCacheForTest();
});

describe('parseFlagValue', () => {
  it.each([
    ['1', true],
    ['true', true],
    ['on', true],
    ['enabled', true],
    ['0', false],
    ['false', false],
    ['off', false],
    ['disabled', false],
  ])('parses %s → %s', (input, expected) => {
    expect(parseFlagValue(input)).toBe(expected);
  });

  it('returns null for malformed values (lenient fall-through)', () => {
    expect(parseFlagValue('maybe')).toBeNull();
    expect(parseFlagValue(undefined)).toBeNull();
  });
});

describe('isFeatureEnabled', () => {
  it('falls back to the static default with no overrides', () => {
    expect(isFeatureEnabled('snapshot' as never)).toBe(features.snapshot);
  });

  it('rejects unknown flag names loudly', () => {
    expect(() => isFeatureEnabled('not-a-flag' as never)).toThrow('Unknown feature flag');
  });

  it('build env (VITE_FLAG_*) overrides the static default', () => {
    // vitest exposes import.meta.env assignments for test runs.
    (import.meta.env as Record<string, unknown>).VITE_FLAG_SNAPSHOT = 'true';
    resetFlagCacheForTest();
    expect(isFeatureEnabled('snapshot' as never)).toBe(true);
    delete (import.meta.env as Record<string, unknown>).VITE_FLAG_SNAPSHOT;
    resetFlagCacheForTest();
  });

  it('localStorage override beats env; URL beats localStorage', () => {
    (import.meta.env as Record<string, unknown>).VITE_FLAG_SNAPSHOT = 'true';
    resetFlagCacheForTest();
    expect(isFeatureEnabled('snapshot' as never)).toBe(true);

    setFlagOverride('snapshot' as never, false);
    expect(isFeatureEnabled('snapshot' as never)).toBe(false);

    setUrlSearch(`/?ff=${FLAG_NAME}:1`);
    resetFlagCacheForTest();
    expect(isFeatureEnabled('snapshot' as never)).toBe(true);

    delete (import.meta.env as Record<string, unknown>).VITE_FLAG_SNAPSHOT;
  });

  it('ignores unknown flags and malformed values in the ff= param', () => {
    setUrlSearch('/?ff=bogus:1,snapshot:banana,snapshot:0');
    resetFlagCacheForTest();
    expect(isFeatureEnabled('snapshot' as never)).toBe(false);
  });

  it('ignores malformed localStorage JSON', () => {
    window.localStorage.setItem('aaveapy:feature-flags', '{not json');
    resetFlagCacheForTest();
    expect(isFeatureEnabled('snapshot' as never)).toBe(features.snapshot);
  });
});
