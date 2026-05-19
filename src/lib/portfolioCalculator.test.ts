import { describe, it, expect } from 'vitest';
import {
  aggregatePortfolioSummary,
  computePositionUsdPerDay,
} from './portfolioCalculator';
import type { PortfolioPositionResult } from '@/types/portfolio';

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
