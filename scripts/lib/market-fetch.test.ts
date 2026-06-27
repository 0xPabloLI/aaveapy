import { describe, it, expect } from 'vitest';
import { fetchAndValidateMarkets } from './market-fetch.ts';

describe('fetchAndValidateMarkets', () => {
  it('returns rows and snapshot for a valid { snapshot, reserves } response', async () => {
    const validPayload = {
      snapshot: { lastUpdated: '2024-01-01T00:00:00Z' },
      reserves: [
        {
          reserveId: '0x1',
          marketName: 'Test Market',
          chainName: 'ethereum',
          chainId: 1,
          tokenName: 'Test Token',
          tokenSymbol: 'TEST',
          tokenAddress: '0xabc',
        },
      ],
    };

    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () =>
        ({
          ok: true,
          json: async () => validPayload,
        }) as unknown as Response;

      const result = await fetchAndValidateMarkets('https://example.com/markets');

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toMatchObject({ reserveId: '0x1', tokenSymbol: 'TEST' });
      expect(result.snapshot).toMatchObject({ lastUpdated: '2024-01-01T00:00:00Z' });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('rejects legacy { data: [] } payload with validation error', async () => {
    const legacyPayload = { data: [] };

    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () =>
        ({
          ok: true,
          json: async () => legacyPayload,
        }) as unknown as Response;

      await expect(fetchAndValidateMarkets('https://example.com/markets')).rejects.toThrow(
        'Markets schema validation failed'
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});