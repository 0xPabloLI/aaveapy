import { describe, expect, it } from 'vitest';

import { clearLegacyCacheEntries } from './cache';

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
