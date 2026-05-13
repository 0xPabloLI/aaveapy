import { describe, expect, it } from 'vitest';

import { convertUsdToInputValue, getDisplayAvailableLiquidityUsd, getDisplayTotalBorrowedUsd, getReserveAvailableLiquidityUsd, getReserveTotalBorrowedUsd, getScenarioSupplySizeUsd, nativeToUsd, getSuppliableUsd, getBorrowableUsd } from './scenarioSize';

describe('nativeToUsd', () => {
  it('converts raw token units to USD', () => {
    expect(nativeToUsd('1000000000000000000', 18, 2500)).toBe(2500);
  });

  it('returns null when raw is missing', () => {
    expect(nativeToUsd(null, 18, 1)).toBeNull();
    expect(nativeToUsd(undefined, 18, 1)).toBeNull();
  });

  it('defaults decimals to 18 when missing, returns null when negative', () => {
    expect(nativeToUsd('1', null, 1)).toBe(1e-18);
    expect(nativeToUsd('1', -1, 1)).toBeNull();
  });

  it('returns null when tokenPrice is missing or non-positive', () => {
    expect(nativeToUsd('1', 18, null)).toBeNull();
    expect(nativeToUsd('1', 18, 0)).toBeNull();
    expect(nativeToUsd('1', 18, -1)).toBeNull();
  });
});

describe('getScenarioSupplySizeUsd', () => {
  it('keeps current size when reserve is already above cap', () => {
    expect(
      getScenarioSupplySizeUsd({
        reserveSizeUsd: 8660,
        supplyCapUsd: 1,
        rawSupplyInput: '1',
        inputMode: 'usd',
        tokenPrice: 1,
      }),
    ).toBe(8660);
  });

  it('caps growth at supply cap when reserve is below cap', () => {
    expect(
      getScenarioSupplySizeUsd({
        reserveSizeUsd: 100,
        supplyCapUsd: 120,
        rawSupplyInput: '50',
        inputMode: 'usd',
        tokenPrice: 1,
      }),
    ).toBe(120);
  });
});

describe('convertUsdToInputValue', () => {
  it('returns USD string in usd mode', () => {
    expect(convertUsdToInputValue(1000, 'usd', 2500)).toBe('1000');
  });

  it('converts to token amount in token mode', () => {
    expect(convertUsdToInputValue(5000, 'token', 2500)).toBe('2');
  });

  it('returns empty string when usd is zero', () => {
    expect(convertUsdToInputValue(0, 'usd', 2500)).toBe('');
  });

  it('returns empty string when usd is negative', () => {
    expect(convertUsdToInputValue(-100, 'token', 2500)).toBe('');
  });

  it('falls back to USD string when tokenPrice is null in token mode', () => {
    expect(convertUsdToInputValue(1000, 'token', null)).toBe('1000');
  });

  it('falls back to USD string when tokenPrice is zero in token mode', () => {
    expect(convertUsdToInputValue(1000, 'token', 0)).toBe('1000');
  });
});

describe('getReserveAvailableLiquidityUsd', () => {
  it('computes USD liquidity from on-chain raw liquidity', () => {
    // AaveV4Forex USDT real numbers: 76,610,908,377 raw / 10^6 * 1.0002 ≈ $76,626.23
    expect(
      getReserveAvailableLiquidityUsd({
        liquidity: '76610908377',
        decimals: 6,
        tokenPrice: 1.0002,
      }),
    ).toBeCloseTo(76626.23, 2);
  });

  it('handles 18-decimal tokens', () => {
    expect(
      getReserveAvailableLiquidityUsd({
        liquidity: '1000000000000000000', // 1 token
        decimals: 18,
        tokenPrice: 2500,
      }),
    ).toBe(2500);
  });

  it('returns null when liquidity is missing', () => {
    expect(getReserveAvailableLiquidityUsd({ decimals: 6, tokenPrice: 1 })).toBeNull();
    expect(getReserveAvailableLiquidityUsd({ liquidity: '', decimals: 6, tokenPrice: 1 })).toBeNull();
  });

  it('defaults decimals to 18 when missing, returns null when negative', () => {
    expect(getReserveAvailableLiquidityUsd({ liquidity: '1', tokenPrice: 1 })).toBe(1e-18);
    expect(getReserveAvailableLiquidityUsd({ liquidity: '1', decimals: -1, tokenPrice: 1 })).toBeNull();
  });

  it('returns null when tokenPrice is missing or non-positive', () => {
    expect(getReserveAvailableLiquidityUsd({ liquidity: '1', decimals: 6 })).toBeNull();
    expect(getReserveAvailableLiquidityUsd({ liquidity: '1', decimals: 6, tokenPrice: 0 })).toBeNull();
    expect(getReserveAvailableLiquidityUsd({ liquidity: '1', decimals: 6, tokenPrice: -1 })).toBeNull();
  });

  it('returns null when liquidity is not numeric', () => {
    expect(
      getReserveAvailableLiquidityUsd({ liquidity: 'not-a-number', decimals: 6, tokenPrice: 1 }),
    ).toBeNull();
  });
});

describe('getReserveTotalBorrowedUsd', () => {
  it('computes USD borrowed from on-chain raw borrowed', () => {
    // AaveV4Bluechip USDT real numbers: 1,037,279,054,299 raw / 10^6 * 1.0002 ≈ $1,037,486.51
    expect(
      getReserveTotalBorrowedUsd({
        borrowed: '1037279054299',
        decimals: 6,
        tokenPrice: 1.0002,
      }),
    ).toBeCloseTo(1037486.51, 2);
  });

  it('handles 18-decimal tokens', () => {
    expect(
      getReserveTotalBorrowedUsd({
        borrowed: '5000000000000000000', // 5 tokens
        decimals: 18,
        tokenPrice: 2500,
      }),
    ).toBe(12500);
  });

  it('returns null when borrowed is missing', () => {
    expect(getReserveTotalBorrowedUsd({ decimals: 6, tokenPrice: 1 })).toBeNull();
    expect(getReserveTotalBorrowedUsd({ borrowed: '', decimals: 6, tokenPrice: 1 })).toBeNull();
  });

  it('defaults decimals to 18 when missing, returns null when negative', () => {
    expect(getReserveTotalBorrowedUsd({ borrowed: '1', tokenPrice: 1 })).toBe(1e-18);
    expect(getReserveTotalBorrowedUsd({ borrowed: '1', decimals: -1, tokenPrice: 1 })).toBeNull();
  });

  it('returns null when tokenPrice is missing or non-positive', () => {
    expect(getReserveTotalBorrowedUsd({ borrowed: '1', decimals: 6 })).toBeNull();
    expect(getReserveTotalBorrowedUsd({ borrowed: '1', decimals: 6, tokenPrice: 0 })).toBeNull();
    expect(getReserveTotalBorrowedUsd({ borrowed: '1', decimals: 6, tokenPrice: -1 })).toBeNull();
  });

  it('returns null when borrowed is not numeric', () => {
    expect(
      getReserveTotalBorrowedUsd({ borrowed: 'not-a-number', decimals: 6, tokenPrice: 1 }),
    ).toBeNull();
  });
});

describe('getDisplayTotalBorrowedUsd', () => {
  const v4Reserve = {
    borrowed: '1037279054299',
    decimals: 6,
    tokenPrice: 1.0002,
    supplied: '0',
    utilizationPct: 93.14,
  };

  it('V3: uses on-chain borrowed when available', () => {
    expect(getDisplayTotalBorrowedUsd(v4Reserve, 'v3')).toBeCloseTo(1037486.51, 2);
  });

  it('V4: uses on-chain borrowed when available', () => {
    expect(getDisplayTotalBorrowedUsd(v4Reserve, 'v4')).toBeCloseTo(1037486.51, 2);
  });

  it('V3: falls back to derived native supplied * utilizationPct / 100 when on-chain unavailable', () => {
    const noOnChain = { supplied: '1000000000000000000000', decimals: 18, tokenPrice: 1, utilizationPct: 50 };
    expect(getDisplayTotalBorrowedUsd(noOnChain, 'v3')).toBe(500);
  });

  it('V4: returns null when on-chain unavailable (no derived fallback)', () => {
    const noOnChain = { supplied: '0', decimals: 18, tokenPrice: 1, utilizationPct: 93.14 };
    expect(getDisplayTotalBorrowedUsd(noOnChain, 'v4')).toBeNull();
  });
});

describe('getDisplayAvailableLiquidityUsd', () => {
  it('V3: uses on-chain liquidity when available', () => {
    expect(
      getDisplayAvailableLiquidityUsd({
        liquidity: '76610908377',
        decimals: 6,
        tokenPrice: 1.0002,
        supplied: '100000000000000',
        utilizationPct: 50,
      }, 'v3'),
    ).toBeCloseTo(76626.23, 2);
  });

  it('V4: uses on-chain liquidity when available', () => {
    expect(
      getDisplayAvailableLiquidityUsd({
        liquidity: '76610908377',
        decimals: 6,
        tokenPrice: 1.0002,
        supplied: '0',
        utilizationPct: 93.14,
      }, 'v4'),
    ).toBeCloseTo(76626.23, 2);
  });

  it('V3: falls back to derived supplied - totalBorrowed when on-chain unavailable', () => {
    const noOnChain = { supplied: '1000000000000000000000', decimals: 18, tokenPrice: 1, utilizationPct: 50 };
    // totalBorrowed = 1000 * 50/100 = 500, liquidity = 1000 - 500 = 500
    expect(getDisplayAvailableLiquidityUsd(noOnChain, 'v3')).toBe(500);
  });

  it('V4: returns null when on-chain unavailable (no derived fallback)', () => {
    const noOnChain = { supplied: '0', decimals: 18, tokenPrice: 1, utilizationPct: 93.14 };
    expect(getDisplayAvailableLiquidityUsd(noOnChain, 'v4')).toBeNull();
  });
});

describe('getScenarioSupplySizeUsd (reserve size context)', () => {
  it('returns nativeToUsd when no scenario input (via getScenarioSupplySizeUsd with zero input)', () => {
    const reserveSizeUsd = nativeToUsd('1000000000000000000000', 18, 1);
    expect(getScenarioSupplySizeUsd({ reserveSizeUsd, supplyCapUsd: null, rawSupplyInput: '', inputMode: 'usd', tokenPrice: 1 })).toBe(1000);
  });

  it('returns null when reserveSizeUsd is null', () => {
    const reserveSizeUsd = nativeToUsd(null, 18, 1);
    expect(reserveSizeUsd).toBeNull();
  });

  it('returns 0 when supplied-derived USD is 0', () => {
    const reserveSizeUsd = nativeToUsd('0', 18, 1);
    expect(reserveSizeUsd).toBe(0);
  });

  it('applies scenario input when supplied is non-zero', () => {
    expect(
      getScenarioSupplySizeUsd({
        reserveSizeUsd: 1000,
        supplyCapUsd: 2000,
        rawSupplyInput: '500',
        inputMode: 'usd',
        tokenPrice: 1,
      }),
    ).toBe(1500);
  });

  it('applies scenario input when supplied is 0', () => {
    expect(
      getScenarioSupplySizeUsd({
        reserveSizeUsd: 0,
        supplyCapUsd: 2000,
        rawSupplyInput: '500',
        inputMode: 'usd',
        tokenPrice: 1,
      }),
    ).toBe(500);
  });
});

describe('getSuppliableUsd', () => {
  it('uses API suppliable when available', () => {
    expect(
      getSuppliableUsd({ suppliable: '500000000000000000000', decimals: 18, tokenPrice: 2 }),
    ).toBe(1000);
  });

  it('falls back to supplyCap - supplied when suppliable is missing', () => {
    expect(
      getSuppliableUsd({
        supplyCap: '2000000000000000000000',
        supplied: '1000000000000000000000',
        decimals: 18,
        tokenPrice: 1,
      }),
    ).toBe(1000);
  });

  it('returns null when suppliable missing and supplyCap missing', () => {
    expect(
      getSuppliableUsd({ supplied: '1000', decimals: 18, tokenPrice: 1 }),
    ).toBeNull();
  });
});

describe('getBorrowableUsd', () => {
  it('uses API borrowable when available', () => {
    expect(
      getBorrowableUsd({ borrowable: '300000000000000000000', decimals: 18, tokenPrice: 2 }),
    ).toBe(600);
  });

  it('falls back to getAvailableToBorrowUsd when borrowable is missing', () => {
    expect(
      getBorrowableUsd({
        borrowCap: '1000000000000000000000',
        borrowed: '400000000000000000000',
        liquidity: '700000000000000000000',
        decimals: 18,
        tokenPrice: 1,
      }),
    ).toBe(600);
  });

  it('returns null when borrowable missing and no fallback data', () => {
    expect(
      getBorrowableUsd({ decimals: 18, tokenPrice: 1 }),
    ).toBeNull();
  });
});
