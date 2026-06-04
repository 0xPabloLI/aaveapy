import { describe, it, expect } from 'vitest';
import {
  aggregatePortfolioSummary,
  computePositionUsdPerDay,
  resolvePositionAmountUsd,
  buildPortfolioPositionResult,
  convertPortfolioInputAmount,
  formatConvertedAmount,
} from './portfolioCalculator';
import type { PortfolioPositionResult, PortfolioPosition } from '@/types/portfolio';
import type { ReserveWithSpread } from '@/types/aave';

describe('computePositionUsdPerDay', () => {
  it('returns positive for supply', () => {
    // 10000 USD at 3.65% APR → ~1 USD/day
    const result = computePositionUsdPerDay('supply', 10000, 3.65, 0);
    expect(result).toBeCloseTo(1, 1);
  });

  it('returns negative native + positive incentive for borrow', () => {
    // 10000 USD, 5% borrow cost, 2% incentive rebate → net ≈ -0.822/day
    const result = computePositionUsdPerDay('borrow', 10000, 5, 2);
    expect(result).toBeCloseTo(-0.8219, 2);
  });

  it('returns 0 for zero amount', () => {
    expect(computePositionUsdPerDay('supply', 0, 5, 2)).toBe(0);
  });
});

describe('aggregatePortfolioSummary', () => {
  it('aggregates supply and borrow positions', () => {
    const results: PortfolioPositionResult[] = [
      {
        positionId: 'a',
        reserveId: 'r1',
        side: 'supply',
        amountUsd: 10000,
        nativePercent: 3,
        incentivePercent: 1,
        totalPercent: 4,
        usdPerDay: 1.0959, // ~10000 * 4% / 365
      },
      {
        positionId: 'b',
        reserveId: 'r2',
        side: 'borrow',
        amountUsd: 5000,
        nativePercent: 6,
        incentivePercent: 2,
        totalPercent: 4, // net after rebate
        usdPerDay: -0.5479, // -(5000*6%/365) + (5000*2%/365)
      },
    ];

    const summary = aggregatePortfolioSummary(results);
    expect(summary.totalSupplyUsd).toBe(10000);
    expect(summary.totalBorrowUsd).toBe(5000);
    expect(summary.supplyUsdPerDay).toBeCloseTo(1.0959, 2);
    expect(summary.borrowUsdPerDay).toBeCloseTo(-0.5479, 2);
    expect(summary.netUsdPerDay).toBeCloseTo(0.548, 1);
    // netEffectiveApy = netUsdPerDay * 365 / totalSupplyUsd * 100
    expect(summary.netEffectiveApy).toBeGreaterThan(0);
  });

  it('returns zero APY when no supply positions', () => {
    const results: PortfolioPositionResult[] = [
      {
        positionId: 'b',
        reserveId: 'r2',
        side: 'borrow',
        amountUsd: 5000,
        nativePercent: 6,
        incentivePercent: 0,
        totalPercent: 6,
        usdPerDay: -0.8219,
      },
    ];
    const summary = aggregatePortfolioSummary(results);
    expect(summary.netEffectiveApy).toBe(0);
  });

  it('borrow with large incentive rebate exceeds cost', () => {
    const result = computePositionUsdPerDay('borrow', 10000, 5, 6);
    expect(result).toBeGreaterThan(0);
  });

  it('aggregates multiple supply and borrow positions', () => {
    const results: PortfolioPositionResult[] = [
      { positionId: 's1', reserveId: 'r1', side: 'supply', amountUsd: 10000, nativePercent: 3, incentivePercent: 1, totalPercent: 4, usdPerDay: 1.0959 },
      { positionId: 's2', reserveId: 'r2', side: 'supply', amountUsd: 20000, nativePercent: 2, incentivePercent: 0.5, totalPercent: 2.5, usdPerDay: 1.3699 },
      { positionId: 's3', reserveId: 'r3', side: 'supply', amountUsd: 5000, nativePercent: 5, incentivePercent: 2, totalPercent: 7, usdPerDay: 0.9589 },
      { positionId: 'b1', reserveId: 'r4', side: 'borrow', amountUsd: 8000, nativePercent: 4, incentivePercent: 1, totalPercent: -3, usdPerDay: -0.6575 },
      { positionId: 'b2', reserveId: 'r5', side: 'borrow', amountUsd: 3000, nativePercent: 6, incentivePercent: 0, totalPercent: -6, usdPerDay: -0.4932 },
    ];
    const summary = aggregatePortfolioSummary(results);
    expect(summary.totalSupplyUsd).toBe(35000);
    expect(summary.totalBorrowUsd).toBe(11000);
    expect(summary.netUsdPerDay).toBeCloseTo(results.reduce((s, r) => s + r.usdPerDay, 0), 2);
    expect(summary.netEffectiveApy).toBeGreaterThan(0);
  });
});

describe('resolvePositionAmountUsd', () => {
  const basePos: PortfolioPosition = {
    positionId: 'p1',
    reserveId: 'r1',
    marketName: 'M',
    chainName: 'C',
    tokenSymbol: 'T',
    side: 'supply',
    amount: '',
    inputMode: 'usd',
    walletValue: null,
    hidden: false,
    isOrphan: false,
  };

  it('returns 0 for empty amount', () => {
    expect(resolvePositionAmountUsd({ ...basePos, amount: '' }, undefined)).toBe(0);
  });

  it('returns raw value when inputMode is usd', () => {
    expect(resolvePositionAmountUsd({ ...basePos, amount: '5000' }, undefined)).toBe(5000);
  });

  it('multiplies by tokenPrice when inputMode is token', () => {
    const reserve = { tokenPrice: 2.5 } as ReserveWithSpread;
    expect(resolvePositionAmountUsd({ ...basePos, amount: '100', inputMode: 'token' }, reserve)).toBe(250);
  });

  it('returns 0 when token mode but no price', () => {
    expect(resolvePositionAmountUsd({ ...basePos, amount: '100', inputMode: 'token' }, undefined)).toBe(0);
  });

  it('returns 0 when token mode but price is 0', () => {
    const reserve = { tokenPrice: 0 } as ReserveWithSpread;
    expect(resolvePositionAmountUsd({ ...basePos, amount: '100', inputMode: 'token' }, reserve)).toBe(0);
  });
});

describe('buildPortfolioPositionResult', () => {
  const pos: PortfolioPosition = {
    positionId: 'p1',
    reserveId: 'r1',
    marketName: 'M',
    chainName: 'C',
    tokenSymbol: 'T',
    side: 'supply',
    amount: '10000',
    inputMode: 'usd',
    walletValue: null,
    hidden: false,
    isOrphan: false,
  };

  it('builds supply result with correct fields', () => {
    const result = buildPortfolioPositionResult(pos, 10000, 3, 1);
    expect(result.positionId).toBe('p1');
    expect(result.reserveId).toBe('r1');
    expect(result.side).toBe('supply');
    expect(result.amountUsd).toBe(10000);
    expect(result.nativePercent).toBe(3);
    expect(result.incentivePercent).toBe(1);
    expect(result.totalPercent).toBe(4);
    expect(result.usdPerDay).toBeGreaterThan(0);
  });

  it('builds borrow result with negative usdPerDay for net cost', () => {
    const borrowPos = { ...pos, side: 'borrow' as const };
    const result = buildPortfolioPositionResult(borrowPos, 10000, 5, 0);
    expect(result.side).toBe('borrow');
    expect(result.usdPerDay).toBeLessThan(0);
  });

  it('computes usdPerDay via computePositionUsdPerDay', () => {
    const result = buildPortfolioPositionResult(pos, 10000, 3.65, 0);
    const expected = computePositionUsdPerDay('supply', 10000, 3.65, 0);
    expect(result.usdPerDay).toBeCloseTo(expected, 10);
  });
});

describe('convertPortfolioInputAmount', () => {
  it('usd → token: divides amount by price', () => {
    // 5000 USD, price $2500/token → 2 tokens
    expect(convertPortfolioInputAmount(5000, 'usd', 'token', 2500)).toBeCloseTo(2, 10);
  });

  it('token → usd: multiplies amount by price', () => {
    // 2 tokens, price $2500/token → 5000 USD
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
    // 1000 USD, price $0.001/token → 1_000_000 tokens
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
