import { describe, expect, it } from 'vitest';

import { clearLegacyCacheEntries, isDeficitWithoutPrice, sanitizeDeficitWithoutPrice, updateSchemaFingerprintFromApi } from './cache';
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
    expect(storage.getItem('aave-schema-fingerprint')).toBe('abc123:1');
  });

  it('overwrites previous fingerprint', () => {
    const storage = new MemoryStorage();
    updateSchemaFingerprintFromApi('old456', storage);
    expect(storage.getItem('aave-schema-fingerprint')).toBe('old456:1');
    updateSchemaFingerprintFromApi('new789', storage);
    expect(storage.getItem('aave-schema-fingerprint')).toBe('new789:1');
  });
});
