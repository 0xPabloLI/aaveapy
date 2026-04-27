import { describe, expect, it } from 'vitest';

import { convertUsdToInputValue, getDisplayPoolLiquidityUsd, getDisplayReserveSizeUsd, getDisplayTotalBorrowedUsd, getReserveAvailableLiquidityUsd, getReserveTotalBorrowedUsd, getScenarioSupplySizeUsd } from './scenarioSize';

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
    reserveSizeUsd: 0,
    utilizationPct: 93.14,
  };

  it('V3: uses on-chain totalVariableDebt when available', () => {
    expect(getDisplayTotalBorrowedUsd(v4Reserve, 'v3')).toBeCloseTo(1037486.51, 2);
  });

  it('V4: uses on-chain totalVariableDebt when available', () => {
    expect(getDisplayTotalBorrowedUsd(v4Reserve, 'v4')).toBeCloseTo(1037486.51, 2);
  });

  it('V3: falls back to derived reserveSizeUsd * utilizationPct / 100 when on-chain unavailable', () => {
    const noOnChain = { reserveSizeUsd: 1000, utilizationPct: 50 };
    expect(getDisplayTotalBorrowedUsd(noOnChain, 'v3')).toBe(500);
  });

  it('V4: returns null when on-chain unavailable (no derived fallback)', () => {
    const noOnChain = { reserveSizeUsd: 0, utilizationPct: 93.14 };
    expect(getDisplayTotalBorrowedUsd(noOnChain, 'v4')).toBeNull();
  });
});

describe('getDisplayPoolLiquidityUsd', () => {
  it('V3: uses on-chain availableLiquidity when available', () => {
    expect(
      getDisplayPoolLiquidityUsd({
        availableLiquidity: '76610908377',
        decimals: 6,
        tokenPrice: 1.0002,
        reserveSizeUsd: 100000,
        utilizationPct: 50,
      }, 'v3'),
    ).toBeCloseTo(76626.23, 2);
  });

  it('V4: uses on-chain availableLiquidity when available', () => {
    expect(
      getDisplayPoolLiquidityUsd({
        availableLiquidity: '76610908377',
        decimals: 6,
        tokenPrice: 1.0002,
        reserveSizeUsd: 0,
        utilizationPct: 93.14,
      }, 'v4'),
    ).toBeCloseTo(76626.23, 2);
  });

  it('V3: falls back to derived reserveSizeUsd - totalBorrowed when on-chain unavailable', () => {
    const noOnChain = { reserveSizeUsd: 1000, utilizationPct: 50 };
    // totalBorrowed = 1000 * 50/100 = 500, liquidity = 1000 - 500 = 500
    expect(getDisplayPoolLiquidityUsd(noOnChain, 'v3')).toBe(500);
  });

  it('V4: returns null when on-chain unavailable (no derived fallback)', () => {
    const noOnChain = { reserveSizeUsd: 0, utilizationPct: 93.14 };
    expect(getDisplayPoolLiquidityUsd(noOnChain, 'v4')).toBeNull();
  });
});

describe('getDisplayReserveSizeUsd', () => {
  it('V3: returns reserveSizeUsd when valid', () => {
    expect(getDisplayReserveSizeUsd({ reserveSizeUsd: 1000 }, 'v3')).toBe(1000);
  });

  it('V3: returns null when reserveSizeUsd is null', () => {
    expect(getDisplayReserveSizeUsd({ reserveSizeUsd: null }, 'v3')).toBeNull();
  });

  it('V4: returns reserveSizeUsd when non-zero', () => {
    expect(getDisplayReserveSizeUsd({ reserveSizeUsd: 1000 }, 'v4')).toBe(1000);
  });

  it('V4: returns null when reserveSizeUsd is 0 (Hub aggregate unavailable)', () => {
    expect(getDisplayReserveSizeUsd({ reserveSizeUsd: 0 }, 'v4')).toBeNull();
  });

  it('V4: returns null when reserveSizeUsd is null', () => {
    expect(getDisplayReserveSizeUsd({ reserveSizeUsd: null }, 'v4')).toBeNull();
  });

  it('V4: applies scenario input when reserveSizeUsd is non-zero', () => {
    expect(
      getDisplayReserveSizeUsd(
        { reserveSizeUsd: 1000, supplyCapUsd: 2000 },
        'v4',
        { rawSupplyInput: '500', inputMode: 'usd', tokenPrice: 1 },
      ),
    ).toBe(1500);
  });

  it('V4: returns null with scenario input when reserveSizeUsd is 0', () => {
    expect(
      getDisplayReserveSizeUsd(
        { reserveSizeUsd: 0, supplyCapUsd: 2000 },
        'v4',
        { rawSupplyInput: '500', inputMode: 'usd', tokenPrice: 1 },
      ),
    ).toBeNull();
  });
});
