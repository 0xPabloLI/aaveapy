import { describe, expect, it } from 'vitest';

import type { TokenPricesIndex } from '@/types/aave';
import { resolveForecastTokenPrice } from './merklTokenPrice';

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
