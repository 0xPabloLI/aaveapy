import { describe, expect, it } from 'vitest';

import {
  AMOUNT_VARIANT_CAMPAIGN_TYPES,
  PAIRING_SIM_MIN_ROOM_USD,
  computeSupplyNetApyPercent,
  discoverCrossAssetPairingScenarios,
  discoverOffsetScenarios,
  getBorrowRoomUsd,
  getMarketChipLabel,
  getSupplyRoomUsd,
  hasComputableSupplyIncentive,
  isComputableMerklCampaign,
  pickIncentiveReserve,
  type DiscoveryReserve,
} from '../../e2e/reserveDiscovery';

// The UI label the portfolio Add button actually renders — the e2e mirror must
// agree with it (AAV-1308 review).
import { getMarketChipLabel as appGetMarketChipLabel } from '@/lib/marketLabels';

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
    const offset = reserve({
      reserveId: OTHER,
      tokenSymbol: 'WETH',
      chainName: 'Celo',
      marketName: 'AaveV4Celo',
      merklSupplys: [],
    });
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

// ─── AAV-1308: cross-asset pairing discovery (P series) ──────────────
//
// Scenario matrix rows P1-P22 live in
// docs/specs/aav-1308-cross-asset-pairing-discovery.md. Fixtures use 6-decimals
// tokens with realistic room so the position-feasibility gates are exercised
// against real data shapes (AAV-1280 evidence-hygiene rule).

/**
 * Room floor the discovery requires, i.e. the largest amount the pairing runner
 * types on one reserve. Imported so a runner amount change moves the boundary
 * tests with it; the gate relation (below floor → excluded, at floor → kept) is
 * what these tests pin, and `usd()` below keeps the conversions off floats.
 */
const MIN_ROOM = PAIRING_SIM_MIN_ROOM_USD;

/** Raw 6-dec units for a given USD notional at price 1. */
const usd = (value: number) => String(BigInt(Math.round(value * 1e6)));

function pairingReserve(overrides: Record<string, unknown> = {}): DiscoveryReserve {
  return reserve({
    decimals: 6,
    tokenPrice: 1,
    suppliable: usd(MIN_ROOM * 10),
    borrowable: usd(MIN_ROOM * 10),
    merklSupplys: [],
    ...overrides,
  });
}

const pairing = (overrides: Record<string, unknown> = {}) => ({
  sourceSide: 'supply',
  pairedReserveId: 'paired',
  pairedSide: 'supply',
  discountFactor: 0.85,
  ...overrides,
});

const pairGroup = (side: 'supply' | 'borrow', overrides: Record<string, unknown>, ...bs: Record<string, unknown>[]) =>
  side === 'supply'
    ? { link: 'x', crossAssetPairing: pairing(overrides), breakdowns: bs }
    : { link: 'x', crossAssetPairing: pairing({ sourceSide: 'borrow', ...overrides }), breakdowns: bs };

const PAIRED = () => pairingReserve({ reserveId: 'paired', tokenSymbol: 'WETH' });

describe('discoverCrossAssetPairingScenarios (AAV-1308)', () => {
  it('P1: discovers a computable supply-side pairing and carries every runner field', () => {
    const source = pairingReserve({
      reserveId: 'src',
      tokenSymbol: 'USDC',
      merklSupplys: [pairGroup('supply', {}, breakdown({ campaignApr: 4 }))],
    });
    const scenarios = discoverCrossAssetPairingScenarios([source, PAIRED()], NOW);
    expect(scenarios).toHaveLength(1);
    expect(scenarios[0]).toEqual({
      sourceSymbol: 'USDC',
      sourceMarketLabel: 'Core',
      sourceReserveId: 'src',
      sourceSide: 'supply',
      pairedSymbol: 'WETH',
      pairedMarketLabel: 'Core',
      pairedReserveId: 'paired',
      pairedSide: 'supply',
      discountFactor: 0.85,
      chainName: 'Ethereum',
      apr: 4,
    });
  });

  it('P2: discovers a borrow-side pairing from merklBorrows (both sides gated)', () => {
    const source = pairingReserve({
      reserveId: 'src',
      tokenSymbol: 'cbETH',
      merklBorrows: [pairGroup('borrow', {}, breakdown({ campaignApr: 3 }))],
    });
    const scenarios = discoverCrossAssetPairingScenarios([source, PAIRED()], NOW);
    expect(scenarios).toHaveLength(1);
    expect(scenarios[0]).toMatchObject({ sourceSide: 'borrow', sourceSymbol: 'cbETH', apr: 3 });
  });

  it('P3: sums only computable breakdowns — expired high-APR excluded from apr', () => {
    const source = pairingReserve({
      reserveId: 'src',
      merklSupplys: [
        pairGroup(
          'supply',
          {},
          breakdown({ campaignId: 'expired', campaignApr: 90, campaignEndedAt: '2026-09-20T00:00:00Z' }),
          breakdown({ campaignId: 'live', campaignApr: 1.5 }),
        ),
      ],
    });
    const scenarios = discoverCrossAssetPairingScenarios([source, PAIRED()], NOW);
    expect(scenarios).toHaveLength(1);
    expect(scenarios[0].apr).toBeCloseTo(1.5);
  });

  it.each([
    ['expired', { campaignEndedAt: '2026-09-20T00:00:00Z' }],
    ['whitelist-only', { whitelistOnly: true }],
    ['AMOUNT variant', { campaignType: 'FIX_REWARD_AMOUNT_PER_LIQUIDITY_AMOUNT' }],
    ['open-ended (no end boundary)', { campaignEndedAt: undefined }],
  ])('P4: %s campaign is never selected (AAV-1308 failure shape → skip)', (_label, override) => {
    const source = pairingReserve({
      reserveId: 'src',
      merklSupplys: [pairGroup('supply', {}, breakdown({ campaignApr: 50, ...override }))],
      merklBorrows: [pairGroup('borrow', {}, breakdown({ campaignApr: 50, ...override }))],
    });
    expect(discoverCrossAssetPairingScenarios([source, PAIRED()], NOW)).toEqual([]);
  });

  it('P5: skips points-only group (proportional assertions need percent APR)', () => {
    const source = pairingReserve({
      reserveId: 'src',
      merklSupplys: [pairGroup('supply', {}, breakdown({ campaignApr: 0, pointsPerThousandUsd: 8 }))],
    });
    expect(discoverCrossAssetPairingScenarios([source, PAIRED()], NOW)).toEqual([]);
  });

  it('P12: skips when the paired reserve is absent from the payload', () => {
    const source = pairingReserve({
      reserveId: 'src',
      merklSupplys: [pairGroup('supply', { pairedReserveId: 'ghost' }, breakdown({ campaignApr: 4 }))],
    });
    expect(discoverCrossAssetPairingScenarios([source], NOW)).toEqual([]);
  });

  it('P15: returns [] for empty input, side without groups, and null pairing', () => {
    expect(discoverCrossAssetPairingScenarios([], NOW)).toEqual([]);
    const noGroups = pairingReserve({ reserveId: 'src', merklSupplys: [group(breakdown())] });
    expect(discoverCrossAssetPairingScenarios([noGroups, PAIRED()], NOW)).toEqual([]);
    const nullPairing = pairingReserve({
      reserveId: 'src',
      merklSupplys: [{ link: 'x', crossAssetPairing: null, breakdowns: [breakdown()] }],
    });
    expect(discoverCrossAssetPairingScenarios([nullPairing, PAIRED()], NOW)).toEqual([]);
  });

  it('P16: ignores pairing.sourceSide when it contradicts the group side (mirrors the UI)', () => {
    const source = pairingReserve({
      reserveId: 'src',
      merklSupplys: [
        {
          link: 'x',
          crossAssetPairing: pairing({ sourceSide: 'borrow' }),
          breakdowns: [breakdown({ campaignApr: 2 })],
        },
      ],
    });
    const scenarios = discoverCrossAssetPairingScenarios([source, PAIRED()], NOW);
    expect(scenarios).toHaveLength(1);
    expect(scenarios[0].sourceSide).toBe('supply');
  });

  it('P6: rejects an endpoint that is frozen / paused / inactive / ltv=0 / supplyDisabled', () => {
    const source = pairingReserve({
      reserveId: 'src',
      merklBorrows: [pairGroup('borrow', {}, breakdown({ campaignApr: 4 }))],
    });
    const badEndpoints: Record<string, unknown>[] = [
      { isFrozen: true },
      { isPaused: true },
      { isActive: false },
      { ltv: 0 },
      { supplyDisabled: true },
    ];
    for (const badSource of badEndpoints) {
      expect(discoverCrossAssetPairingScenarios([pairingReserve({ ...source, ...badSource }), PAIRED()], NOW)).toEqual(
        [],
      );
    }
    for (const badPaired of badEndpoints) {
      expect(discoverCrossAssetPairingScenarios([source, { ...PAIRED(), ...badPaired }], NOW)).toEqual([]);
    }
  });

  it('P7: supply room floor — below excludes, exactly at the floor keeps, absent data keeps', () => {
    const source = pairingReserve({
      reserveId: 'src',
      merklSupplys: [pairGroup('supply', {}, breakdown({ campaignApr: 4 }))],
    });
    const floorCases = [
      { label: 'below the floor', fields: { suppliable: usd(MIN_ROOM - 1) }, expected: 0 },
      { label: 'exactly the floor', fields: { suppliable: usd(MIN_ROOM) }, expected: 1 },
      {
        label: 'no room data at all',
        fields: { suppliable: undefined, supplyCap: undefined, supplied: undefined },
        expected: 1,
      },
    ] as const;
    for (const { label, fields, expected } of floorCases) {
      expect(
        discoverCrossAssetPairingScenarios([source, { ...PAIRED(), ...fields }], NOW),
        `partner: ${label}`,
      ).toHaveLength(expected);
      expect(
        discoverCrossAssetPairingScenarios([{ ...source, ...fields }, PAIRED()], NOW),
        `source: ${label}`,
      ).toHaveLength(expected);
    }
  });

  it('P8: only the endpoint that carries a borrow needs borrow room', () => {
    const supplySource = pairingReserve({
      reserveId: 'src',
      merklSupplys: [pairGroup('supply', {}, breakdown({ campaignApr: 4 }))],
    });
    const borrowSource = pairingReserve({
      reserveId: 'src',
      merklBorrows: [pairGroup('borrow', {}, breakdown({ campaignApr: 4 }))],
    });
    const pairedBorrowSource = pairingReserve({
      reserveId: 'src',
      merklSupplys: [pairGroup('supply', { pairedSide: 'borrow' }, breakdown({ campaignApr: 4 }))],
    });
    expect(discoverCrossAssetPairingScenarios([borrowSource, PAIRED()], NOW).length).toBe(1);
    expect(discoverCrossAssetPairingScenarios([pairedBorrowSource, PAIRED()], NOW).length).toBe(1);

    for (const exhausted of [{ borrowable: usd(0) }, { borrowDisabled: true }, { borrowable: usd(MIN_ROOM - 1) }]) {
      expect(
        discoverCrossAssetPairingScenarios([supplySource, { ...PAIRED(), ...exhausted }], NOW).length,
        'a partner that only ever supplies does not need borrow room',
      ).toBe(1);
      expect(
        discoverCrossAssetPairingScenarios([{ ...borrowSource, ...exhausted }, PAIRED()], NOW),
        'the source borrow is clamped',
      ).toEqual([]);
      expect(
        discoverCrossAssetPairingScenarios([pairedBorrowSource, { ...PAIRED(), ...exhausted }], NOW),
        'the paired borrow is clamped',
      ).toEqual([]);
    }

    expect(
      discoverCrossAssetPairingScenarios([{ ...borrowSource, borrowable: usd(MIN_ROOM) }, PAIRED()], NOW),
      'exactly at the borrow-room floor is enough',
    ).toHaveLength(1);
  });

  it('P9: a low-LTV endpoint cannot fund the runner borrow even with ample supply room', () => {
    const borrowSource = pairingReserve({
      reserveId: 'src',
      ltv: 1,
      suppliable: usd(MIN_ROOM * 10),
      merklBorrows: [pairGroup('borrow', {}, breakdown({ campaignApr: 4 }))],
    });
    expect(discoverCrossAssetPairingScenarios([borrowSource, PAIRED()], NOW)).toEqual([]);
    expect(
      discoverCrossAssetPairingScenarios(
        [
          { ...borrowSource, merklBorrows: [], merklSupplys: [pairGroup('supply', {}, breakdown({ campaignApr: 4 }))] },
          PAIRED(),
        ],
        NOW,
      ).length,
      'the same reserve is still fine for a supply-only pairing',
    ).toBe(1);
  });

  it('P10: excludes a self-pairing (the runner would overwrite its own position)', () => {
    const source = pairingReserve({
      reserveId: 'src',
      tokenSymbol: 'USDC',
      merklSupplys: [pairGroup('supply', { pairedReserveId: 'src' }, breakdown({ campaignApr: 4 }))],
    });
    expect(discoverCrossAssetPairingScenarios([source], NOW)).toEqual([]);
  });

  it('P11: excludes a same-symbol pair (fill helpers locate inputs by token symbol)', () => {
    const source = pairingReserve({
      reserveId: 'src',
      tokenSymbol: 'USDC',
      merklSupplys: [pairGroup('supply', {}, breakdown({ campaignApr: 4 }))],
    });
    const twinOnAnotherChain = pairingReserve({
      reserveId: 'paired',
      tokenSymbol: 'USDC',
      chainName: 'Base',
      marketName: 'AaveV3Base',
    });
    expect(twinOnAnotherChain.reserveId).not.toBe(source.reserveId);
    expect(discoverCrossAssetPairingScenarios([source, twinOnAnotherChain], NOW)).toEqual([]);
  });

  it('P13: dedups by reserveId+side — first qualifying group wins, both sides can each produce one', () => {
    const source = pairingReserve({
      reserveId: 'src',
      merklSupplys: [
        pairGroup('supply', {}, breakdown({ campaignId: 'g1', campaignApr: 2 })),
        pairGroup('supply', {}, breakdown({ campaignId: 'g2', campaignApr: 9 })),
      ],
      merklBorrows: [pairGroup('borrow', {}, breakdown({ campaignApr: 3 }))],
    });
    const scenarios = discoverCrossAssetPairingScenarios([source, PAIRED()], NOW);
    expect(scenarios.map((s) => `${s.sourceSide}:${s.apr}`)).toEqual(['borrow:3', 'supply:2']);
    // The retained supply scenario is the FIRST group (apr 2), not the highest (9).
    expect(scenarios.find((s) => s.sourceSide === 'supply')?.apr).toBe(2);
  });

  it('P14: sorts by computable APR descending', () => {
    const low = pairingReserve({
      reserveId: 'low',
      tokenSymbol: 'LOW',
      merklSupplys: [pairGroup('supply', {}, breakdown({ campaignApr: 1 }))],
    });
    const high = pairingReserve({
      reserveId: 'high',
      tokenSymbol: 'HIGH',
      merklSupplys: [pairGroup('supply', {}, breakdown({ campaignApr: 12 }))],
    });
    const scenarios = discoverCrossAssetPairingScenarios([low, high, PAIRED()], NOW);
    expect(scenarios.map((s) => s.sourceReserveId)).toEqual(['high', 'low']);
  });

  it('P14b: equal APR keeps input order (the sort is stable)', () => {
    const first = pairingReserve({
      reserveId: 'a',
      tokenSymbol: 'A',
      merklSupplys: [pairGroup('supply', {}, breakdown({ campaignApr: 7 }))],
    });
    const second = pairingReserve({
      reserveId: 'b',
      tokenSymbol: 'B',
      merklSupplys: [pairGroup('supply', {}, breakdown({ campaignApr: 7 }))],
    });
    const scenarios = discoverCrossAssetPairingScenarios([first, second, PAIRED()], NOW);
    expect(scenarios.map((s) => s.sourceReserveId)).toEqual(['a', 'b']);
  });

  it('P21: a reserve missing an identity field is skipped, never thrown at module load', () => {
    const source = pairingReserve({
      reserveId: 'src',
      merklSupplys: [pairGroup('supply', {}, breakdown({ campaignApr: 4 }))],
    });
    for (const broken of [
      { marketName: undefined },
      { tokenSymbol: '' },
      { chainName: undefined },
      { reserveId: undefined },
    ]) {
      expect(() => discoverCrossAssetPairingScenarios([{ ...source, ...broken }, PAIRED()], NOW)).not.toThrow();
      expect(discoverCrossAssetPairingScenarios([{ ...source, ...broken }, PAIRED()], NOW)).toEqual([]);
      expect(discoverCrossAssetPairingScenarios([source, { ...PAIRED(), ...broken }], NOW)).toEqual([]);
    }
  });
});

describe('getBorrowRoomUsd (AAV-1308)', () => {
  it('P17: prefers API borrowable, falls back to borrowCap − borrowed, and 0 is not null', () => {
    expect(getBorrowRoomUsd({ borrowable: usd(12_345), decimals: 6, tokenPrice: 1 })).toBeCloseTo(12_345);
    expect(getBorrowRoomUsd({ borrowCap: usd(20_000), borrowed: usd(7_000), decimals: 6, tokenPrice: 1 })).toBeCloseTo(
      13_000,
    );
    expect(
      getBorrowRoomUsd({ borrowCap: usd(5_000), borrowed: usd(9_000), decimals: 6, tokenPrice: 1 }),
      'never negative',
    ).toBe(0);
    expect(getBorrowRoomUsd({ decimals: 6, tokenPrice: 1 })).toBeNull();
    expect(getBorrowRoomUsd({ borrowable: usd(1000), decimals: 6, tokenPrice: 0 })).toBeNull();
  });
});

describe('position room: an Aave cap of 0 means UNLIMITED (AAV-1308 review)', () => {
  it('P22: cap 0 must not read as "no room" on either side', () => {
    expect(
      getBorrowRoomUsd({ borrowCap: '0', borrowed: usd(10_000), decimals: 6, tokenPrice: 1 }),
      'borrowCap 0 = no cap',
    ).toBeNull();
    expect(
      getSupplyRoomUsd({ supplyCap: '0', supplied: usd(10_000), decimals: 6, tokenPrice: 1 }),
      'supplyCap 0 = no cap',
    ).toBeNull();

    const source = pairingReserve({
      reserveId: 'src',
      borrowable: undefined,
      borrowCap: '0',
      borrowed: usd(10_000),
      merklBorrows: [pairGroup('borrow', {}, breakdown({ campaignApr: 4 }))],
    });
    expect(discoverCrossAssetPairingScenarios([source, PAIRED()], NOW)).toHaveLength(1);
  });
});

// Every market name currently served by /api/markets (staging 2026-09-28),
// including the V4-on-non-Ethereum and stripped-prefix cases where the mirror
// used to answer with the chain name instead of the UI chip.
const SERVED_MARKET_NAMES = [
  'AaveV3Arbitrum',
  'AaveV3Avalanche',
  'AaveV3BNB',
  'AaveV3Base',
  'AaveV3Celo',
  'AaveV3Ethereum',
  'AaveV3EthereumEtherFi',
  'AaveV3EthereumHorizon',
  'AaveV3EthereumLido',
  'AaveV3Gnosis',
  'AaveV3Ink',
  'AaveV3Linea',
  'AaveV3Mantle',
  'AaveV3MegaETH',
  'AaveV3Metis',
  'AaveV3Monad',
  'AaveV3Optimism',
  'AaveV3Plasma',
  'AaveV3Polygon',
  'AaveV3Scroll',
  'AaveV3Soneium',
  'AaveV3Sonic',
  'AaveV3XLayer',
  'AaveV3ZkSync',
  'AaveV4AVAXCorrelated',
  'AaveV4Bluechip',
  'AaveV4CoinbaseStocks',
  'AaveV4EthenaCorrelated',
  'AaveV4EthenaEcosystem',
  'AaveV4Etherfi',
  'AaveV4Forex',
  'AaveV4Gold',
  'AaveV4Kelp',
  'AaveV4Lido',
  'AaveV4Lombard',
  'AaveV4Main',
  'AaveV4MapleSyrupUSDG',
  'AaveV4PAXGGold',
  'AaveV4USDGPendle',
];

describe('getMarketChipLabel mirror parity with src/lib/marketLabels (AAV-1308 review)', () => {
  it.each(SERVED_MARKET_NAMES)('P20: %s resolves to the label the Add button renders', (marketName) => {
    // The runner matches the Add button's text, so any divergence silently
    // degrades to `.first()` and the scenario fills the wrong row.
    expect(getMarketChipLabel(marketName, 'Ethereum')).toBe(appGetMarketChipLabel(marketName, 'Ethereum'));
  });

  it('P20b: the label is derived from marketName alone, like the app', () => {
    // The app's camel-split only fires at a lower→upper junction, so an
    // all-caps prefix stays glued; parity is what matters, not prettiness.
    expect(getMarketChipLabel('AaveV4AVAXCorrelated', 'Avalanche')).toBe('AVAXCorrelated');
    expect(getMarketChipLabel('AaveV4CoinbaseStocks', 'Base')).toBe('Coinbase Stocks');
    expect(getMarketChipLabel('AaveV3EthereumLido', 'Ethereum')).toBe('Prime');
  });
});
