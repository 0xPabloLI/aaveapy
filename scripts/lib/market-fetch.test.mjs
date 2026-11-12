import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
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
      globalThis.fetch = async () => ({
        ok: true,
        json: async () => validPayload,
      });

      const result = await fetchAndValidateMarkets('https://example.com/markets');

      assert.equal(result.rows.length, 1);
      assert.partialDeepStrictEqual(result.rows[0], { reserveId: '0x1', tokenSymbol: 'TEST' });
      assert.partialDeepStrictEqual(result.snapshot, { lastUpdated: '2024-01-01T00:00:00Z' });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('rejects legacy { data: [] } payload with validation error', async () => {
    const legacyPayload = { data: [] };

    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () => ({
        ok: true,
        json: async () => legacyPayload,
      });

      await assert.rejects(fetchAndValidateMarkets('https://example.com/markets'), /Markets schema validation failed/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
