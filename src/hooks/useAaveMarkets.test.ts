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
});
