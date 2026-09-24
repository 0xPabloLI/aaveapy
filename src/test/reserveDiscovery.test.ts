import { describe, expect, it } from 'vitest';

import {
  AMOUNT_VARIANT_CAMPAIGN_TYPES,
  computeSupplyNetApyPercent,
  hasComputableSupplyIncentive,
  pickIncentiveReserve,
  type DiscoveryReserve,
} from '../../e2e/reserveDiscovery';

/**
 * AAV-1299 — e2e discovery robustness unit tests.
 *
 * Scenario matrix (from spec):
 * S1 valid campaign selected / S2 points-based selected / S3 apr=0 excluded /
 * S4 expired excluded / S5 not-started excluded / S6 AMOUNT variants excluded /
 * S7 merit-only excluded / S8 mixed campaigns pick effective / S9 empty data → null /
 * S10 sort by net supply APR desc
 */

const NOW = '2026-09-24T12:00:00Z';

function breakdown(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    campaignId: 'c1',
    campaignApr: 5,
    campaignStartedAt: '2026-09-01T00:00:00Z',
    campaignEndedAt: '2026-10-01T00:00:00Z',
    campaignType: 'MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
    ...overrides,
  };
}

function reserve(overrides: Record<string, unknown> = {}): DiscoveryReserve {
  return {
    reserveId: 'r1',
    tokenSymbol: 'USDC',
    marketName: 'AaveV3Ethereum',
    chainName: 'Ethereum',
    chainId: 1,
    ltv: 80,
    isFrozen: false,
    isPaused: false,
    isActive: true,
    supplyDisabled: false,
    supplyApy: 3,
    tokenPrice: 1,
    suppliable: '1000000000',
    merklSupplys: [{ link: 'x', breakdowns: [breakdown()] }],
    ...overrides,
  } as DiscoveryReserve;
}

const group = (...bs: Record<string, unknown>[]) => ({ link: 'x', breakdowns: bs });

describe('AMOUNT_VARIANT_CAMPAIGN_TYPES', () => {
  it('covers the three AMOUNT-variant campaign types', () => {
    expect(AMOUNT_VARIANT_CAMPAIGN_TYPES).toEqual(
      expect.arrayContaining([
        'FIX_REWARD_AMOUNT_PER_LIQUIDITY_VALUE',
        'FIX_REWARD_AMOUNT_PER_LIQUIDITY_AMOUNT',
        'MAX_REWARD_VALUE_PER_LIQUIDITY_AMOUNT',
      ]),
    );
  });
});

describe('hasComputableSupplyIncentive', () => {
  it('S1: selects a reserve with a valid positive-APR campaign', () => {
    expect(hasComputableSupplyIncentive(reserve(), NOW)).toBe(true);
  });

  it('S2: selects a points-based campaign (campaignApr absent, points > 0)', () => {
    const r = reserve({
      merklSupplys: [group(breakdown({ campaignApr: 0, pointsPerThousandUsd: 2 }))],
    });
    expect(hasComputableSupplyIncentive(r, NOW)).toBe(true);
  });

  it('S3: excludes campaign with apr=0 and no points', () => {
    const r = reserve({ merklSupplys: [breakdown({ campaignApr: 0 })] });
    expect(hasComputableSupplyIncentive(r, NOW)).toBe(false);
  });

  it('S3b: excludes TARGET_TOTAL_APR with apr=0 (nativeAPY >= target)', () => {
    const r = reserve({
      merklSupplys: [breakdown({ campaignApr: 0, campaignType: 'TARGET_TOTAL_APR' })],
    });
    expect(hasComputableSupplyIncentive(r, NOW)).toBe(false);
  });

  it('S4: excludes expired campaign', () => {
    const r = reserve({
      merklSupplys: [breakdown({ campaignEndedAt: '2026-09-20T00:00:00Z' })],
    });
    expect(hasComputableSupplyIncentive(r, NOW)).toBe(false);
  });

  it('S5: excludes not-yet-started campaign', () => {
    const r = reserve({
      merklSupplys: [breakdown({ campaignStartedAt: '2026-10-01T00:00:00Z' })],
    });
    expect(hasComputableSupplyIncentive(r, NOW)).toBe(false);
  });

  it.each(AMOUNT_VARIANT_CAMPAIGN_TYPES)('S6: excludes AMOUNT variant %s', (type) => {
    const r = reserve({ merklSupplys: [breakdown({ campaignType: type, campaignApr: 50 })] });
    expect(hasComputableSupplyIncentive(r, NOW)).toBe(false);
  });

  it('S7: excludes merit-only reserves (Merit is fully retired)', () => {
    const r = reserve({ merklSupplys: [], meritSupplys: [breakdown()] });
    expect(hasComputableSupplyIncentive(r, NOW)).toBe(false);
  });

  it('S8: selects when at least one campaign among many is effective', () => {
    const r = reserve({
      merklSupplys: [
        group(
          breakdown({ campaignId: 'expired', campaignEndedAt: '2026-09-20T00:00:00Z' }),
          breakdown({ campaignId: 'amount', campaignType: 'FIX_REWARD_AMOUNT_PER_LIQUIDITY_VALUE' }),
          breakdown({ campaignId: 'ok', campaignApr: 2.5 }),
        ),
      ],
    });
    expect(hasComputableSupplyIncentive(r, NOW)).toBe(true);
  });

  it('treats missing merklSupplys as no incentive', () => {
    const r = reserve({ merklSupplys: undefined });
    expect(hasComputableSupplyIncentive(r, NOW)).toBe(false);
  });
});

describe('computeSupplyNetApyPercent', () => {
  it('sums native supply APY and effective campaign APRs', () => {
    const r = reserve({
      supplyApy: 3,
      merklSupplys: [
        group(
          breakdown({ campaignId: 'a', campaignApr: 2 }),
          breakdown({ campaignId: 'b', campaignApr: 1.5 }),
          breakdown({ campaignId: 'expired', campaignApr: 99, campaignEndedAt: '2026-09-20T00:00:00Z' }),
        ),
      ],
    });
    expect(computeSupplyNetApyPercent(r, NOW)).toBeCloseTo(6.5);
  });
});

describe('pickIncentiveReserve', () => {
  it('S9: returns null for empty or unusable data', () => {
    expect(pickIncentiveReserve([], NOW)).toBeNull();
    expect(pickIncentiveReserve([reserve({ isFrozen: true })], NOW)).toBeNull();
    expect(pickIncentiveReserve([reserve({ ltv: 0 })], NOW)).toBeNull();
  });

  it('S10: prefers higher net supply APR', () => {
    const low = reserve({ reserveId: 'low', supplyApy: 1, merklSupplys: [group(breakdown({ campaignApr: 1 }))] });
    const high = reserve({ reserveId: 'high', supplyApy: 2, merklSupplys: [group(breakdown({ campaignApr: 4 }))] });
    const picked = pickIncentiveReserve([low, high], NOW);
    expect(picked?.reserveId).toBe('high');
  });

  it('prefers reserves with nonzero supply room over room-less ones', () => {
    const noRoom = reserve({
      reserveId: 'no-room',
      supplyApy: 10,
      merklSupplys: [group(breakdown({ campaignApr: 9 }))],
      suppliable: '0',
      supplyCap: '1000',
      supplied: '1000',
    });
    const withRoom = reserve({ reserveId: 'with-room', merklSupplys: [group(breakdown({ campaignApr: 1 }))] });
    const picked = pickIncentiveReserve([noRoom, withRoom], NOW);
    expect(picked?.reserveId).toBe('with-room');
  });

  it('returns null when no candidate has a computable incentive (S3/S4/S6/S7 combined)', () => {
    const candidates = [
      reserve({ reserveId: 'a', merklSupplys: [breakdown({ campaignApr: 0 })] }),
      reserve({ reserveId: 'b', meritSupplys: [breakdown()], merklSupplys: [] }),
    ];
    expect(pickIncentiveReserve(candidates, NOW)).toBeNull();
  });
});
