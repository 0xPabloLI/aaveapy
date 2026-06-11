import { describe, it, expect } from 'vitest';
import {
  computeCrossReserveNetEligible,
  computeCrossReserveEligibilityRatio,
} from './netLendingCrossReserve';
import type { NetPositionConstraint } from '@/types/aave';

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
