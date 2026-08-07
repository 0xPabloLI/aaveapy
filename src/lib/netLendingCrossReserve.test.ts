import { describe, it, expect } from 'vitest';
import {
  computeCrossReserveNetEligible,
  computeCrossReserveEligibilityRatio,
  computeCrossAssetNetEligible,
  computeCrossAssetEligibilityRatio,
} from './netLendingCrossReserve';
import type { NetPositionConstraint, CrossAssetPairing } from '@/types/aave';

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

// ============================================================
// AAV-895: Cross-Asset Pairing (min(1,2)) — frontend tests
// ============================================================

describe('computeCrossAssetNetEligible', () => {
  // cbETH (supply) / ETH (borrow) — discountFactor = 0.823
  const cbEthPairing: CrossAssetPairing = {
    sourceSide: 'borrow',
    pairedReserveId: 'r-cbeth',
    pairedSide: 'supply',
    discountFactor: 0.823,
  };

  // sUSDe (supply) / USDe (supply) — discountFactor = 1.196
  const sUsdePairing: CrossAssetPairing = {
    sourceSide: 'supply',
    pairedReserveId: 'r-susde',
    pairedSide: 'supply',
    discountFactor: 1.196,
  };

  const positions = new Map<string, { supplyUsd: number; borrowUsd: number }>([
    ['r-cbeth', { supplyUsd: 100, borrowUsd: 0 }],
    ['r-eth', { supplyUsd: 0, borrowUsd: 50 }],
    ['r-susde', { supplyUsd: 100, borrowUsd: 0 }],
    ['r-usde', { supplyUsd: 100, borrowUsd: 0 }],
  ]);

  // F1: cbETH/ETH normal path — source 50, paired supply 100, df=0.823
  it('F1: min(50, 100×0.823) = 50 (source is the binding constraint)', () => {
    const result = computeCrossAssetNetEligible({
      sourceGrossUsd: 50,
      pairing: cbEthPairing,
      crossReservePositions: positions,
    });
    expect(result).toBe(50);
  });

  // F2: cbETH/ETH paired insufficient — source 100, paired supply 50, df=0.823
  it('F2: min(100, 50×0.823) = 41.15 (paired is the binding constraint)', () => {
    const result = computeCrossAssetNetEligible({
      sourceGrossUsd: 100,
      pairing: cbEthPairing,
      crossReservePositions: new Map([
        ['r-cbeth', { supplyUsd: 50, borrowUsd: 0 }],
      ]),
    });
    expect(result).toBeCloseTo(41.15, 10);
  });

  // F3: paired reserve not in Map
  it('F3: paired not in Map → pairedUsd=0 → netEligible=0', () => {
    const result = computeCrossAssetNetEligible({
      sourceGrossUsd: 100,
      pairing: cbEthPairing,
      crossReservePositions: new Map(),
    });
    expect(result).toBe(0);
  });

  // F5: discountFactor = 0
  it('F5: discountFactor=0 → netEligible = min(source, 0) = 0', () => {
    const pairing: CrossAssetPairing = { ...cbEthPairing, discountFactor: 0 };
    const result = computeCrossAssetNetEligible({
      sourceGrossUsd: 100,
      pairing,
      crossReservePositions: positions,
    });
    expect(result).toBe(0);
  });

  // F6: discountFactor > 1 (sUSDe case)
  it('F6: discountFactor=1.196, source=100, paired=100 → min(100, 119.6) = 100', () => {
    const result = computeCrossAssetNetEligible({
      sourceGrossUsd: 100,
      pairing: sUsdePairing,
      crossReservePositions: positions,
    });
    expect(result).toBe(100);
  });

  // F6b: discountFactor > 1, paired < source
  it('F6b: discountFactor=1.196, source=100, paired=50 → min(100, 59.8) = 59.8', () => {
    const result = computeCrossAssetNetEligible({
      sourceGrossUsd: 100,
      pairing: sUsdePairing,
      crossReservePositions: new Map([
        ['r-susde', { supplyUsd: 50, borrowUsd: 0 }],
      ]),
    });
    expect(result).toBeCloseTo(59.8, 10);
  });

  // pairedSide = borrow
  it('pairedSide=borrow: reads borrowUsd from paired position', () => {
    const pairing: CrossAssetPairing = {
      sourceSide: 'supply',
      pairedReserveId: 'r-eth',
      pairedSide: 'borrow',
      discountFactor: 0.823,
    };
    const result = computeCrossAssetNetEligible({
      sourceGrossUsd: 100,
      pairing,
      crossReservePositions: positions,
    });
    // paired borrow = 50, 50 × 0.823 = 41.15
    expect(result).toBeCloseTo(41.15, 10);
  });
});

describe('computeCrossAssetEligibilityRatio', () => {
  const cbEthPairing: CrossAssetPairing = {
    sourceSide: 'borrow',
    pairedReserveId: 'r-cbeth',
    pairedSide: 'supply',
    discountFactor: 0.823,
  };

  const positions = new Map<string, { supplyUsd: number; borrowUsd: number }>([
    ['r-cbeth', { supplyUsd: 50, borrowUsd: 0 }],
  ]);

  // F2 ratio: 41.15 / 100 = 0.4115
  it('F2: ratio = 41.15/100 = 0.4115 when paired is binding', () => {
    const ratio = computeCrossAssetEligibilityRatio({
      sourceGrossUsd: 100,
      pairing: cbEthPairing,
      crossReservePositions: positions,
    });
    expect(ratio).toBeCloseTo(0.4115, 10);
  });

  // F4: sourceGrossUsd = 0 → ratio = 1
  it('F4: ratio = 1 when sourceGrossUsd = 0 (avoid divide-by-zero)', () => {
    const ratio = computeCrossAssetEligibilityRatio({
      sourceGrossUsd: 0,
      pairing: cbEthPairing,
      crossReservePositions: positions,
    });
    expect(ratio).toBe(1);
  });

  // F1 ratio: 50/50 = 1 (source is binding, no reduction)
  it('F1: ratio = 1 when source is binding (no reduction)', () => {
    const ratio = computeCrossAssetEligibilityRatio({
      sourceGrossUsd: 50,
      pairing: cbEthPairing,
      crossReservePositions: new Map([
        ['r-cbeth', { supplyUsd: 100, borrowUsd: 0 }],
      ]),
    });
    expect(ratio).toBe(1);
  });

  // F3 ratio: 0/100 = 0
  it('F3: ratio = 0 when paired not in Map', () => {
    const ratio = computeCrossAssetEligibilityRatio({
      sourceGrossUsd: 100,
      pairing: cbEthPairing,
      crossReservePositions: new Map(),
    });
    expect(ratio).toBe(0);
  });
});
