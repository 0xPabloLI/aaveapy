import { describe, expect, it } from 'vitest';

import {
  AMOUNT_VARIANT_CAMPAIGN_TYPES,
  computeSupplyNetApyPercent,
  discoverOffsetScenarios,
  hasComputableSupplyIncentive,
  isComputableMerklCampaign,
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
 *
 * AAV-1280 — discovery/UI render-gate alignment (isComputableMerklCampaign M1-M5,
 * discoverOffsetScenarios O1-O14): see docs/specs/aav-1280-offset-discovery-computability.md
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

describe('isComputableMerklCampaign — UI gate alignment (AAV-1280)', () => {
  it('M1: excludes breakdown with missing campaignStartedAt (UI: no start → not counted)', () => {
    expect(isComputableMerklCampaign(breakdown({ campaignStartedAt: undefined }), NOW)).toBe(false);
  });

  it('M2: excludes breakdown with missing campaignEndedAt (Merkl never open-end)', () => {
    expect(isComputableMerklCampaign(breakdown({ campaignEndedAt: undefined }), NOW)).toBe(false);
  });

  it('M3: excludes invalid boundary date strings', () => {
    expect(isComputableMerklCampaign(breakdown({ campaignStartedAt: 'not-a-date' }), NOW)).toBe(false);
    expect(isComputableMerklCampaign(breakdown({ campaignEndedAt: 'not-a-date' }), NOW)).toBe(false);
  });

  it('M4: normalizes date-only boundaries (end day inclusive, mirrors isCampaignActive)', () => {
    expect(isComputableMerklCampaign(breakdown({ campaignEndedAt: '2026-09-24' }), NOW)).toBe(true);
    expect(isComputableMerklCampaign(breakdown({ campaignEndedAt: '2026-09-23' }), NOW)).toBe(false);
    expect(
      isComputableMerklCampaign(breakdown({ campaignStartedAt: '2026-09-24', campaignEndedAt: '2026-10-01' }), NOW),
    ).toBe(true);
  });

  it('M5: excludes whitelist-only breakdown (e2e never opts into whitelist campaigns)', () => {
    expect(isComputableMerklCampaign(breakdown({ whitelistOnly: true }), NOW)).toBe(false);
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

describe('discoverOffsetScenarios (AAV-1280)', () => {
  const SELF = '1:0x123:0xspoke';
  const OTHER = '1:0xabc:0xother';

  const offsetGroup = (offsets: string[], ...bs: Record<string, unknown>[]) => ({
    link: 'x',
    netPositionConstraint: { sourceSide: 'supply', offsetReserveIds: offsets },
    breakdowns: bs,
  });

  const targetReserve = (overrides: Record<string, unknown> = {}): DiscoveryReserve =>
    reserve({
      reserveId: SELF,
      tokenSymbol: 'USDT',
      chainName: 'Celo',
      marketName: 'AaveV4Celo',
      merklSupplys: [offsetGroup([SELF], breakdown({ campaignApr: 2 }))],
      ...overrides,
    });

  it('O1: discovers a self-loop scenario from a computable constrained group', () => {
    const scenarios = discoverOffsetScenarios([targetReserve()], NOW);
    expect(scenarios).toHaveLength(1);
    expect(scenarios[0]).toMatchObject({
      type: 'self-loop',
      targetReserveId: SELF,
      targetSymbol: 'USDT',
      targetApr: 2,
      chainName: 'Celo',
    });
  });

  it('O2: discovers a cross-reserve scenario using nonSelf[0] as offset', () => {
    const offset = reserve({ reserveId: OTHER, tokenSymbol: 'WETH', chainName: 'Celo', merklSupplys: [] });
    const target = targetReserve({ merklSupplys: [offsetGroup([SELF, OTHER], breakdown({ campaignApr: 2 }))] });
    const scenarios = discoverOffsetScenarios([target, offset], NOW);
    expect(scenarios).toHaveLength(1);
    expect(scenarios[0]).toMatchObject({
      type: 'cross-reserve',
      targetReserveId: SELF,
      offsetReserveId: OTHER,
      offsetSymbol: 'WETH',
      offsetMarketLabel: 'Celo',
    });
  });

  it('O3: sums only computable breakdowns — expired high-APR ignored (AAV-1280 regression)', () => {
    const r = targetReserve({
      merklSupplys: [
        offsetGroup(
          [SELF],
          breakdown({ campaignId: 'big-expired', campaignApr: 50, campaignEndedAt: '2026-09-20T00:00:00Z' }),
          breakdown({ campaignId: 'small-live', campaignApr: 1.5 }),
        ),
      ],
    });
    const scenarios = discoverOffsetScenarios([r], NOW);
    expect(scenarios).toHaveLength(1);
    expect(scenarios[0].targetApr).toBeCloseTo(1.5);
  });

  it('O4: skips groups whose breakdowns are all unrenderable (original failure shape → skip, not fail)', () => {
    const expired = targetReserve({
      merklSupplys: [offsetGroup([SELF], breakdown({ campaignApr: 50, campaignEndedAt: '2026-09-20T00:00:00Z' }))],
    });
    const amount = targetReserve({
      reserveId: 'amount',
      merklSupplys: [
        offsetGroup([SELF], breakdown({ campaignApr: 50, campaignType: 'FIX_REWARD_AMOUNT_PER_LIQUIDITY_VALUE' })),
      ],
    });
    const noEnd = targetReserve({
      reserveId: 'no-end',
      merklSupplys: [offsetGroup([SELF], breakdown({ campaignApr: 50, campaignEndedAt: undefined }))],
    });
    const whitelist = targetReserve({
      reserveId: 'wl',
      merklSupplys: [offsetGroup([SELF], breakdown({ campaignApr: 50, whitelistOnly: true }))],
    });
    expect(discoverOffsetScenarios([expired], NOW)).toEqual([]);
    expect(discoverOffsetScenarios([amount], NOW)).toEqual([]);
    expect(discoverOffsetScenarios([noEnd], NOW)).toEqual([]);
    expect(discoverOffsetScenarios([whitelist], NOW)).toEqual([]);
  });

  it('O5: skips points-only group (proportional assertions need percent APR)', () => {
    const r = targetReserve({
      merklSupplys: [offsetGroup([SELF], breakdown({ campaignApr: 0, pointsPerThousandUsd: 3 }))],
    });
    expect(discoverOffsetScenarios([r], NOW)).toEqual([]);
  });

  it('O6: skips unusable targets (frozen/paused/inactive/supplyDisabled/ltv=0/no room)', () => {
    expect(discoverOffsetScenarios([targetReserve({ isFrozen: true })], NOW)).toEqual([]);
    expect(discoverOffsetScenarios([targetReserve({ isPaused: true })], NOW)).toEqual([]);
    expect(discoverOffsetScenarios([targetReserve({ isActive: false })], NOW)).toEqual([]);
    expect(discoverOffsetScenarios([targetReserve({ supplyDisabled: true })], NOW)).toEqual([]);
    expect(discoverOffsetScenarios([targetReserve({ ltv: 0 })], NOW)).toEqual([]);
    const noRoom = targetReserve({ suppliable: '0', supplyCap: '1000', supplied: '1000' });
    expect(discoverOffsetScenarios([noRoom], NOW)).toEqual([]);
  });

  it('O7: skips cross-reserve when offset reserve is unusable/unborrowable/missing', () => {
    const target = targetReserve({ merklSupplys: [offsetGroup([SELF, OTHER], breakdown({ campaignApr: 2 }))] });
    const cases = [
      reserve({ reserveId: OTHER, merklSupplys: [], isFrozen: true }),
      reserve({ reserveId: OTHER, merklSupplys: [], ltv: 0 }),
      reserve({ reserveId: OTHER, merklSupplys: [], borrowDisabled: true }),
      reserve({ reserveId: OTHER, merklSupplys: [], suppliable: '0', supplyCap: '5', supplied: '5' }),
    ];
    for (const offset of cases) {
      expect(discoverOffsetScenarios([target, offset], NOW)).toEqual([]);
    }
    expect(discoverOffsetScenarios([target], NOW)).toEqual([]);
  });

  it('O8: dedups by reserveId+type — first qualifying group wins', () => {
    const r = targetReserve({
      merklSupplys: [
        offsetGroup([SELF], breakdown({ campaignId: 'g1', campaignApr: 2 })),
        offsetGroup([SELF], breakdown({ campaignId: 'g2', campaignApr: 5 })),
      ],
    });
    const scenarios = discoverOffsetScenarios([r], NOW);
    expect(scenarios).toHaveLength(1);
    expect(scenarios[0].targetApr).toBeCloseTo(2);
  });

  it('O9: sorts cross-reserve first, then by target APR descending', () => {
    const a = targetReserve({ reserveId: 'a', merklSupplys: [offsetGroup(['a'], breakdown({ campaignApr: 1 }))] });
    const b = targetReserve({ reserveId: 'b', merklSupplys: [offsetGroup(['b'], breakdown({ campaignApr: 3 }))] });
    const c = targetReserve({
      reserveId: 'c',
      merklSupplys: [offsetGroup(['c', 'other'], breakdown({ campaignApr: 0.5 }))],
    });
    const offsetOther = reserve({ reserveId: 'other', merklSupplys: [] });
    const scenarios = discoverOffsetScenarios([a, b, c, offsetOther], NOW);
    expect(scenarios.map((s) => `${s.type}:${s.targetReserveId}`)).toEqual([
      'cross-reserve:c',
      'self-loop:b',
      'self-loop:a',
    ]);
  });

  it('O10: returns [] for empty input and skips groups without a constraint', () => {
    expect(discoverOffsetScenarios([], NOW)).toEqual([]);
    const noConstraint = targetReserve({ merklSupplys: [group(breakdown({ campaignApr: 9 }))] });
    expect(discoverOffsetScenarios([noConstraint], NOW)).toEqual([]);
  });

  it('O11: derives targetMarketLabel via getMarketChipLabel (Ethereum Core)', () => {
    const r = reserve({ reserveId: 'eth', merklSupplys: [offsetGroup(['eth'], breakdown({ campaignApr: 1 }))] });
    const scenarios = discoverOffsetScenarios([r], NOW);
    expect(scenarios).toHaveLength(1);
    expect(scenarios[0].targetMarketLabel).toBe('Core');
  });
});
