// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchWithTracingMock } = vi.hoisted(() => ({ fetchWithTracingMock: vi.fn() }));

vi.mock('@/lib/requestContext', () => ({
  fetchWithTracing: fetchWithTracingMock,
}));

import { fetchMarkets } from './useAaveMarkets';
import { getCachedMarkets } from '@/lib/cache';
import { SCHEMA_FP } from '@/shared/schema-fingerprint';
import type { MarketsResponse } from '@/types/aave';

const FP_KEY = 'aave-schema-fingerprint';

const respondWith = (schemaFingerprint: string) => {
  const payload = {
    snapshot: { lastUpdated: '2026-11-10T00:00:00.000Z', schemaFingerprint },
    reserves: [],
  } as MarketsResponse;
  fetchWithTracingMock.mockResolvedValue({ ok: true, json: async () => payload });
};

/** `/markets` without `snapshot.schemaFingerprint` — the schema allows omitting it. */
const respondWithoutFingerprint = () => {
  const payload = {
    snapshot: { lastUpdated: '2026-11-10T00:00:00.000Z' },
    reserves: [],
  } as MarketsResponse;
  fetchWithTracingMock.mockResolvedValue({ ok: true, json: async () => payload });
};

describe('fetchMarkets — schema fingerprint drift sync (AAV-1346)', () => {
  beforeEach(() => {
    localStorage.clear();
    fetchWithTracingMock.mockReset();
  });

  it('records the fingerprint the API is serving, even after caching the response', async () => {
    respondWith('driftedFp');
    await fetchMarkets();
    expect(localStorage.getItem(FP_KEY)).toBe('driftedFp:2');
  });

  it('drops entries cached before the API started reporting a different fingerprint', async () => {
    respondWith(SCHEMA_FP);
    await fetchMarkets();
    expect(getCachedMarkets()).not.toBeNull();

    respondWith('driftedFp');
    await fetchMarkets();
    expect(getCachedMarkets()).toBeNull();
  });

  // Regression guard for the pairing between this sync and `setCacheEntry`:
  // dropping the write in setCacheEntry WITHOUT syncing on every response
  // would leave a drifted value in storage forever, keeping the cache cold.
  it('converges a stale drifted fingerprint back to the bundle value', async () => {
    localStorage.setItem(FP_KEY, 'staleDrifted:2');
    respondWith(SCHEMA_FP);
    await fetchMarkets();
    expect(localStorage.getItem(FP_KEY)).toBe(`${SCHEMA_FP}:2`);
    expect(getCachedMarkets()).not.toBeNull();
  });

  it('keeps the cache warm while the API matches the bundle', async () => {
    respondWith(SCHEMA_FP);
    await fetchMarkets();
    expect(localStorage.getItem(FP_KEY)).toBe(`${SCHEMA_FP}:2`);
    expect(getCachedMarkets()).not.toBeNull();
  });

  // `schemaFingerprint` is optional in MarketsResponseSchema, so a valid
  // response may omit it. Leaving a stale stored value in place would then
  // reject every entry this bundle writes — setCacheEntry tags entries with the
  // bundle fingerprint and the secondary check compares them against that stale
  // value — leaving both the cache and the offline fallback permanently cold.
  // With no value from the API, the bundle is the only truth, so the stale
  // reference must go.
  it('clears a stale stored fingerprint when the API omits the field', async () => {
    localStorage.setItem(FP_KEY, 'staleDrifted:2');
    respondWithoutFingerprint();
    await fetchMarkets();
    expect(localStorage.getItem(FP_KEY)).toBeNull();
    expect(getCachedMarkets()).not.toBeNull();
  });

  it('leaves no fingerprint key behind when the API omits it and none was stored', async () => {
    respondWithoutFingerprint();
    await fetchMarkets();
    expect(localStorage.getItem(FP_KEY)).toBeNull();
    expect(getCachedMarkets()).not.toBeNull();
  });

  // Cache bookkeeping must never turn a successful fetch into a failure.
  // Storage throws in Safari private mode / on quota; without the guard the
  // error escapes into fetchMarkets' catch, the fallback cache is equally
  // unavailable, and the valid response is re-thrown away (AAV-1346 review).
  //
  // The global is stubbed rather than spying on `Storage.prototype.setItem`:
  // happy-dom's `localStorage` does not route property reads through
  // `Storage.prototype` (verified: `localStorage.setItem !==
  // Storage.prototype.setItem` before any spy is installed), so a prototype spy
  // never intercepts and the test would pass without exercising anything.
  it('still returns the API payload when storage throws', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('storage blocked');
      },
      removeItem: () => {},
    });
    try {
      respondWith('driftedFp');
      const data = await fetchMarkets();
      expect(data.snapshot?.schemaFingerprint).toBe('driftedFp');
      expect(data.reserves).toEqual([]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
