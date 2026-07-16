import { describe, expect, it } from 'vitest';
import {
  convertAprToApy,
  apyToApr,
  annualPercentToDailyFraction,
  calculateTotalSupplyApr,
  calculateTotalSupplyApy,
  calculateTotalBorrowApr,
  calculateTotalBorrowApy,
  calculateSpreadApr,
  calculateSpreadApy,
  scaleAprThenConvert,
} from './rateCalculations';

describe('convertAprToApy', () => {
  it('converts 0% APR to 0% APY', () => {
    expect(convertAprToApy(0)).toBeCloseTo(0, 10);
  });

  it('converts positive APR to slightly higher APY due to monthly compounding', () => {
    const apy = convertAprToApy(12);
    expect(apy).toBeGreaterThan(12);
    expect(apy).toBeLessThan(13);
  });

  it('handles negative APR (compounding dampens the effect)', () => {
    const apy = convertAprToApy(-5);
    expect(apy).toBeLessThan(0);
    expect(apy).toBeGreaterThan(-5);
  });

  it('handles very large APR', () => {
    const apy = convertAprToApy(1000);
    expect(apy).toBeGreaterThan(1000);
    expect(Number.isFinite(apy)).toBe(true);
  });
});

describe('apyToApr', () => {
  it('converts 0% APY to 0% APR', () => {
    expect(apyToApr(0)).toBeCloseTo(0, 10);
  });

  it('converts positive APY to slightly lower APR', () => {
    const apr = apyToApr(12);
    expect(apr).toBeLessThan(12);
    expect(apr).toBeGreaterThan(11);
  });

  it('is the inverse of convertAprToApy (round-trip)', () => {
    const originalApr = 10;
    const apy = convertAprToApy(originalApr);
    const roundTrip = apyToApr(apy);
    expect(roundTrip).toBeCloseTo(originalApr, 10);
  });

  it('round-trips with negative rates', () => {
    const originalApr = -3;
    const apy = convertAprToApy(originalApr);
    const roundTrip = apyToApr(apy);
    expect(roundTrip).toBeCloseTo(originalApr, 10);
  });

  it('handles negative APY (returns negative APR with larger magnitude)', () => {
    const apr = apyToApr(-5);
    expect(apr).toBeLessThan(0);
    expect(apr).toBeLessThan(-5);
  });
});

describe('annualPercentToDailyFraction', () => {
  it('converts APR percent to daily fraction (simple division)', () => {
    expect(annualPercentToDailyFraction(365, false)).toBeCloseTo(0.01, 10);
  });

  it('converts APY percent to daily fraction (compounding)', () => {
    const daily = annualPercentToDailyFraction(10, true);
    expect(daily).toBeGreaterThan(0);
    expect(daily).toBeLessThan(0.001);
  });

  it('returns NaN for non-finite input', () => {
    expect(annualPercentToDailyFraction(Infinity, false)).toBeNaN();
    expect(annualPercentToDailyFraction(NaN, true)).toBeNaN();
  });

  it('zero rate yields zero daily fraction', () => {
    expect(annualPercentToDailyFraction(0, false)).toBeCloseTo(0, 10);
    expect(annualPercentToDailyFraction(0, true)).toBeCloseTo(0, 10);
  });
});

describe('calculateTotalSupplyApr', () => {
  it('sums native and incentive APR', () => {
    expect(calculateTotalSupplyApr(5, 3)).toBe(8);
  });

  it('returns null for null/undefined native', () => {
    expect(calculateTotalSupplyApr(null, 3)).toBeNull();
    expect(calculateTotalSupplyApr(undefined, 3)).toBeNull();
  });

  it('returns null for NaN inputs', () => {
    expect(calculateTotalSupplyApr(NaN, 3)).toBeNull();
    expect(calculateTotalSupplyApr(5, NaN)).toBeNull();
  });
});

describe('calculateTotalSupplyApy', () => {
  it('sums native and incentive APY', () => {
    expect(calculateTotalSupplyApy(5, 3)).toBe(8);
  });

  it('returns null for null/undefined native', () => {
    expect(calculateTotalSupplyApy(null, 3)).toBeNull();
  });
});

describe('calculateTotalBorrowApr', () => {
  it('subtracts incentive from native borrow APR', () => {
    expect(calculateTotalBorrowApr(10, 3)).toBe(7);
  });

  it('returns null for null/undefined native', () => {
    expect(calculateTotalBorrowApr(null, 3)).toBeNull();
  });

  it('returns null for NaN inputs', () => {
    expect(calculateTotalBorrowApr(NaN, 3)).toBeNull();
  });
});

describe('calculateTotalBorrowApy', () => {
  it('subtracts incentive from native borrow APY', () => {
    expect(calculateTotalBorrowApy(10, 3)).toBe(7);
  });

  it('returns null for null/undefined native', () => {
    expect(calculateTotalBorrowApy(null, 3)).toBeNull();
  });
});

describe('calculateSpreadApr', () => {
  it('returns supply minus borrow', () => {
    expect(calculateSpreadApr(10, 4)).toBe(6);
  });

  it('returns null if either input is null', () => {
    expect(calculateSpreadApr(null, 4)).toBeNull();
    expect(calculateSpreadApr(10, null)).toBeNull();
  });

  it('returns NaN when inputs are NaN (subtraction propagates NaN)', () => {
    expect(calculateSpreadApr(NaN, 4)).toBeNaN();
    expect(calculateSpreadApr(10, NaN)).toBeNaN();
  });

  it('returns negative spread when borrow exceeds supply', () => {
    expect(calculateSpreadApr(3, 10)).toBe(-7);
  });
});

describe('calculateSpreadApy', () => {
  it('returns supply minus borrow', () => {
    expect(calculateSpreadApy(10, 4)).toBe(6);
  });

  it('returns null if either input is null', () => {
    expect(calculateSpreadApy(null, 4)).toBeNull();
    expect(calculateSpreadApy(10, null)).toBeNull();
  });

  it('returns NaN when inputs are NaN', () => {
    expect(calculateSpreadApy(NaN, 4)).toBeNaN();
    expect(calculateSpreadApy(10, NaN)).toBeNaN();
  });

  it('returns negative spread when borrow exceeds supply', () => {
    expect(calculateSpreadApy(3, 10)).toBe(-7);
  });
});

describe('scaleAprThenConvert', () => {
  it('scales APR by ratio then converts to APY when isApy=true', () => {
    const apr = 100;
    const ratio = 0.5;
    const result = scaleAprThenConvert(apr, { ratio, isApy: true });
    const expected = convertAprToApy(apr * ratio);
    expect(result).toBeCloseTo(expected, 10);
    expect(result).not.toBeCloseTo(convertAprToApy(apr) * ratio, 1);
  });

  it('scales APR by ratio and returns APR when isApy=false', () => {
    expect(scaleAprThenConvert(20, { ratio: 0.5, isApy: false })).toBeCloseTo(10, 10);
  });

  it('returns 0 when ratio=0', () => {
    expect(scaleAprThenConvert(100, { ratio: 0, isApy: true })).toBeCloseTo(0, 10);
    expect(scaleAprThenConvert(100, { ratio: 0, isApy: false })).toBeCloseTo(0, 10);
  });

  it('returns convertAprToApy(apr) when ratio=1', () => {
    expect(scaleAprThenConvert(12, { ratio: 1, isApy: true })).toBeCloseTo(convertAprToApy(12), 10);
  });

  it('handles negative APR', () => {
    const result = scaleAprThenConvert(-10, { ratio: 0.5, isApy: true });
    expect(result).toBeCloseTo(convertAprToApy(-5), 10);
  });

  it('preserves APR order: scale-then-convert differs from convert-then-scale at high APR', () => {
    const apr = 100;
    const ratio = 0.5;
    const scaleThenConvert = scaleAprThenConvert(apr, { ratio, isApy: true });
    const convertThenScale = convertAprToApy(apr) * ratio;
    expect(scaleThenConvert).toBeLessThan(convertThenScale);
  });

  it('returns NaN for NaN input', () => {
    expect(scaleAprThenConvert(NaN, { ratio: 0.5, isApy: true })).toBeNaN();
  });

  it('returns Infinity for Infinity input with positive ratio', () => {
    expect(scaleAprThenConvert(Infinity, { ratio: 1, isApy: false })).toBe(Infinity);
  });
});
