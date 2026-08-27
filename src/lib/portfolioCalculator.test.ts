import { describe, it, expect } from 'vitest';
import {
  aggregatePortfolioSummary,
  computePositionUsdPerDay,
  resolvePositionAmountUsd,
  buildPortfolioPositionResult,
  convertPortfolioInputAmount,
  formatConvertedAmount,
  getHfColorClass,
  getHfColorName,
  getMinHf,
  getLowestHfDelta,
} from './portfolioCalculator';
import type { PortfolioPositionResult, PortfolioSideData } from '@/types/portfolio';
import type { ReserveWithSpread } from '@/types/aave';

describe('computePositionUsdPerDay', () => {
  it('returns positive for supply', () => {
    const result = computePositionUsdPerDay('supply', 10000, 3.65, 0);
    expect(result).toBeCloseTo(1, 1);
  });

  it('returns negative native + positive incentive for borrow', () => {
    const result = computePositionUsdPerDay('borrow', 10000, 5, 2);
    expect(result).toBeCloseTo(-0.8219, 2);
  });

  it('returns 0 for zero amount', () => {
    expect(computePositionUsdPerDay('supply', 0, 5, 2)).toBe(0);
  });

  it('uses compounding formula when isApy=true', () => {
    // 200% APY: daily fraction = (1 + 2)^(1/365) - 1 ≈ 0.003016
    const result = computePositionUsdPerDay('supply', 10000, 200, 0, true);
    const expectedDaily = (Math.pow(1 + 200 / 100, 1 / 365) - 1) * 10000;
    expect(result).toBeCloseTo(expectedDaily, 6);
  });

  it('uses APR formula when isApy=false (default)', () => {
    // 200% APR: daily = 200 / 100 / 365 ≈ 0.005479
    const result = computePositionUsdPerDay('supply', 10000, 200, 0);
    const expectedDaily = (200 / 100 / 365) * 10000;
    expect(result).toBeCloseTo(expectedDaily, 6);
  });

  it('borrow with isApy=true uses compounding for both native and incentive', () => {
    const result = computePositionUsdPerDay('borrow', 100000, 5, 2, true);
    const nativeDaily = (Math.pow(1 + 5 / 100, 1 / 365) - 1) * 100000;
    const incentiveDaily = (Math.pow(1 + 2 / 100, 1 / 365) - 1) * 100000;
    // Borrow: -native + incentive
    const expected = -nativeDaily + incentiveDaily;
    expect(result).toBeCloseTo(expected, 6);
  });
});

describe('aggregatePortfolioSummary', () => {
  it('aggregates supply and borrow positions', () => {
    const results: PortfolioPositionResult[] = [
      {
        reserveId: 'r1',
        side: 'supply',
        walletUsd: null,
        amountUsd: 10000,
        nativePercent: 3,
        incentivePercent: 1,
        totalPercent: 4,
        usdPerDay: 1.0959,
      },
      {
        reserveId: 'r2',
        side: 'borrow',
        walletUsd: null,
        amountUsd: 5000,
        nativePercent: 6,
        incentivePercent: 2,
        totalPercent: 4,
        usdPerDay: -0.5479,
      },
    ];

    const summary = aggregatePortfolioSummary(results);
    expect(summary.totalSupplyUsd).toBe(10000);
    expect(summary.totalBorrowUsd).toBe(5000);
    expect(summary.supplyUsdPerDay).toBeCloseTo(1.0959, 2);
    expect(summary.borrowUsdPerDay).toBeCloseTo(-0.5479, 2);
    expect(summary.netUsdPerDay).toBeCloseTo(0.548, 1);
    expect(summary.netEffectiveApy).toBeGreaterThan(0);
  });

  it('returns zero APY when no supply positions', () => {
    const results: PortfolioPositionResult[] = [
      {
        reserveId: 'r2',
        side: 'borrow',
        walletUsd: null,
        amountUsd: 5000,
        nativePercent: 6,
        incentivePercent: 0,
        totalPercent: 6,
        usdPerDay: -0.8219,
      },
    ];
    const summary = aggregatePortfolioSummary(results);
    expect(summary.netEffectiveApy).toBe(0);
    expect(summary.supplyWeightedApy).toBe(0);
    expect(summary.borrowWeightedApy).toBe(6);
  });

  it('borrow with large incentive rebate exceeds cost', () => {
    const result = computePositionUsdPerDay('borrow', 10000, 5, 6);
    expect(result).toBeGreaterThan(0);
  });

  it('aggregates multiple supply and borrow positions', () => {
    const results: PortfolioPositionResult[] = [
      { reserveId: 'r1', side: 'supply', amountUsd: 10000, walletUsd: null, nativePercent: 3, incentivePercent: 1, totalPercent: 4, usdPerDay: 1.0959 },
      { reserveId: 'r2', side: 'supply', amountUsd: 20000, walletUsd: null, nativePercent: 2, incentivePercent: 0.5, totalPercent: 2.5, usdPerDay: 1.3699 },
      { reserveId: 'r3', side: 'supply', amountUsd: 5000, walletUsd: null, nativePercent: 5, incentivePercent: 2, totalPercent: 7, usdPerDay: 0.9589 },
      { reserveId: 'r4', side: 'borrow', amountUsd: 8000, walletUsd: null, nativePercent: 4, incentivePercent: 1, totalPercent: 3, usdPerDay: -0.6575 },
      { reserveId: 'r5', side: 'borrow', amountUsd: 3000, walletUsd: null, nativePercent: 6, incentivePercent: 0, totalPercent: 6, usdPerDay: -0.4932 },
    ];
    const summary = aggregatePortfolioSummary(results);
    expect(summary.totalSupplyUsd).toBe(35000);
    expect(summary.totalBorrowUsd).toBe(11000);
    expect(summary.netUsdPerDay).toBeCloseTo(results.reduce((s, r) => s + r.usdPerDay, 0), 2);
    expect(summary.netEffectiveApy).toBeGreaterThan(0);
    // Weighted supply APY: (10000*4 + 20000*2.5 + 5000*7) / 35000 = (40000+50000+35000)/35000 = 3.5714
    expect(summary.supplyWeightedApy).toBeCloseTo(3.5714, 2);
    // Weighted borrow APY: (8000*3 + 3000*6) / 11000 = (24000+18000)/11000 = 3.8182
    expect(summary.borrowWeightedApy).toBeCloseTo(3.8182, 2);
  });

  it('weighted APY with single supply position returns that position totalPercent', () => {
    const results: PortfolioPositionResult[] = [
      { reserveId: 'r1', side: 'supply', amountUsd: 10000, walletUsd: null, nativePercent: 3, incentivePercent: 1, totalPercent: 4, usdPerDay: 1.1 },
    ];
    const summary = aggregatePortfolioSummary(results);
    expect(summary.supplyWeightedApy).toBe(4);
    expect(summary.borrowWeightedApy).toBe(0);
  });

  it('weighted APY with no positions returns 0', () => {
    const summary = aggregatePortfolioSummary([]);
    expect(summary.supplyWeightedApy).toBe(0);
    expect(summary.borrowWeightedApy).toBe(0);
  });

  it('computes delta summary metrics from position metrics', () => {
    const results: PortfolioPositionResult[] = [
      {
        reserveId: 'r1', side: 'supply', amountUsd: 10000, walletUsd: null,
        nativePercent: 3, incentivePercent: 1, totalPercent: 4, usdPerDay: 1.1,
        usdPerDayMetric: { current: 0.9, after: 1.1, delta: 0.2 },
      },
      {
        reserveId: 'r2', side: 'borrow', amountUsd: 5000, walletUsd: null,
        nativePercent: 5, incentivePercent: 0, totalPercent: 5, usdPerDay: -0.68,
        usdPerDayMetric: { current: -0.5, after: -0.68, delta: -0.18 },
      },
    ];
    const summary = aggregatePortfolioSummary(results);
    expect(summary.supplyUsdPerDayMetric).toBeDefined();
    expect(summary.supplyUsdPerDayMetric!.current).toBeCloseTo(0.9, 6);
    expect(summary.supplyUsdPerDayMetric!.after).toBeCloseTo(1.1, 6);
    expect(summary.supplyUsdPerDayMetric!.delta).toBeCloseTo(0.2, 6);
    expect(summary.borrowUsdPerDayMetric).toBeDefined();
    expect(summary.borrowUsdPerDayMetric!.current).toBeCloseTo(-0.5, 6);
    expect(summary.borrowUsdPerDayMetric!.delta).toBeCloseTo(-0.18, 6);
    expect(summary.netUsdPerDayMetric).toBeDefined();
    expect(summary.netUsdPerDayMetric!.current).toBeCloseTo(0.4, 6);
    expect(summary.netUsdPerDayMetric!.after).toBeCloseTo(0.42, 2);
  });

  it('omits summary metrics when no position has metrics', () => {
    const results: PortfolioPositionResult[] = [
      { reserveId: 'r1', side: 'supply', amountUsd: 10000, walletUsd: null, nativePercent: 3, incentivePercent: 1, totalPercent: 4, usdPerDay: 1.1 },
    ];
    const summary = aggregatePortfolioSummary(results);
    expect(summary.supplyUsdPerDayMetric).toBeUndefined();
    expect(summary.netUsdPerDayMetric).toBeUndefined();
    expect(summary.netEffectiveApyMetric).toBeUndefined();
  });
});

describe('resolvePositionAmountUsd', () => {
  const baseSide: PortfolioSideData = {
    amount: '',
    inputMode: 'usd',
    walletValue: null,
  };

  it('returns 0 for empty amount', () => {
    expect(resolvePositionAmountUsd({ ...baseSide, amount: '' }, undefined)).toBe(0);
  });

  it('returns raw value when inputMode is usd', () => {
    expect(resolvePositionAmountUsd({ ...baseSide, amount: '5000' }, undefined)).toBe(5000);
  });

  it('multiplies by tokenPrice when inputMode is token', () => {
    const reserve = { tokenPrice: 2.5 } as ReserveWithSpread;
    expect(resolvePositionAmountUsd({ ...baseSide, amount: '100', inputMode: 'token' }, reserve)).toBe(250);
  });

  it('returns 0 when token mode but no price', () => {
    expect(resolvePositionAmountUsd({ ...baseSide, amount: '100', inputMode: 'token' }, undefined)).toBe(0);
  });

  it('returns 0 when token mode but price is 0', () => {
    const reserve = { tokenPrice: 0 } as ReserveWithSpread;
    expect(resolvePositionAmountUsd({ ...baseSide, amount: '100', inputMode: 'token' }, reserve)).toBe(0);
  });
});

describe('buildPortfolioPositionResult', () => {
  it('builds supply result with correct fields', () => {
    const result = buildPortfolioPositionResult('r1', 'supply', 10000, 3, 1);
    expect(result.reserveId).toBe('r1');
    expect(result.side).toBe('supply');
    expect(result.amountUsd).toBe(10000);
    expect(result.nativePercent).toBe(3);
    expect(result.incentivePercent).toBe(1);
    expect(result.totalPercent).toBe(4);
    expect(result.usdPerDay).toBeGreaterThan(0);
  });

  it('builds borrow result with negative usdPerDay for net cost', () => {
    const result = buildPortfolioPositionResult('r1', 'borrow', 10000, 5, 0);
    expect(result.side).toBe('borrow');
    expect(result.usdPerDay).toBeLessThan(0);
  });

  it('borrow totalPercent = native - incentive (not native + incentive)', () => {
    const result = buildPortfolioPositionResult('r1', 'borrow', 100000, 5, 2);
    // Bug was: totalPercent = 5 + 2 = 7, correct is 5 - 2 = 3
    expect(result.totalPercent).toBe(3);
  });

  it('supply totalPercent = native + incentive (unchanged)', () => {
    const result = buildPortfolioPositionResult('r1', 'supply', 100000, 5, 2);
    expect(result.totalPercent).toBe(7);
  });

  it('computes usdPerDay via computePositionUsdPerDay', () => {
    const result = buildPortfolioPositionResult('r1', 'supply', 10000, 3.65, 0);
    const expected = computePositionUsdPerDay('supply', 10000, 3.65, 0);
    expect(result.usdPerDay).toBeCloseTo(expected, 10);
  });

  it('accepts optional metrics and includes them in result', () => {
    const metrics = {
      nativeMetric: { current: 2.8, after: 3, delta: 0.2 },
      incentiveMetric: { current: 0.9, after: 1, delta: 0.1 },
      totalMetric: { current: 3.7, after: 4, delta: 0.3 },
      usdPerDayMetric: { current: 1.01, after: 1.1, delta: 0.09 },
    };
    const result = buildPortfolioPositionResult('r1', 'supply', 10000, 3, 1, metrics);
    expect(result.nativeMetric).toEqual(metrics.nativeMetric);
    expect(result.incentiveMetric).toEqual(metrics.incentiveMetric);
    expect(result.totalMetric).toEqual(metrics.totalMetric);
    expect(result.usdPerDayMetric).toEqual(metrics.usdPerDayMetric);
  });

  it('result without metrics has undefined metric fields', () => {
    const result = buildPortfolioPositionResult('r1', 'supply', 10000, 3, 1);
    expect(result.nativeMetric).toBeUndefined();
    expect(result.incentiveMetric).toBeUndefined();
    expect(result.totalMetric).toBeUndefined();
    expect(result.usdPerDayMetric).toBeUndefined();
  });
});

describe('convertPortfolioInputAmount', () => {
  it('usd → token: divides amount by price', () => {
    expect(convertPortfolioInputAmount(5000, 'usd', 'token', 2500)).toBeCloseTo(2, 10);
  });

  it('token → usd: multiplies amount by price', () => {
    expect(convertPortfolioInputAmount(2, 'token', 'usd', 2500)).toBeCloseTo(5000, 10);
  });

  it('same mode: returns amount unchanged', () => {
    expect(convertPortfolioInputAmount(100, 'usd', 'usd', 50)).toBe(100);
    expect(convertPortfolioInputAmount(100, 'token', 'token', 50)).toBe(100);
  });

  it('returns null when price is zero', () => {
    expect(convertPortfolioInputAmount(100, 'usd', 'token', 0)).toBeNull();
  });

  it('returns null when price is negative', () => {
    expect(convertPortfolioInputAmount(100, 'usd', 'token', -1)).toBeNull();
  });

  it('returns null when price is NaN', () => {
    expect(convertPortfolioInputAmount(100, 'usd', 'token', NaN)).toBeNull();
  });

  it('handles decimal prices correctly', () => {
    expect(convertPortfolioInputAmount(1000, 'usd', 'token', 0.001)).toBeCloseTo(1_000_000, 1);
  });

  it('amount=0 returns 0 (not null)', () => {
    expect(convertPortfolioInputAmount(0, 'usd', 'token', 2500)).toBe(0);
    expect(convertPortfolioInputAmount(0, 'token', 'usd', 2500)).toBe(0);
  });

  it('amount=NaN returns null', () => {
    expect(convertPortfolioInputAmount(NaN, 'usd', 'token', 2500)).toBeNull();
    expect(convertPortfolioInputAmount(NaN, 'token', 'usd', 2500)).toBeNull();
  });

  it('amount=Infinity returns null', () => {
    expect(convertPortfolioInputAmount(Infinity, 'usd', 'token', 2500)).toBeNull();
    expect(convertPortfolioInputAmount(Infinity, 'token', 'usd', 2500)).toBeNull();
  });

  it('price=Infinity returns null', () => {
    expect(convertPortfolioInputAmount(100, 'usd', 'token', Infinity)).toBeNull();
  });
});

describe('delta model: effective amount as principal for accrual', () => {
  it('wallet position unchanged: effective amount = walletValue, delta = 0', () => {
    const effectiveAmount = 1000;
    const delta = 0;
    const afterRate = 3.65;
    const accrual = computePositionUsdPerDay('supply', effectiveAmount, afterRate, 0);
    expect(accrual).toBeCloseTo(1000 * 3.65 / 100 / 365, 6);
    expect(delta).toBe(0);
  });

  it('wallet position with extra deposit: effective amount > walletValue', () => {
    const walletValue = 1000;
    const extraDeposit = 500;
    const effectiveAmount = walletValue + extraDeposit;
    const afterRate = 3.65;
    const accrual = computePositionUsdPerDay('supply', effectiveAmount, afterRate, 0);
    expect(accrual).toBeCloseTo(1500 * 3.65 / 100 / 365, 6);
  });

  it('wallet position partially withdrawn: effective amount < walletValue', () => {
    const walletValue = 1000;
    const withdrawal = 500;
    const effectiveAmount = walletValue - withdrawal;
    const afterRate = 3.65;
    const accrual = computePositionUsdPerDay('supply', effectiveAmount, afterRate, 0);
    expect(accrual).toBeCloseTo(500 * 3.65 / 100 / 365, 6);
  });

  it('manual position (no wallet): effective amount = amount, delta = amount', () => {
    const effectiveAmount = 2000;
    const afterRate = 3.65;
    const accrual = computePositionUsdPerDay('supply', effectiveAmount, afterRate, 0);
    expect(accrual).toBeCloseTo(2000 * 3.65 / 100 / 365, 6);
  });

  it('delta does NOT leak into principal calculation', () => {
    const walletValue = 1000;
    const extraDeposit = 500;
    const delta = extraDeposit;
    const effectiveAmount = walletValue + delta;
    const accrualWithEffective = computePositionUsdPerDay('supply', effectiveAmount, 3.65, 0);
    const accrualWithDelta = computePositionUsdPerDay('supply', delta, 3.65, 0);
    expect(accrualWithEffective).toBeGreaterThan(accrualWithDelta);
    expect(accrualWithEffective).toBeCloseTo(1500 * 3.65 / 100 / 365, 6);
  });

  it('borrow: effective amount as principal for borrow cost calculation', () => {
    const walletBorrow = 500;
    const extraBorrow = 300;
    const effectiveAmount = walletBorrow + extraBorrow;
    const borrowRate = 5;
    const incentiveRate = 2;
    const accrual = computePositionUsdPerDay('borrow', effectiveAmount, borrowRate, incentiveRate);
    expect(accrual).toBeCloseTo(
      (-800 * 5 / 100 / 365) + (800 * 2 / 100 / 365),
      6,
    );
  });
});

describe('formatConvertedAmount', () => {
  it('returns "0" for zero', () => {
    expect(formatConvertedAmount(0)).toBe('0');
  });

  it('formats whole numbers without decimals', () => {
    expect(formatConvertedAmount(2)).toBe('2');
    expect(formatConvertedAmount(100)).toBe('100');
  });

  it('strips trailing zeros', () => {
    expect(formatConvertedAmount(1.5)).toBe('1.5');
    expect(formatConvertedAmount(2.0)).toBe('2');
  });

  it('limits precision to avoid float noise', () => {
    const result = formatConvertedAmount(1.5000015000015);
    expect(result.length).toBeLessThan(18);
    expect(parseFloat(result)).toBeCloseTo(1.5000015000015, 6);
  });

  it('handles small decimals', () => {
    expect(formatConvertedAmount(0.001)).toBe('0.001');
  });

  it('handles large numbers', () => {
    expect(formatConvertedAmount(1000000)).toBe('1000000');
  });
});

describe('getHfColorClass', () => {
  it('returns muted for null', () => {
    expect(getHfColorClass(null)).toBe('text-muted-foreground');
  });

  it('returns muted for 0', () => {
    expect(getHfColorClass(0)).toBe('text-muted-foreground');
  });

  it('returns red for HF < 1', () => {
    expect(getHfColorClass(0.5)).toBe('text-red-500 dark:text-red-400');
    expect(getHfColorClass(0.99)).toBe('text-red-500 dark:text-red-400');
  });

  it('returns orange for 1 <= HF < 1.5', () => {
    expect(getHfColorClass(1.0)).toBe('text-orange-600 dark:text-orange-400');
    expect(getHfColorClass(1.2)).toBe('text-orange-600 dark:text-orange-400');
    expect(getHfColorClass(1.49)).toBe('text-orange-600 dark:text-orange-400');
  });

  it('returns yellow for 1.5 <= HF < 2', () => {
    expect(getHfColorClass(1.5)).toBe('text-yellow-600 dark:text-yellow-400');
    expect(getHfColorClass(1.6)).toBe('text-yellow-600 dark:text-yellow-400');
    expect(getHfColorClass(1.99)).toBe('text-yellow-600 dark:text-yellow-400');
  });

  it('returns green for HF >= 2', () => {
    expect(getHfColorClass(2.0)).toBe('text-emerald-600 dark:text-emerald-400');
    expect(getHfColorClass(3.0)).toBe('text-emerald-600 dark:text-emerald-400');
  });
});

describe('getHfColorName', () => {
  it('returns none for null', () => {
    expect(getHfColorName(null)).toBe('none');
  });

  it('returns none for 0', () => {
    expect(getHfColorName(0)).toBe('none');
  });

  it('returns red for HF < 1', () => {
    expect(getHfColorName(0.5)).toBe('red');
    expect(getHfColorName(0.99)).toBe('red');
  });

  it('returns orange for 1 <= HF < 1.5', () => {
    expect(getHfColorName(1.0)).toBe('orange');
    expect(getHfColorName(1.49)).toBe('orange');
  });

  it('returns yellow for 1.5 <= HF < 2', () => {
    expect(getHfColorName(1.5)).toBe('yellow');
    expect(getHfColorName(1.99)).toBe('yellow');
  });

  it('returns green for HF >= 2', () => {
    expect(getHfColorName(2.0)).toBe('green');
    expect(getHfColorName(3.0)).toBe('green');
  });
});

describe('getMinHf', () => {
  it('returns min of valid HFs', () => {
    const hfs = [
      { healthFactor: 2.5 },
      { healthFactor: 1.6 },
      { healthFactor: 0.9 },
    ];
    expect(getMinHf(hfs)).toBeCloseTo(0.9, 5);
  });

  it('skips null HFs', () => {
    const hfs = [
      { healthFactor: null },
      { healthFactor: 1.6 },
    ];
    expect(getMinHf(hfs)).toBeCloseTo(1.6, 5);
  });

  it('skips zero HFs', () => {
    const hfs = [
      { healthFactor: 0 },
      { healthFactor: 1.6 },
    ];
    expect(getMinHf(hfs)).toBeCloseTo(1.6, 5);
  });

  it('returns null when all HFs are null', () => {
    const hfs = [
      { healthFactor: null },
      { healthFactor: null },
    ];
    expect(getMinHf(hfs)).toBeNull();
  });

  it('returns null for empty array', () => {
    expect(getMinHf([])).toBeNull();
  });
});

describe('getLowestHfDelta', () => {
  it('returns up direction when delta > 0', () => {
    const hfs = [
      { healthFactor: 2.0, deltaHealthFactor: 0.5 },
      { healthFactor: 1.6, deltaHealthFactor: 0.3 }, // lowest after
    ];
    const result = getLowestHfDelta(hfs);
    expect(result.delta).toBeCloseTo(0.3, 5);
    expect(result.direction).toBe('up');
  });

  it('returns down direction when delta < 0', () => {
    const hfs = [
      { healthFactor: 2.0, deltaHealthFactor: 0.5 },
      { healthFactor: 1.6, deltaHealthFactor: -0.4 }, // lowest after
    ];
    const result = getLowestHfDelta(hfs);
    expect(result.delta).toBeCloseTo(-0.4, 5);
    expect(result.direction).toBe('down');
  });

  it('returns flat direction when |delta| < 0.01', () => {
    const hfs = [
      { healthFactor: 1.6, deltaHealthFactor: 0.005 },
    ];
    const result = getLowestHfDelta(hfs);
    expect(result.direction).toBe('flat');
  });

  it('returns null direction when deltaHealthFactor is null', () => {
    const hfs = [
      { healthFactor: 1.6, deltaHealthFactor: null },
    ];
    const result = getLowestHfDelta(hfs);
    expect(result.delta).toBeNull();
    expect(result.direction).toBeNull();
  });

  it('returns null direction when no valid HFs', () => {
    const hfs = [
      { healthFactor: null, deltaHealthFactor: null },
    ];
    const result = getLowestHfDelta(hfs);
    expect(result.delta).toBeNull();
    expect(result.direction).toBeNull();
  });

  it('returns null for empty array', () => {
    expect(getLowestHfDelta([])).toEqual({ delta: null, direction: null });
  });

  it('finds the lowest after HF pool, not the lowest delta', () => {
    const hfs = [
      { healthFactor: 1.2, deltaHealthFactor: 0.1 },  // lowest after
      { healthFactor: 2.0, deltaHealthFactor: -0.5 },   // larger delta but higher after
    ];
    const result = getLowestHfDelta(hfs);
    expect(result.delta).toBeCloseTo(0.1, 5);
    expect(result.direction).toBe('up');
  });
});
