import { describe, it, expect } from 'vitest';
import {
  computeCrossReserveNetEligible,
  computeCrossReserveEligibilityRatio,
  buildCrossReservePositionsFromPerReserveInputs,
} from './netLendingCrossReserve';
import type { NetPositionConstraint } from '@/types/aave';
import type { PerReserveInput } from '@/lib/portfolioSimulator';

describe('computeCrossReserveNetEligible', () => {
  const crossReservePositions = new Map<string, { supplyUsd: number; borrowUsd: number }>([
    ['r-usdt0', { supplyUsd: 100, borrowUsd: 0 }],
    ['r-usde', { supplyUsd: 0, borrowUsd: 40 }],
    ['r-gho', { supplyUsd: 0, borrowUsd: 30 }],
  ]);

  it('supply side: net = supply - sum(offset borrows)', () => {
    const constraint: NetPositionConstraint = {
      sourceSide: 'supply',
      offsetReserveIds: ['r-usde', 'r-gho'],
    };
    const result = computeCrossReserveNetEligible({
      sourceSide: 'supply',
      sourceGrossUsd: 100,
      constraint,
      crossReservePositions,
    });
    expect(result).toBe(30); // 100 - (40 + 30)
  });

  it('borrow side: net = borrow - sum(offset supplies)', () => {
    const borrowPositions = new Map<string, { supplyUsd: number; borrowUsd: number }>([
      ['r-gho', { supplyUsd: 0, borrowUsd: 100 }],
      ['r-usdt0', { supplyUsd: 60, borrowUsd: 0 }],
      ['r-usde', { supplyUsd: 20, borrowUsd: 0 }],
    ]);
    const constraint: NetPositionConstraint = {
      sourceSide: 'borrow',
      offsetReserveIds: ['r-usdt0', 'r-usde'],
    };
    const result = computeCrossReserveNetEligible({
      sourceSide: 'borrow',
      sourceGrossUsd: 100,
      constraint,
      crossReservePositions: borrowPositions,
    });
    expect(result).toBe(20); // 100 - (60 + 20)
  });

  it('net clamped to 0 when fully offset', () => {
    const constraint: NetPositionConstraint = {
      sourceSide: 'supply',
      offsetReserveIds: ['r-usde', 'r-gho'],
    };
    const result = computeCrossReserveNetEligible({
      sourceSide: 'supply',
      sourceGrossUsd: 50,
      constraint,
      crossReservePositions,
    });
    expect(result).toBe(0); // max(50 - 70, 0) = 0
  });

  it('skips offset reserve not found in map', () => {
    const constraint: NetPositionConstraint = {
      sourceSide: 'supply',
      offsetReserveIds: ['r-usde', 'r-unknown'],
    };
    const result = computeCrossReserveNetEligible({
      sourceSide: 'supply',
      sourceGrossUsd: 100,
      constraint,
      crossReservePositions,
    });
    expect(result).toBe(60); // 100 - 40 (r-unknown skipped)
  });

  it('no constraint → falls back to gross', () => {
    const result = computeCrossReserveNetEligible({
      sourceSide: 'supply',
      sourceGrossUsd: 100,
      constraint: undefined,
      crossReservePositions,
    });
    expect(result).toBe(100);
  });

  it('empty offsetReserveIds → net equals gross', () => {
    const constraint: NetPositionConstraint = {
      sourceSide: 'supply',
      offsetReserveIds: [],
    };
    const result = computeCrossReserveNetEligible({
      sourceSide: 'supply',
      sourceGrossUsd: 100,
      constraint,
      crossReservePositions,
    });
    expect(result).toBe(100);
  });
});

describe('computeCrossReserveEligibilityRatio', () => {
  const crossReservePositions = new Map<string, { supplyUsd: number; borrowUsd: number }>([
    ['r-usdt0', { supplyUsd: 100, borrowUsd: 0 }],
    ['r-usde', { supplyUsd: 0, borrowUsd: 40 }],
  ]);

  it('returns ratio = netEligible / grossUsd for supply', () => {
    const constraint: NetPositionConstraint = {
      sourceSide: 'supply',
      offsetReserveIds: ['r-usde'],
    };
    const ratio = computeCrossReserveEligibilityRatio({
      sourceSide: 'supply',
      sourceGrossUsd: 100,
      constraint,
      crossReservePositions,
    });
    expect(ratio).toBe(0.6); // (100 - 40) / 100
  });

  it('returns 0 when fully offset', () => {
    const constraint: NetPositionConstraint = {
      sourceSide: 'supply',
      offsetReserveIds: ['r-usde'],
    };
    const ratio = computeCrossReserveEligibilityRatio({
      sourceSide: 'supply',
      sourceGrossUsd: 30,
      constraint,
      crossReservePositions,
    });
    expect(ratio).toBe(0);
  });

  it('returns 1 when no constraint (fallback)', () => {
    const ratio = computeCrossReserveEligibilityRatio({
      sourceSide: 'supply',
      sourceGrossUsd: 100,
      constraint: undefined,
      crossReservePositions,
    });
    expect(ratio).toBe(1);
  });

  it('returns 1 when grossUsd is 0', () => {
    const constraint: NetPositionConstraint = {
      sourceSide: 'supply',
      offsetReserveIds: ['r-usde'],
    };
    const ratio = computeCrossReserveEligibilityRatio({
      sourceSide: 'supply',
      sourceGrossUsd: 0,
      constraint,
      crossReservePositions,
    });
    expect(ratio).toBe(1);
  });
});

describe('buildCrossReservePositionsFromPerReserveInputs', () => {
  it('builds map from perReserveInputs with totalSupplyUsd/totalBorrowUsd', () => {
    const inputs = new Map<string, PerReserveInput>([
      ['r-usdc', { supplyInput: '500', borrowInput: '0', inputMode: 'usd', totalSupplyUsd: 1500, totalBorrowUsd: 200 }],
      ['r-gho', { supplyInput: '0', borrowInput: '100', inputMode: 'usd', totalSupplyUsd: 0, totalBorrowUsd: 100 }],
    ]);
    const result = buildCrossReservePositionsFromPerReserveInputs(inputs);
    expect(result).toBeDefined();
    expect(result!.get('r-usdc')).toEqual({ supplyUsd: 1500, borrowUsd: 200 });
    expect(result!.get('r-gho')).toEqual({ supplyUsd: 0, borrowUsd: 100 });
  });

  it('returns undefined when all positions are zero', () => {
    const inputs = new Map<string, PerReserveInput>([
      ['r-usdc', { supplyInput: '0', borrowInput: '0', inputMode: 'usd', totalSupplyUsd: 0, totalBorrowUsd: 0 }],
    ]);
    expect(buildCrossReservePositionsFromPerReserveInputs(inputs)).toBeUndefined();
  });

  it('returns undefined for empty map', () => {
    expect(buildCrossReservePositionsFromPerReserveInputs(new Map())).toBeUndefined();
  });

  it('treats undefined totalSupplyUsd/totalBorrowUsd as 0', () => {
    const inputs = new Map<string, PerReserveInput>([
      ['r-usdc', { supplyInput: '100', borrowInput: '0', inputMode: 'usd' }],
    ]);
    expect(buildCrossReservePositionsFromPerReserveInputs(inputs)).toBeUndefined();
  });

  it('includes reserve with only supply position', () => {
    const inputs = new Map<string, PerReserveInput>([
      ['r-usdc', { supplyInput: '500', borrowInput: '0', inputMode: 'usd', totalSupplyUsd: 500, totalBorrowUsd: 0 }],
    ]);
    const result = buildCrossReservePositionsFromPerReserveInputs(inputs);
    expect(result).toBeDefined();
    expect(result!.get('r-usdc')).toEqual({ supplyUsd: 500, borrowUsd: 0 });
  });

  it('includes reserve with only borrow position', () => {
    const inputs = new Map<string, PerReserveInput>([
      ['r-gho', { supplyInput: '0', borrowInput: '200', inputMode: 'usd', totalSupplyUsd: 0, totalBorrowUsd: 200 }],
    ]);
    const result = buildCrossReservePositionsFromPerReserveInputs(inputs);
    expect(result).toBeDefined();
    expect(result!.get('r-gho')).toEqual({ supplyUsd: 0, borrowUsd: 200 });
  });

  it('skips reserve with both zero but includes others with non-zero', () => {
    const inputs = new Map<string, PerReserveInput>([
      ['r-empty', { supplyInput: '0', borrowInput: '0', inputMode: 'usd', totalSupplyUsd: 0, totalBorrowUsd: 0 }],
      ['r-usdc', { supplyInput: '500', borrowInput: '0', inputMode: 'usd', totalSupplyUsd: 500, totalBorrowUsd: 0 }],
    ]);
    const result = buildCrossReservePositionsFromPerReserveInputs(inputs);
    expect(result).toBeDefined();
    expect(result!.has('r-empty')).toBe(false);
    expect(result!.get('r-usdc')).toEqual({ supplyUsd: 500, borrowUsd: 0 });
  });
});
