import { afterEach, describe, expect, it, vi } from 'vitest';

import type { TokenPricesIndex } from '@/types/aave';
import {
  __resetForecastTokenPriceBackupCachesForTests,
  resolveForecastTokenPrice,
  resolveForecastTokenPriceWithBackup,
} from './merklTokenPrice';

const tokenPrices: TokenPricesIndex = {
  '1:0xunderlying': {
    chainId: 1,
    address: '0xunderlying',
    symbol: 'USDX',
    price: 0.99,
    updatedAt: 1,
    source: 'opportunity',
  },
  '1:0xatoken': {
    chainId: 1,
    address: '0xatoken',
    symbol: 'aUSDX',
    price: 1.01,
    updatedAt: 1,
    source: 'opportunity',
  },
  '1:0xvtoken': {
    chainId: 1,
    address: '0xvtoken',
    symbol: 'vUSDX',
    price: 1.02,
    updatedAt: 1,
    source: 'opportunity',
  },
};

describe('resolveForecastTokenPrice', () => {
  it('prefers underlying token price when available', () => {
    const price = resolveForecastTokenPrice({
      tokenPrices,
      chainId: 1,
      actionType: 'Supply',
      tokenAddress: '0xUnderlying',
      aTokenAddress: '0xAToken',
      vTokenAddress: '0xVToken',
    });

    expect(price).toBe(0.99);
  });

  it('falls back to aToken for supply when underlying is missing', () => {
    const price = resolveForecastTokenPrice({
      tokenPrices,
      chainId: 1,
      actionType: 'Supply',
      tokenAddress: '0xmissing',
      aTokenAddress: '0xAToken',
      vTokenAddress: '0xVToken',
    });

    expect(price).toBe(1.01);
  });

  it('falls back to vToken for borrow when underlying is missing', () => {
    const price = resolveForecastTokenPrice({
      tokenPrices,
      chainId: 1,
      actionType: 'Borrow',
      tokenAddress: '0xmissing',
      aTokenAddress: '0xAToken',
      vTokenAddress: '0xVToken',
    });

    expect(price).toBe(1.02);
  });

  it('returns undefined when no candidate price exists', () => {
    const price = resolveForecastTokenPrice({
      tokenPrices,
      chainId: 1,
      actionType: 'Hold',
      tokenAddress: '0xmissing',
      aTokenAddress: '0xmissing2',
      vTokenAddress: '0xmissing3',
    });

    expect(price).toBeUndefined();
  });
});

describe('resolveForecastTokenPriceWithBackup', () => {
  afterEach(() => {
    __resetForecastTokenPriceBackupCachesForTests();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns local tokenPrices result without calling backup fetch', async () => {
    const fetchMock = vi.fn();
    const price = await resolveForecastTokenPriceWithBackup(
      {
        tokenPrices,
        chainId: 1,
        actionType: 'Supply',
        tokenAddress: '0xUnderlying',
      },
      fetchMock as unknown as typeof fetch
    );

    expect(price).toBe(0.99);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses hardcoded platform mapping before asset_platforms lookup', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          '0xmissing': {
            usd: 1.2345,
          },
        }),
      });

    const price = await resolveForecastTokenPriceWithBackup(
      {
        tokenPrices,
        chainId: 1,
        actionType: 'Supply',
        tokenAddress: '0xmissing',
      },
      fetchMock as unknown as typeof fetch
    );

    expect(price).toBe(1.2345);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('/simple/token_price/ethereum');
  });

  it('force-refreshes asset_platforms once when chain has no platform mapping', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 'ethereum', chain_identifier: 1 }],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 'ethereum', chain_identifier: 1 }],
      });

    const price = await resolveForecastTokenPriceWithBackup(
      {
        tokenPrices,
        chainId: 999999,
        actionType: 'Supply',
        tokenAddress: '0xmissing',
      },
      fetchMock as unknown as typeof fetch
    );

    expect(price).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain('/asset_platforms');
    expect(fetchMock.mock.calls[1][0]).toContain('/asset_platforms');
  });

  it('refreshes asset_platforms after a miss to recover platform mapping changes', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 'ethereum', chain_identifier: 1 }],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          '0xmissing': {
            usd: 1.1111,
          },
        }),
      });

    const price = await resolveForecastTokenPriceWithBackup(
      {
        tokenPrices,
        chainId: 1,
        actionType: 'Supply',
        tokenAddress: '0xmissing',
      },
      fetchMock as unknown as typeof fetch
    );

    expect(price).toBe(1.1111);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toContain('/simple/token_price/ethereum');
    expect(fetchMock.mock.calls[1][0]).toContain('/asset_platforms');
    expect(fetchMock.mock.calls[2][0]).toContain('/simple/token_price/ethereum');
  });

  it('limits forced asset_platforms refresh to cooldown window after misses', async () => {
    const fetchMock = vi
      .fn()
      // First lookup: miss -> force refresh -> miss
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: 'ethereum', chain_identifier: 1 }] })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      // Second lookup: should only hit token_price once, no force refresh
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    const first = await resolveForecastTokenPriceWithBackup(
      {
        tokenPrices,
        chainId: 1,
        actionType: 'Supply',
        tokenAddress: '0xmiss1',
      },
      fetchMock as unknown as typeof fetch
    );
    const second = await resolveForecastTokenPriceWithBackup(
      {
        tokenPrices,
        chainId: 1,
        actionType: 'Supply',
        tokenAddress: '0xmiss2',
      },
      fetchMock as unknown as typeof fetch
    );

    expect(first).toBeUndefined();
    expect(second).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[1][0]).toContain('/asset_platforms');
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('/asset_platforms'))).toBe(true);
    expect(fetchMock.mock.calls.filter((call) => String(call[0]).includes('/asset_platforms')).length).toBe(1);
  });

  it('uses longer cache ttl for stable tokens', async () => {
    vi.useFakeTimers();

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          '0xstable': {
            usd: 1,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          '0xstable': {
            usd: 1.1,
          },
        }),
      });

    const first = await resolveForecastTokenPriceWithBackup(
      {
        tokenPrices,
        chainId: 1,
        actionType: 'Supply',
        tokenAddress: '0xstable',
        tokenSymbol: 'USDC',
      },
      fetchMock as unknown as typeof fetch
    );
    expect(first).toBe(1);

    vi.advanceTimersByTime(2 * 60 * 1000);

    const second = await resolveForecastTokenPriceWithBackup(
      {
        tokenPrices,
        chainId: 1,
        actionType: 'Supply',
        tokenAddress: '0xstable',
        tokenSymbol: 'USDC',
      },
      fetchMock as unknown as typeof fetch
    );
    expect(second).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('uses shorter cache ttl for volatile tokens', async () => {
    vi.useFakeTimers();

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          '0xvolatile': {
            usd: 2000,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          '0xvolatile': {
            usd: 2100,
          },
        }),
      });

    const first = await resolveForecastTokenPriceWithBackup(
      {
        tokenPrices,
        chainId: 1,
        actionType: 'Supply',
        tokenAddress: '0xvolatile',
        tokenSymbol: 'WETH',
      },
      fetchMock as unknown as typeof fetch
    );
    expect(first).toBe(2000);

    vi.advanceTimersByTime(2 * 60 * 1000);

    const second = await resolveForecastTokenPriceWithBackup(
      {
        tokenPrices,
        chainId: 1,
        actionType: 'Supply',
        tokenAddress: '0xvolatile',
        tokenSymbol: 'WETH',
      },
      fetchMock as unknown as typeof fetch
    );
    expect(second).toBe(2100);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('falls back to underlying symbol price when address-based lookup misses', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 'ethereum', chain_identifier: 1 }],
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tether: {
            usd: 1.001,
          },
        }),
      });

    const price = await resolveForecastTokenPriceWithBackup(
      {
        tokenPrices,
        chainId: 1,
        actionType: 'Supply',
        tokenAddress: '0xmissing',
        tokenSymbol: 'aEthUSDT',
      },
      fetchMock as unknown as typeof fetch
    );

    expect(price).toBe(1.001);
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('/simple/price?ids=tether'))).toBe(true);
  });
});
