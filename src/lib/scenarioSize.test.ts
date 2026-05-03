import { describe, expect, it } from 'vitest';

import { convertUsdToInputValue, getDisplayAvailableLiquidityUsd, getDisplayReserveSizeUsd, getDisplayTotalBorrowedUsd, getReserveAvailableLiquidityUsd, getReserveTotalBorrowedUsd, getScenarioSupplySizeUsd, nativeToUsd, getSuppliableUsd, getBorrowableUsd, getDisplayBorrowableUsd } from './scenarioSize';

describe('nativeToUsd', () => {
  it('converts raw token units to USD', () => {
    expect(nativeToUsd('1000000000000000000', 18, 2500)).toBe(2500);
  });

  it('returns null when raw is missing', () => {
    expect(nativeToUsd(null, 18, 1)).toBeNull();
    expect(nativeToUsd(undefined, 18, 1)).toBeNull();
  });

  it('returns null when decimals is missing or invalid', () => {
    expect(nativeToUsd('1', null, 1)).toBeNull();
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
  it('computes USD liquidity from on-chain raw availableLiquidity', () => {
    // AaveV4Forex USDT real numbers: 76,610,908,377 raw / 10^6 * 1.0002 ≈ $76,626.23
    expect(
      getReserveAvailableLiquidityUsd({
        availableLiquidity: '76610908377',
        decimals: 6,
        tokenPrice: 1.0002,
      }),
    ).toBeCloseTo(76626.23, 2);
  });

  it('handles 18-decimal tokens', () => {
    expect(
      getReserveAvailableLiquidityUsd({
        availableLiquidity: '1000000000000000000', // 1 token
        decimals: 18,
        tokenPrice: 2500,
      }),
    ).toBe(2500);
  });

  it('returns null when availableLiquidity is missing', () => {
    expect(getReserveAvailableLiquidityUsd({ decimals: 6, tokenPrice: 1 })).toBeNull();
    expect(getReserveAvailableLiquidityUsd({ availableLiquidity: '', decimals: 6, tokenPrice: 1 })).toBeNull();
  });

  it('returns null when decimals is missing or invalid', () => {
    expect(getReserveAvailableLiquidityUsd({ availableLiquidity: '1', tokenPrice: 1 })).toBeNull();
    expect(getReserveAvailableLiquidityUsd({ availableLiquidity: '1', decimals: -1, tokenPrice: 1 })).toBeNull();
  });

  it('returns null when tokenPrice is missing or non-positive', () => {
    expect(getReserveAvailableLiquidityUsd({ availableLiquidity: '1', decimals: 6 })).toBeNull();
    expect(getReserveAvailableLiquidityUsd({ availableLiquidity: '1', decimals: 6, tokenPrice: 0 })).toBeNull();
    expect(getReserveAvailableLiquidityUsd({ availableLiquidity: '1', decimals: 6, tokenPrice: -1 })).toBeNull();
  });

  it('returns null when availableLiquidity is not numeric', () => {
    expect(
      getReserveAvailableLiquidityUsd({ availableLiquidity: 'not-a-number', decimals: 6, tokenPrice: 1 }),
    ).toBeNull();
  });
});

describe('getReserveTotalBorrowedUsd', () => {
  it('computes USD borrowed from on-chain raw totalVariableDebt', () => {
    // AaveV4Bluechip USDT real numbers: 1,037,279,054,299 raw / 10^6 * 1.0002 ≈ $1,037,486.51
    expect(
      getReserveTotalBorrowedUsd({
        totalVariableDebt: '1037279054299',
        decimals: 6,
        tokenPrice: 1.0002,
      }),
    ).toBeCloseTo(1037486.51, 2);
  });

  it('handles 18-decimal tokens', () => {
    expect(
      getReserveTotalBorrowedUsd({
        totalVariableDebt: '5000000000000000000', // 5 tokens
        decimals: 18,
        tokenPrice: 2500,
      }),
    ).toBe(12500);
  });

  it('returns null when totalVariableDebt is missing', () => {
    expect(getReserveTotalBorrowedUsd({ decimals: 6, tokenPrice: 1 })).toBeNull();
    expect(getReserveTotalBorrowedUsd({ totalVariableDebt: '', decimals: 6, tokenPrice: 1 })).toBeNull();
  });

  it('returns null when decimals is missing or invalid', () => {
    expect(getReserveTotalBorrowedUsd({ totalVariableDebt: '1', tokenPrice: 1 })).toBeNull();
    expect(getReserveTotalBorrowedUsd({ totalVariableDebt: '1', decimals: -1, tokenPrice: 1 })).toBeNull();
  });

  it('returns null when tokenPrice is missing or non-positive', () => {
    expect(getReserveTotalBorrowedUsd({ totalVariableDebt: '1', decimals: 6 })).toBeNull();
    expect(getReserveTotalBorrowedUsd({ totalVariableDebt: '1', decimals: 6, tokenPrice: 0 })).toBeNull();
    expect(getReserveTotalBorrowedUsd({ totalVariableDebt: '1', decimals: 6, tokenPrice: -1 })).toBeNull();
  });

  it('returns null when totalVariableDebt is not numeric', () => {
    expect(
      getReserveTotalBorrowedUsd({ totalVariableDebt: 'not-a-number', decimals: 6, tokenPrice: 1 }),
    ).toBeNull();
  });
});

describe('getDisplayTotalBorrowedUsd', () => {
  const v4Reserve = {
    totalVariableDebt: '1037279054299',
    decimals: 6,
    tokenPrice: 1.0002,
    reserveSize: '0',
    utilizationPct: 93.14,
  };

  it('V3: uses on-chain totalVariableDebt when available', () => {
    expect(getDisplayTotalBorrowedUsd(v4Reserve, 'v3')).toBeCloseTo(1037486.51, 2);
  });

  it('V4: uses on-chain totalVariableDebt when available', () => {
    expect(getDisplayTotalBorrowedUsd(v4Reserve, 'v4')).toBeCloseTo(1037486.51, 2);
  });

  it('V3: falls back to derived native reserveSize * utilizationPct / 100 when on-chain unavailable', () => {
    const noOnChain = { reserveSize: '1000000000000000000000', decimals: 18, tokenPrice: 1, utilizationPct: 50 };
    expect(getDisplayTotalBorrowedUsd(noOnChain, 'v3')).toBe(500);
  });

  it('V4: returns null when on-chain unavailable (no derived fallback)', () => {
    const noOnChain = { reserveSize: '0', decimals: 18, tokenPrice: 1, utilizationPct: 93.14 };
    expect(getDisplayTotalBorrowedUsd(noOnChain, 'v4')).toBeNull();
  });
});

describe('getDisplayAvailableLiquidityUsd', () => {
  it('V3: uses on-chain availableLiquidity when available', () => {
    expect(
      getDisplayAvailableLiquidityUsd({
        availableLiquidity: '76610908377',
        decimals: 6,
        tokenPrice: 1.0002,
        reserveSize: '100000000000000',
        utilizationPct: 50,
      }, 'v3'),
    ).toBeCloseTo(76626.23, 2);
  });

  it('V4: uses on-chain availableLiquidity when available', () => {
    expect(
      getDisplayAvailableLiquidityUsd({
        availableLiquidity: '76610908377',
        decimals: 6,
        tokenPrice: 1.0002,
        reserveSize: '0',
        utilizationPct: 93.14,
      }, 'v4'),
    ).toBeCloseTo(76626.23, 2);
  });

  it('V3: falls back to derived reserveSize - totalBorrowed when on-chain unavailable', () => {
    const noOnChain = { reserveSize: '1000000000000000000000', decimals: 18, tokenPrice: 1, utilizationPct: 50 };
    // totalBorrowed = 1000 * 50/100 = 500, liquidity = 1000 - 500 = 500
    expect(getDisplayAvailableLiquidityUsd(noOnChain, 'v3')).toBe(500);
  });

  it('V4: returns null when on-chain unavailable (no derived fallback)', () => {
    const noOnChain = { reserveSize: '0', decimals: 18, tokenPrice: 1, utilizationPct: 93.14 };
    expect(getDisplayAvailableLiquidityUsd(noOnChain, 'v4')).toBeNull();
  });
});

describe('getDisplayReserveSizeUsd', () => {
  it('V3: returns nativeToUsd when valid', () => {
    expect(getDisplayReserveSizeUsd({ reserveSize: '1000000000000000000000', decimals: 18, tokenPrice: 1 }, 'v3')).toBe(1000);
  });

  it('V3: returns null when reserveSize is null', () => {
    expect(getDisplayReserveSizeUsd({ reserveSize: null, decimals: 18, tokenPrice: 1 }, 'v3')).toBeNull();
  });

  it('V4: returns nativeToUsd when non-zero', () => {
    expect(getDisplayReserveSizeUsd({ reserveSize: '1000000000000000000000', decimals: 18, tokenPrice: 1 }, 'v4')).toBe(1000);
  });

  it('V4: returns null when reserveSize-derived USD is 0 (Hub aggregate unavailable)', () => {
    expect(getDisplayReserveSizeUsd({ reserveSize: '0', decimals: 18, tokenPrice: 1 }, 'v4')).toBeNull();
  });

  it('V4: returns null when reserveSize is null', () => {
    expect(getDisplayReserveSizeUsd({ reserveSize: null, decimals: 18, tokenPrice: 1 }, 'v4')).toBeNull();
  });

  it('V4: applies scenario input when reserveSize is non-zero', () => {
    expect(
      getDisplayReserveSizeUsd(
        { reserveSize: '1000000000000000000000', decimals: 18, tokenPrice: 1, supplyCap: '2000000000000000000000' },
        'v4',
        { rawSupplyInput: '500', inputMode: 'usd', tokenPrice: 1 },
      ),
    ).toBe(1500);
  });

  it('V4: returns null with scenario input when reserveSize is 0', () => {
    expect(
      getDisplayReserveSizeUsd(
        { reserveSize: '0', decimals: 18, tokenPrice: 1, supplyCap: '2000000000000000000000' },
        'v4',
        { rawSupplyInput: '500', inputMode: 'usd', tokenPrice: 1 },
      ),
    ).toBeNull();
  });
});

describe('getSuppliableUsd', () => {
  it('uses API suppliable when available', () => {
    expect(
      getSuppliableUsd({ suppliable: '500000000000000000000', decimals: 18, tokenPrice: 2 }),
    ).toBe(1000);
  });

  it('falls back to supplyCap - reserveSize when suppliable is missing', () => {
    expect(
      getSuppliableUsd({
        supplyCap: '2000000000000000000000',
        reserveSize: '1000000000000000000000',
        decimals: 18,
        tokenPrice: 1,
      }),
    ).toBe(1000);
  });

  it('returns null when suppliable missing and supplyCap missing', () => {
    expect(
      getSuppliableUsd({ reserveSize: '1000', decimals: 18, tokenPrice: 1 }),
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
        totalVariableDebt: '400000000000000000000',
        availableLiquidity: '700000000000000000000',
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

describe('getDisplayBorrowableUsd', () => {
  it('uses API borrowable when available (V3)', () => {
    expect(
      getDisplayBorrowableUsd({ borrowable: '300000000000000000000', decimals: 18, tokenPrice: 2 }, 'v3'),
    ).toBe(600);
  });

  it('uses API borrowable when available (V4)', () => {
    expect(
      getDisplayBorrowableUsd({ borrowable: '300000000000000000000', decimals: 18, tokenPrice: 2 }, 'v4'),
    ).toBe(600);
  });

  it('falls back for V3 when borrowable is missing', () => {
    expect(
      getDisplayBorrowableUsd({
        borrowCap: '1000000000000000000000',
        totalVariableDebt: '400000000000000000000',
        availableLiquidity: '700000000000000000000',
        decimals: 18,
        tokenPrice: 1,
      }, 'v3'),
    ).toBe(600);
  });

  it('returns null for V4 when borrowable is missing (no cross-layer fallback)', () => {
    expect(
      getDisplayBorrowableUsd({
        borrowCap: '1000000000000000000000',
        totalVariableDebt: '400000000000000000000',
        availableLiquidity: '700000000000000000000',
        decimals: 18,
        tokenPrice: 1,
      }, 'v4'),
    ).toBeNull();
  });

  it('clamps API result to ≥ 0', () => {
    expect(
      getDisplayBorrowableUsd({ borrowable: '0', decimals: 18, tokenPrice: 1 }, 'v4'),
    ).toBe(0);
  });
});
