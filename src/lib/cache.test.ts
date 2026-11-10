// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearLegacyCacheEntries,
  getCachedMarkets,
  isDeficitWithoutPrice,
  sanitizeDeficitWithoutPrice,
  setCachedMarkets,
  updateSchemaFingerprintFromApi,
} from './cache';
import { SCHEMA_FP } from '@/shared/schema-fingerprint';
import type { MarketsResponse } from '@/types/aave';

class MemoryStorage implements Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  private readonly store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }
}

describe('clearLegacyCacheEntries', () => {
  it('removes deprecated markets list cache without touching active keys', () => {
    const storage = new MemoryStorage();
    storage.setItem('aave-markets-list-cache', '{"legacy":true}');
    storage.setItem('aave-markets-cache', '{"active":true}');

    clearLegacyCacheEntries(storage);

    expect(storage.getItem('aave-markets-list-cache')).toBeNull();
    expect(storage.getItem('aave-markets-cache')).toBe('{"active":true}');
  });
});

describe('isDeficitWithoutPrice', () => {
  it('returns true when deficit exists but tokenPrice is null', () => {
    expect(isDeficitWithoutPrice({ deficit: '1000', tokenPrice: null })).toBe(true);
  });

  it('returns true when deficit exists but tokenPrice is 0', () => {
    expect(isDeficitWithoutPrice({ deficit: '1000', tokenPrice: 0 })).toBe(true);
  });

  it('returns true when deficit exists but tokenPrice is negative', () => {
    expect(isDeficitWithoutPrice({ deficit: '1000', tokenPrice: -1 })).toBe(true);
  });

  it('returns false when deficit exists and tokenPrice is valid', () => {
    expect(isDeficitWithoutPrice({ deficit: '1000', tokenPrice: 1.5 })).toBe(false);
  });

  it('returns false when deficit is zero', () => {
    expect(isDeficitWithoutPrice({ deficit: '0', tokenPrice: null })).toBe(false);
  });

  it('returns false when deficit is empty string', () => {
    expect(isDeficitWithoutPrice({ deficit: '', tokenPrice: null })).toBe(false);
  });
});

describe('sanitizeDeficitWithoutPrice', () => {
  it('clears deficit when tokenPrice is unavailable', () => {
    const data = {
      reserves: [
        { deficit: '1000', tokenPrice: null, decimals: 6 },
        { deficit: '2000', tokenPrice: 1.5, decimals: 6 },
      ],
    } as MarketsResponse;
    sanitizeDeficitWithoutPrice(data);
    expect(data.reserves[0].deficit).toBe('');
    expect(data.reserves[1].deficit).toBe('2000');
  });

  it('handles null reserves gracefully', () => {
    expect(() => sanitizeDeficitWithoutPrice({ reserves: null } as unknown as MarketsResponse)).not.toThrow();
  });

  it('handles missing reserves gracefully', () => {
    expect(() => sanitizeDeficitWithoutPrice({} as MarketsResponse)).not.toThrow();
  });
});

describe('updateSchemaFingerprintFromApi', () => {
  it('updates the lazy schema fingerprint in storage', () => {
    const storage = new MemoryStorage();
    updateSchemaFingerprintFromApi('abc123', storage);
    expect(storage.getItem('aave-schema-fingerprint')).toBe('abc123:2');
  });

  it('overwrites previous fingerprint', () => {
    const storage = new MemoryStorage();
    updateSchemaFingerprintFromApi('old456', storage);
    expect(storage.getItem('aave-schema-fingerprint')).toBe('old456:2');
    updateSchemaFingerprintFromApi('new789', storage);
    expect(storage.getItem('aave-schema-fingerprint')).toBe('new789:2');
  });
});

// ── Schema-fingerprint drift (AAV-1346) ──
// `aave-schema-fingerprint` is the *only* thing that can invalidate entries
// when the backend ships a new schema before the frontend is rebuilt (the
// baked-in SCHEMA_FP cannot see that). It must therefore track the fingerprint
// the API is currently serving — including while cache entries are being
// written, which previously overwrote it with the bundle's own value.
const FP_KEY = 'aave-schema-fingerprint';

const marketsPayload = (schemaFingerprint: string): MarketsResponse =>
  ({
    snapshot: { lastUpdated: '2026-11-10T00:00:00.000Z', schemaFingerprint },
    reserves: [],
  }) as MarketsResponse;

describe('schema fingerprint drift', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('keeps the API fingerprint when a cache entry is written afterwards', () => {
    updateSchemaFingerprintFromApi('driftedFp');
    setCachedMarkets(marketsPayload('driftedFp'));
    expect(localStorage.getItem(FP_KEY)).toBe('driftedFp:2');
  });

  it('serves cache hits while the API fingerprint matches the bundle', () => {
    updateSchemaFingerprintFromApi(SCHEMA_FP);
    setCachedMarkets(marketsPayload(SCHEMA_FP));
    expect(getCachedMarkets()).not.toBeNull();
  });

  it('drops entries cached before the API started reporting a different fingerprint', () => {
    updateSchemaFingerprintFromApi(SCHEMA_FP);
    setCachedMarkets(marketsPayload(SCHEMA_FP));
    expect(getCachedMarkets()).not.toBeNull();

    updateSchemaFingerprintFromApi('driftedFp');
    expect(getCachedMarkets()).toBeNull();
  });

  it('recovers cache hits once the API fingerprint returns to the bundle value', () => {
    updateSchemaFingerprintFromApi('driftedFp');
    setCachedMarkets(marketsPayload('driftedFp'));
    expect(getCachedMarkets()).toBeNull();

    updateSchemaFingerprintFromApi(SCHEMA_FP);
    setCachedMarkets(marketsPayload(SCHEMA_FP));
    expect(getCachedMarkets()).not.toBeNull();
  });
});
