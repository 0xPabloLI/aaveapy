import { describe, expect, it, vi } from 'vitest';
import type {
  MerklOpportunityGroup,
  MerklForecastWireItem,
  MerklCampaignBreakdown,
  ReserveWithSpread,
} from '@/types/aave';
import type { RateCalcInput } from '@/lib/interestRateCalculator';
import { buildForecastMerklOpportunities, buildRateSimulationResult, buildPriceDataSignature, buildPriceLoadingSignature } from '@/lib/rateSimulationCalculator';

const baseReserve: ReserveWithSpread & RateCalcInput = {
  reserveId: 'Core-0x0000000000000000000000000000000000000001',
  marketName: 'Core',
  chainName: 'Ethereum',
  chainId: 1,
  tokenName: 'USD Coin',
  tokenSymbol: 'USDC',
  tokenAddress: '0x0000000000000000000000000000000000000001',
  aTokenAddress: '0x0000000000000000000000000000000000000002',
  vTokenAddress: '0x0000000000000000000000000000000000000003',
  supplyApy: 4.25,
  borrowApy: 6.5,
  supplyIncentives: [1.1],
  borrowIncentives: [0.4],
  meritSupplys: [],
  meritBorrows: [],
  merklSupplys: [],
  merklBorrows: [],
  brevisSupplys: [],
  brevisBorrows: [],
  // Rate calc fields (inline on reserve, no separate rate-input object)
  decimals: 6,
  deficit: '0',
  liquidity: '1000000000000',
  borrowed: '500000000000',
  protocolFee: 10,
  slopeBelowOptimal: 4,
  slopeAboveOptimal: 60,
  baseBorrowRate: 0,
  optimalUtilization: 80,
};

const SECONDS_PER_YEAR = 365 * 24 * 60 * 60;

function nativeAprToDailyFractionViaPerSecondCompounding(aprPercent: number): number {
  const aprDecimal = aprPercent / 100;
  return Math.pow(1 + aprDecimal / SECONDS_PER_YEAR, 60 * 60 * 24) - 1;
}

describe('buildForecastMerklOpportunities', () => {
  it('uses forecast APR when campaign state exists and amount is provided', () => {
    const opportunities: MerklOpportunityGroup[] = [
      {
        name: 'Merkl campaign',
        breakdowns: [
          {
            campaignApr: 20,
            campaignStartedAt: '2020-01-01T00:00:00.000Z',
            campaignEndedAt: '2099-01-01T00:00:00.000Z',
            campaignId: 'c1',
            campaignType: 'DUTCH_AUCTION',
            plannedDaily: 10,
            aprCap: null,
            totalBudget: 100000,
            latestTvl: 1000,
          },
        ],
      },
    ];

    const states: Record<string, MerklForecastWireItem> = {
      c1: {
        campaignId: 'c1',
        distributedSoFar: 0,
        endTimestamp: Math.floor(Date.now() / 1000) + 86400 * 30,
      },
    };

    const result = buildForecastMerklOpportunities({
      opportunities,
      inputUsd: 1000,
      forecastStates: states,
      whitelistMerklCampaignIds: new Set(),
      tydroPointToUsdRate: 1,
    });

    expect(result[0].breakdowns[0].campaignApr).toBeCloseTo(182.5, 1);
    expect(result[0].breakdowns[0].pointsPerThousandUsd).toBeUndefined();
  });

  it('computes forecast APR for whitelist-only campaigns regardless of exclusion (filtering at sum level)', () => {
    const opportunities: MerklOpportunityGroup[] = [
      {
        name: 'Whitelist campaign',
        breakdowns: [
          {
            campaignApr: 33,
            campaignStartedAt: '2020-01-01T00:00:00.000Z',
            campaignEndedAt: '2099-01-01T00:00:00.000Z',
            campaignId: 'c2',
            whitelistOnly: true,
            campaignType: 'DUTCH_AUCTION',
            plannedDaily: 100,
            aprCap: null,
            totalBudget: 100000,
            latestTvl: 1000,
          },
        ],
      },
    ];

    const states: Record<string, MerklForecastWireItem> = {
      c2: {
        campaignId: 'c2',
        distributedSoFar: 0,
        endTimestamp: Math.floor(Date.now() / 1000) + 86400 * 30,
      },
    };

    const result = buildForecastMerklOpportunities({
      opportunities,
      inputUsd: 5000,
      forecastStates: states,
      whitelistMerklCampaignIds: new Set(),
      tydroPointToUsdRate: 1,
    });

    // DUTCH_AUCTION forecast: plannedDaily(100) * 365 / (latestTvl(1000) + inputUsd(5000)) * 100
    expect(result[0].breakdowns[0].campaignApr).toBeCloseTo(608.33, 1);
  });

  it('applies MAX reward campaign constraints to points-based breakdowns using the actual campaign type', () => {
    const opportunities: MerklOpportunityGroup[] = [
      {
        name: 'Tydro points campaign',
        breakdowns: [
          {
            campaignApr: 0,
            campaignStartedAt: '2020-01-01T00:00:00.000Z',
            campaignEndedAt: '2099-01-01T00:00:00.000Z',
            campaignId: 'points-max',
            campaignType: 'MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
            plannedDaily: 1_000,
            aprCap: 10,
            totalBudget: 100_000,
            latestTvl: 1_000,
            pointsPerThousandUsd: 4,
          },
        ],
      },
    ];

    const states: Record<string, MerklForecastWireItem> = {
      'points-max': {
        campaignId: 'points-max',
        requiredDaily: 1_000,
        distributedSoFar: 0,
        endTimestamp: Math.floor(Date.now() / 1000) + 86400 * 30,
      },
    };

    const result = buildForecastMerklOpportunities({
      opportunities,
      inputUsd: 1_000,
      forecastStates: states,
      whitelistMerklCampaignIds: new Set(),
      tydroPointToUsdRate: 2,
    });

    expect(result[0].breakdowns[0].campaignApr).toBeCloseTo(10, 10);
  });

  it('applies FIX reward campaign constraints to points-based breakdowns using the actual campaign type', () => {
    const opportunities: MerklOpportunityGroup[] = [
      {
        name: 'Tydro points campaign',
        breakdowns: [
          {
            campaignApr: 0,
            campaignStartedAt: '2020-01-01T00:00:00.000Z',
            campaignEndedAt: '2099-01-01T00:00:00.000Z',
            campaignId: 'points-fix',
            campaignType: 'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
            plannedDaily: 1_000,
            aprCap: 5,
            totalBudget: 100_000,
            latestTvl: 1_000,
            pointsPerThousandUsd: 4,
          },
        ],
      },
    ];

    const states: Record<string, MerklForecastWireItem> = {
      'points-fix': {
        campaignId: 'points-fix',
        requiredDaily: 1_000,
        distributedSoFar: 0,
        endTimestamp: Math.floor(Date.now() / 1000) + 86400 * 30,
      },
    };

    const result = buildForecastMerklOpportunities({
      opportunities,
      inputUsd: 1_000,
      forecastStates: states,
      whitelistMerklCampaignIds: new Set(),
      tydroPointToUsdRate: 2,
    });

    expect(result[0].breakdowns[0].campaignApr).toBeCloseTo(5, 10);
  });
});

describe('buildRateSimulationResult', () => {
  it('recomputes supply, spread, borrow, and utilization from one shared scenario', () => {
    const result = buildRateSimulationResult({
      reserve: baseReserve,
      reserveRateInput: baseReserve,
      isApy: true,
      whitelistMerklCampaignIds: new Set(),
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '100000',
      borrowInput: '20000',
      forecastStates: {},
    });

    expect(result.supply.afterTotal).not.toBeNull();
    expect(result.spread.after).not.toBeNull();
    expect(result.borrow.afterTotal).not.toBeNull();
    expect(result.utilization.after).not.toBeNull();
    expect(result.supply.afterNative).not.toBe(result.supply.currentNative);
    expect(result.borrow.afterNative).not.toBe(result.borrow.currentNative);
    expect(result.utilization.after).not.toBe(result.utilization.current);
  });

  it('uses native APY for scenarioUsdAccrual daily cashflow regardless of display mode', () => {
    const aprModeResult = buildRateSimulationResult({
      reserve: baseReserve,
      reserveRateInput: baseReserve,
      isApy: false,
      whitelistMerklCampaignIds: new Set(),
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '36500',
      borrowInput: '3650',
      forecastStates: {},
    });
    const apyModeResult = buildRateSimulationResult({
      reserve: baseReserve,
      reserveRateInput: baseReserve,
      isApy: true,
      whitelistMerklCampaignIds: new Set(),
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '36500',
      borrowInput: '3650',
      forecastStates: {},
    });

    expect(aprModeResult.scenarioUsdAccrual).not.toBeNull();
    expect(apyModeResult.scenarioUsdAccrual).not.toBeNull();
    const aprAcc = aprModeResult.scenarioUsdAccrual!;
    const apyAcc = apyModeResult.scenarioUsdAccrual!;
    expect(aprAcc.supply).not.toBeNull();
    expect(aprAcc.borrow).not.toBeNull();
    expect(apyAcc.supply).not.toBeNull();
    expect(apyAcc.borrow).not.toBeNull();
    expect(aprAcc.supply!.nativeUsdPerDay).toBeCloseTo(apyAcc.supply!.nativeUsdPerDay!, 5);
    expect(aprAcc.borrow!.nativeUsdPerDay).toBeCloseTo(apyAcc.borrow!.nativeUsdPerDay!, 5);
    expect(aprAcc.borrow!.incentiveUsdPerDay).toBeCloseTo(apyAcc.borrow!.incentiveUsdPerDay!, 5);
    const supplyNativeApr = aprModeResult.supply.afterNative;
    const borrowNativeApr = aprModeResult.borrow.afterNative;
    expect(supplyNativeApr).not.toBeNull();
    expect(borrowNativeApr).not.toBeNull();
    expect(aprAcc.supply!.nativeUsdPerDay).toBeCloseTo(
      36500 * nativeAprToDailyFractionViaPerSecondCompounding(supplyNativeApr!),
      5
    );
    expect(aprAcc.borrow!.nativeUsdPerDay).toBeCloseTo(
      -3650 * nativeAprToDailyFractionViaPerSecondCompounding(borrowNativeApr!),
      5
    );
    expect(aprAcc.netUsdPerDay).toBeCloseTo(
      (aprAcc.supply!.totalUsdPerDay ?? 0) + (aprAcc.borrow!.totalUsdPerDay ?? 0),
      5
    );
  });

  it('keeps incentive scenarioUsdAccrual on fixed APR-linear daily USD in APY mode', () => {
    const apyModeResult = buildRateSimulationResult({
      reserve: baseReserve,
      reserveRateInput: baseReserve,
      isApy: true,
      whitelistMerklCampaignIds: new Set(),
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '36500',
      borrowInput: '3650',
      forecastStates: {},
    });
    const aprModeResult = buildRateSimulationResult({
      reserve: baseReserve,
      reserveRateInput: baseReserve,
      isApy: false,
      whitelistMerklCampaignIds: new Set(),
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '36500',
      borrowInput: '3650',
      forecastStates: {},
    });

    expect(apyModeResult.scenarioUsdAccrual).not.toBeNull();
    expect(aprModeResult.scenarioUsdAccrual).not.toBeNull();
    const acc = apyModeResult.scenarioUsdAccrual!;
    const aprAcc = aprModeResult.scenarioUsdAccrual!;
    expect(acc.supply).not.toBeNull();
    expect(acc.borrow).not.toBeNull();
    expect(aprAcc.borrow).not.toBeNull();
    expect(acc.supply!.incentiveUsdPerDay).toBeCloseTo(aprAcc.supply!.incentiveUsdPerDay!, 5);
    expect(acc.borrow!.incentiveUsdPerDay).toBeCloseTo(aprAcc.borrow!.incentiveUsdPerDay!, 5);
  });

  it('keeps native rates in APY even when display mode switches incentive values to APR', () => {
    const reserve: ReserveWithSpread = {
      ...baseReserve,
      supplyIncentives: [1.1],
      borrowIncentives: [0.4],
    };

    const result = buildRateSimulationResult({
      reserve,
      reserveRateInput: baseReserve,
      isApy: false,
      whitelistMerklCampaignIds: new Set(),
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '',
      borrowInput: '',
      forecastStates: {},
    });

    expect(result.supply.currentNative).toBe(baseReserve.supplyApy);
    expect(result.borrow.currentNative).toBe(baseReserve.borrowApy);
    expect(result.supply.currentIncentive).toBe(1.1);
    expect(result.borrow.currentIncentive).toBe(0.4);
  });

  it('applies Merit/Merkl per-side USD when meritMerklNetPosition is false', () => {
    const reserve: ReserveWithSpread = {
      ...baseReserve,
      merklSupplys: [
        {
          name: 'Merkl supply',
          breakdowns: [
            {
              campaignApr: 5,
              campaignStartedAt: '2020-01-01T00:00:00.000Z',
              campaignEndedAt: '2099-01-01T00:00:00.000Z',
              campaignId: 'c-supply',
              campaignType: 'DUTCH_AUCTION',
              plannedDaily: 10,
              aprCap: null,
              totalBudget: 100000,
              latestTvl: 1000,
            },
          ],
        },
      ],
    };

    const states: Record<string, MerklForecastWireItem> = {
      'c-supply': {
        campaignId: 'c-supply',
        distributedSoFar: 0,
        endTimestamp: Math.floor(Date.now() / 1000) + 86400 * 30,
      },
    };

    const common = {
      reserve,
      reserveRateInput: baseReserve,
      isApy: false,
      whitelistMerklCampaignIds: new Set<string>(),
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '1000',
      borrowInput: '400',
      forecastStates: states,
    };

    const netOn = buildRateSimulationResult({ ...common, meritMerklNetPosition: true });
    const perSide = buildRateSimulationResult({ ...common, meritMerklNetPosition: false });

    const netRow = netOn.supply.sources.merkl.campaigns?.[0];
    const perRow = perSide.supply.sources.merkl.campaigns?.[0];
    expect(netRow?.after).not.toBeNull();
    expect(perRow?.after).not.toBeNull();
    expect(perRow?.after).not.toBe(netRow?.after);
  });

  it('does not increase supply incentives when a shared supply amount is present', () => {
    const reserve: ReserveWithSpread = {
      ...baseReserve,
      merklSupplys: [
        {
          name: 'Merkl campaign',
          breakdowns: [
            {
              campaignApr: 10,
              campaignStartedAt: '2020-01-01T00:00:00.000Z',
              campaignEndedAt: '2099-01-01T00:00:00.000Z',
              campaignId: 'c1',
              campaignType: 'DUTCH_AUCTION',
              plannedDaily: 10,
              aprCap: null,
              totalBudget: 100000,
              latestTvl: 1000,
            },
          ],
        },
      ],
    };

    const states: Record<string, MerklForecastWireItem> = {
      c1: {
        campaignId: 'c1',
        distributedSoFar: 0,
        endTimestamp: Math.floor(Date.now() / 1000) + 86400 * 30,
      },
    };

    const result = buildRateSimulationResult({
      reserve,
      reserveRateInput: baseReserve,
      isApy: false,
      whitelistMerklCampaignIds: new Set(),
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '1000',
      borrowInput: '0',
      forecastStates: states,
    });

    expect(result.supply.sources.merkl.current).toBe(10);
    expect(result.supply.sources.merkl.after).toBe(10);
    expect(result.supply.afterIncentive).toBeLessThanOrEqual(result.supply.currentIncentive);
  });

  it('recomputes Merkl supply incentives from forecast TVL when side-data provides campaign metrics', () => {
    const reserve: ReserveWithSpread = {
      ...baseReserve,
      tokenSymbol: 'USDG',
      tokenPrice: 1,
      supplied: '23655388009228',
      merklSupplys: [
        {
          name: 'Lend USDG on Tydro',
          breakdowns: [
            {
              campaignApr: 0,
              campaignStartedAt: '2020-03-24T14:00:00.000Z',
              campaignEndedAt: '2099-03-31T14:00:00.000Z',
              campaignId: '16403393592832236981',
              campaignType: 'DUTCH_AUCTION',
              plannedDaily: 11312,
              aprCap: null,
              totalBudget: 79184,
              latestTvl: 23586552.55647095,
              pointsPerThousandUsd: 0.4795953106295122,
            },
          ],
        },
      ],
    };

    const states: Record<string, MerklForecastWireItem> = {
      '16403393592832236981': {
        campaignId: '16403393592832236981',
        requiredDaily: 11312,
        distributedSoFar: 0,
        endTimestamp: 4070901600,
      },
    };

    const result = buildRateSimulationResult({
      reserve,
      reserveRateInput: baseReserve,
      isApy: false,
      whitelistMerklCampaignIds: new Set(),
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '1000000',
      borrowInput: '0',
      inputMode: 'usd',
      forecastStates: states,
    });

    expect(result.supply.sources.merkl.current).toBeCloseTo(17.505228837977196, 10);
    expect(result.supply.sources.merkl.after).toBeCloseTo(16.793244968023455, 10);
    expect(result.supply.sources.merkl.after).toBeLessThan(result.supply.sources.merkl.current!);
  });

  it('recomputes Merkl supply incentive APY from forecast TVL when side-data provides campaign metrics', () => {
    const reserve: ReserveWithSpread = {
      ...baseReserve,
      tokenSymbol: 'USDG',
      tokenPrice: 1,
      supplied: '23655388009228',
      merklSupplys: [
        {
          name: 'Lend USDG on Tydro',
          breakdowns: [
            {
              campaignApr: 0,
              campaignStartedAt: '2020-03-24T14:00:00.000Z',
              campaignEndedAt: '2099-03-31T14:00:00.000Z',
              campaignId: '16403393592832236981',
              campaignType: 'DUTCH_AUCTION',
              plannedDaily: 11312,
              aprCap: null,
              totalBudget: 79184,
              latestTvl: 23586552.55647095,
              pointsPerThousandUsd: 0.4795953106295122,
            },
          ],
        },
      ],
    };

    const states: Record<string, MerklForecastWireItem> = {
      '16403393592832236981': {
        campaignId: '16403393592832236981',
        requiredDaily: 11312,
        distributedSoFar: 0,
        endTimestamp: 4070901600,
      },
    };

    const result = buildRateSimulationResult({
      reserve,
      reserveRateInput: baseReserve,
      isApy: true,
      whitelistMerklCampaignIds: new Set(),
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '1000000',
      borrowInput: '0',
      inputMode: 'usd',
      forecastStates: states,
    });

    expect(result.supply.sources.merkl.current).toBeCloseTo(18.98030233890571, 10);
    expect(result.supply.sources.merkl.after).toBeCloseTo(18.14804186025065, 10);
    expect(result.supply.sources.merkl.after).toBeLessThan(result.supply.sources.merkl.current!);
    expect(result.supply.currentIncentive).toBeGreaterThan(result.supply.sources.merkl.current!);
    expect(result.supply.afterIncentive).toBeGreaterThan(result.supply.sources.merkl.after!);
    expect(result.supply.afterIncentive).toBeLessThan(result.supply.currentIncentive);
  });

  it('recomputes merit incentives when a shared supply amount is present even without latest-round reward data', () => {
    const reserve: ReserveWithSpread = {
      ...baseReserve,
      meritSupplys: [
        {
          apr: 4.084439890516138,
          selfApr: 4.084439890516138,
          link: 'https://apps.aavechan.com/merit/celo-supply-usdt',
          startDate: '2020-01-01',
          endDate: '2099-01-01',
          name: 'Supply USDT',
          message: [
            {
              action: 'Supply USDT',
              description:
                'Rewards are distributed using the following formula: f(USD₮ aToken Holding - USD₮ vToken Holding / USD₮ Liquidation Threshold)',
            },
            {
              action: 'Self Authentication',
              description:
                'Supply USDT and double your yield by verifying your humanity through Self for the first $1000 USDT supplied per user.',
            },
          ] as unknown as string,
        },
      ],
    };

    const result = buildRateSimulationResult({
      reserve,
      reserveRateInput: baseReserve,
      isApy: false,
      whitelistMerklCampaignIds: new Set(),
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '100000',
      borrowInput: '0',
      inputMode: 'usd',
      forecastStates: {},
    });

    expect(result.supply.sources.merit.current).toBeCloseTo(8.168879781032276, 10);
    expect(result.supply.sources.merit.after).toBeLessThan(result.supply.sources.merit.current!);
    expect(result.supply.sources.merit.after).toBeCloseTo(4.1252842894213, 10);
    expect(result.supply.sources.merit.delta).toBeCloseTo(-4.043595491610976, 10);
  });

  it('keeps after values empty when the shared scenario is blank', () => {
    const result = buildRateSimulationResult({
      reserve: baseReserve,
      reserveRateInput: baseReserve,
      isApy: true,
      whitelistMerklCampaignIds: new Set(),
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '',
      borrowInput: '',
      forecastStates: {},
    });

    expect(result.supply.afterTotal).toBeNull();
    expect(result.spread.after).toBeNull();
    expect(result.borrow.afterTotal).toBeNull();
    expect(result.utilization.after).toBeNull();
  });

  it('reduces brevis supply incentive when per-user reward cap is binding', () => {
    const nowMs = Date.now();
    const endDate = new Date(nowMs + 365 * 86_400_000).toISOString();
    const reserve: ReserveWithSpread = {
      ...baseReserve,
      brevisSupplys: [
        {
          link: 'https://example.com/brevis',
          campaignApr: 10,
          campaignStartedAt: '2020-01-01T00:00:00.000Z',
          campaignEndedAt: endDate,
          perUserRewardCapUsd: 5000,
          campaignId: 'brevis-supply',
          name: 'Brevis Supply',
          message: 'Brevis Supply',
          breakdowns: [
            {
              campaignApr: 10,
              campaignStartedAt: '2020-01-01T00:00:00.000Z',
              campaignEndedAt: endDate,
              perUserRewardCapUsd: 5000,
              campaignId: 'brevis-supply',
            },
          ],
        },
      ],
    };

    const result = buildRateSimulationResult({
      reserve,
      reserveRateInput: baseReserve,
      isApy: false,
      whitelistMerklCampaignIds: new Set(),
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '100000',
      borrowInput: '0',
      inputMode: 'usd',
      forecastStates: {},
    });

    expect(result.supply.sources.brevis.current).toBe(10);
    expect(result.supply.sources.brevis.after).toBeLessThan(10);
    expect(result.supply.sources.brevis.after).toBeCloseTo(5, 0);
    expect(result.supply.afterIncentive).toBeLessThan(result.supply.currentIncentive);
  });

  it('brevis capNote uses min(daysToHitCap, remainingDays) as ~Nd earn when both exist', () => {
    const nowMs = Date.now();
    const endDate = new Date(nowMs + 50 * 86_400_000).toISOString();
    const reserve: ReserveWithSpread = {
      ...baseReserve,
      brevisSupplys: [
        {
          link: 'https://example.com/brevis',
          campaignApr: 10,
          campaignStartedAt: '2020-01-01T00:00:00.000Z',
          campaignEndedAt: endDate,
          perUserRewardCapUsd: 5000,
          campaignId: 'brevis-supply',
          name: 'Brevis Supply',
          message: 'Brevis Supply',
          breakdowns: [
            {
              campaignApr: 10,
              campaignStartedAt: '2020-01-01T00:00:00.000Z',
              campaignEndedAt: endDate,
              perUserRewardCapUsd: 5000,
              campaignId: 'brevis-supply',
            },
          ],
        },
      ],
    };

    const result = buildRateSimulationResult({
      reserve,
      reserveRateInput: baseReserve,
      isApy: false,
      whitelistMerklCampaignIds: new Set(),
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '100000',
      borrowInput: '0',
      inputMode: 'usd',
      forecastStates: {},
    });

    const capNote = result.supply.sources.brevis.campaigns?.[0]?.capNote;
    expect(capNote).toBeDefined();
    expect(capNote).toMatch(/~\d+d earn/);
    const m = capNote!.match(/~(\d+)d earn/);
    expect(m).not.toBeNull();
    const n = Number(m![1]);
    // remainingDays ≈ 50; daysToHitCap at 100k × 10% is much larger → min is calendar window
    expect(n).toBeGreaterThanOrEqual(48);
    expect(n).toBeLessThanOrEqual(52);
  });

  it('keeps brevis incentive unchanged when cap is not binding (small deposit)', () => {
    const nowMs = Date.now();
    const endDate = new Date(nowMs + 365 * 86_400_000).toISOString();
    const reserve: ReserveWithSpread = {
      ...baseReserve,
      brevisSupplys: [
        {
          campaignApr: 10,
          link: 'https://example.com/brevis',
          campaignStartedAt: '2020-01-01T00:00:00.000Z',
          campaignEndedAt: endDate,
          message: 'Brevis Supply',
          perUserRewardCapUsd: 5000,
        },
      ],
    };

    const result = buildRateSimulationResult({
      reserve,
      reserveRateInput: baseReserve,
      isApy: false,
      whitelistMerklCampaignIds: new Set(),
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '1000',
      borrowInput: '0',
      inputMode: 'usd',
      forecastStates: {},
    });

    // deposit=1000, nominal reward = 1000*10%*1year = 100 << 5000, cap not binding
    expect(result.supply.sources.brevis.current).toBe(10);
    expect(result.supply.sources.brevis.after).toBe(10);
  });

  it('keeps brevis incentive unchanged when perUserRewardCapUsd is absent', () => {
    const reserve: ReserveWithSpread = {
      ...baseReserve,
      brevisSupplys: [
        {
          campaignApr: 10,
          link: 'https://example.com/brevis',
          campaignStartedAt: '2020-01-01T00:00:00.000Z',
          campaignEndedAt: '2099-01-01T00:00:00.000Z',
          message: 'Brevis Supply',
        },
      ],
    };

    const result = buildRateSimulationResult({
      reserve,
      reserveRateInput: baseReserve,
      isApy: false,
      whitelistMerklCampaignIds: new Set(),
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '100000',
      borrowInput: '0',
      inputMode: 'usd',
      forecastStates: {},
    });

    expect(result.supply.sources.brevis.current).toBe(10);
    expect(result.supply.sources.brevis.after).toBe(10);
  });

  it('reduces brevis borrow incentive when per-user reward cap is binding', () => {
    const nowMs = Date.now();
    const endDate = new Date(nowMs + 365 * 86_400_000).toISOString();
    const reserve: ReserveWithSpread = {
      ...baseReserve,
      brevisBorrows: [
        {
          campaignApr: 8,
          link: 'https://example.com/brevis',
          campaignStartedAt: '2020-01-01T00:00:00.000Z',
          campaignEndedAt: endDate,
          message: 'Brevis Borrow',
          perUserRewardCapUsd: 5000,
        },
      ],
    };

    const result = buildRateSimulationResult({
      reserve,
      reserveRateInput: baseReserve,
      isApy: false,
      whitelistMerklCampaignIds: new Set(),
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '0',
      borrowInput: '200000',
      inputMode: 'usd',
      forecastStates: {},
    });

    expect(result.borrow.sources.brevis.current).toBe(8);
    // cap implied = 5000/200000/1 * 100 = 2.5%
    expect(result.borrow.sources.brevis.after).toBeLessThan(8);
    expect(result.borrow.sources.brevis.after).toBeCloseTo(2.5, 0);
  });

  it('includes brevis incentive when endDate is absent (open-ended campaign)', () => {
    const reserve: ReserveWithSpread = {
      ...baseReserve,
      brevisSupplys: [
        {
          campaignApr: 10,
          link: 'https://example.com/brevis',
          campaignStartedAt: '2020-01-01T00:00:00.000Z',
          campaignEndedAt: '',
          message: 'Brevis Supply (no end)',
          perUserRewardCapUsd: 5000,
        },
      ],
    };

    const result = buildRateSimulationResult({
      reserve,
      reserveRateInput: baseReserve,
      isApy: false,
      whitelistMerklCampaignIds: new Set(),
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '100000',
      borrowInput: '0',
      inputMode: 'usd',
      forecastStates: {},
    });

    // Campaign counted as active; cap can't bind without endDate → nominal APR
    expect(result.supply.sources.brevis.current).toBe(10);
    expect(result.supply.sources.brevis.after).toBe(10);
  });

  it('uses combined supply+borrow deposit for shared campaignId', () => {
    const nowMs = Date.now();
    const endDate = new Date(nowMs + 365 * 86_400_000).toISOString();
    const reserve: ReserveWithSpread = {
      ...baseReserve,
      brevisSupplys: [
        {
          link: 'https://example.com/brevis-supply',
          campaignApr: 10,
          campaignStartedAt: '2020-01-01T00:00:00.000Z',
          campaignEndedAt: endDate,
          latestTvl: 1_000_000,
          totalBudget: 100_000,
          message: 'Shared campaign',
          perUserRewardCapUsd: 5000,
          campaignId: 'linea-usdc',
        },
      ],
      brevisBorrows: [
        {
          link: 'https://example.com/brevis-supply',
          campaignApr: 10,
          campaignStartedAt: '2020-01-01T00:00:00.000Z',
          campaignEndedAt: endDate,
          latestTvl: 1_000_000,
          totalBudget: 100_000,
          message: 'Shared campaign',
          perUserRewardCapUsd: 5000,
          campaignId: 'linea-usdc',
        },
      ],
    };

    const result = buildRateSimulationResult({
      reserve,
      reserveRateInput: baseReserve,
      isApy: false,
      whitelistMerklCampaignIds: new Set(),
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '50000',
      borrowInput: '50000',
      inputMode: 'usd',
      forecastStates: {},
    });

    // Combined deposit = 100k. Cap implied = 5000/100000/1 * 100 = 5%
    // Both sides should see the reduced APR
    expect(result.supply.sources.brevis.after).toBeCloseTo(5, 0);
    expect(result.borrow.sources.brevis.after).toBeCloseTo(5, 0);
    expect(result.supply.sources.brevis.campaigns?.[0]?.capNote).toContain(
      'Reward capped at $5,000.00/user · supply + borrow',
    );
    expect(result.supply.sources.brevis.campaigns?.[0]?.capNote).toBe(result.borrow.sources.brevis.campaigns?.[0]?.capNote);
  });

  it('shows shared cap note on both sides when only one side has scenario input', () => {
    const nowMs = Date.now();
    const endDate = new Date(nowMs + 365 * 86_400_000).toISOString();
    const reserve: ReserveWithSpread = {
      ...baseReserve,
      brevisSupplys: [
        {
          link: 'https://example.com/brevis-shared',
          campaignApr: 10,
          campaignStartedAt: '2020-01-01T00:00:00.000Z',
          campaignEndedAt: endDate,
          latestTvl: 1_000_000,
          totalBudget: 100_000,
          message: 'Shared campaign',
          perUserRewardCapUsd: 5000,
          campaignId: 'linea-usdc',
        },
      ],
      brevisBorrows: [
        {
          link: 'https://example.com/brevis-shared',
          campaignApr: 10,
          campaignStartedAt: '2020-01-01T00:00:00.000Z',
          campaignEndedAt: endDate,
          latestTvl: 1_000_000,
          totalBudget: 100_000,
          message: 'Shared campaign',
          perUserRewardCapUsd: 5000,
          campaignId: 'linea-usdc',
        },
      ],
    };

    const result = buildRateSimulationResult({
      reserve,
      reserveRateInput: baseReserve,
      isApy: false,
      whitelistMerklCampaignIds: new Set(),
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '0',
      borrowInput: '50000',
      inputMode: 'usd',
      forecastStates: {},
    });

    expect(result.supply.sources.brevis.campaigns?.[0]?.capNote).toContain(
      'Reward capped at $5,000.00/user · supply + borrow',
    );
    expect(result.borrow.sources.brevis.campaigns?.[0]?.capNote).toContain(
      'Reward capped at $5,000.00/user · supply + borrow',
    );
    expect(result.supply.sources.brevis.campaigns?.[0]?.capNote).toBe(result.borrow.sources.brevis.campaigns?.[0]?.capNote);
    expect(result.supply.sources.brevis.after).toBeCloseTo(10, 8);
    expect(result.borrow.sources.brevis.after).toBeCloseTo(10, 8);
  });

  it('does not share cap when campaignId is absent', () => {
    const nowMs = Date.now();
    const endDate = new Date(nowMs + 365 * 86_400_000).toISOString();
    const reserve: ReserveWithSpread = {
      ...baseReserve,
      brevisSupplys: [
        {
          campaignApr: 10,
          link: 'https://example.com/brevis-supply',
          campaignStartedAt: '2020-01-01T00:00:00.000Z',
          campaignEndedAt: endDate,
          message: 'Brevis Supply',
          perUserRewardCapUsd: 5000,
        },
      ],
      brevisBorrows: [
        {
          campaignApr: 10,
          link: 'https://example.com/brevis-borrow',
          campaignStartedAt: '2020-01-01T00:00:00.000Z',
          campaignEndedAt: endDate,
          message: 'Brevis Borrow',
          perUserRewardCapUsd: 5000,
        },
      ],
    };

    const result = buildRateSimulationResult({
      reserve,
      reserveRateInput: baseReserve,
      isApy: false,
      whitelistMerklCampaignIds: new Set(),
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '50000',
      borrowInput: '50000',
      inputMode: 'usd',
      forecastStates: {},
    });

    // No shared group → each side evaluated independently
    // 50k deposit per side, cap implied = 5000/50000/1 * 100 = 10% = nominal, so cap not binding
    expect(result.supply.sources.brevis.after).toBeCloseTo(10, 8);
    expect(result.borrow.sources.brevis.after).toBeCloseTo(10, 8);
  });

  it('does not share cap when supply and borrow metadata differ for the same campaignId', () => {
    const nowMs = Date.now();
    const endDate = new Date(nowMs + 365 * 86_400_000).toISOString();
    const reserve: ReserveWithSpread = {
      ...baseReserve,
      brevisSupplys: [
        {
          link: 'https://example.com/brevis-shared',
          campaignApr: 10,
          campaignStartedAt: '2020-01-01T00:00:00.000Z',
          campaignEndedAt: endDate,
          latestTvl: 1_000_000,
          totalBudget: 100_000,
          message: 'Shared campaign',
          perUserRewardCapUsd: 5000,
          campaignId: 'linea-usdc',
        },
      ],
      brevisBorrows: [
        {
          link: 'https://example.com/brevis-shared',
          campaignApr: 12,
          campaignStartedAt: '2020-01-01T00:00:00.000Z',
          campaignEndedAt: endDate,
          latestTvl: 1_000_000,
          totalBudget: 100_000,
          message: 'Shared campaign',
          perUserRewardCapUsd: 5000,
          campaignId: 'linea-usdc',
        },
      ],
    };

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = buildRateSimulationResult({
      reserve,
      reserveRateInput: baseReserve,
      isApy: false,
      whitelistMerklCampaignIds: new Set(),
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '50000',
      borrowInput: '50000',
      inputMode: 'usd',
      forecastStates: {},
    });

    expect(result.supply.sources.brevis.after).toBeCloseTo(10, 8);
    expect(result.borrow.sources.brevis.after).toBeCloseTo(10, 8);
    expect(result.supply.sources.brevis.campaigns?.[0]?.capNote).not.toContain('supply + borrow');
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('counts brevis in current totals even without endDate', () => {
    const reserve: ReserveWithSpread = {
      ...baseReserve,
      brevisSupplys: [
        {
          campaignApr: 5,
          link: 'https://example.com/brevis',
          campaignStartedAt: '2020-01-01T00:00:00.000Z',
          campaignEndedAt: '',
          message: 'Brevis open-ended',
        },
      ],
    };

    const result = buildRateSimulationResult({
      reserve,
      reserveRateInput: baseReserve,
      isApy: false,
      whitelistMerklCampaignIds: new Set(),
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '',
      borrowInput: '',
      forecastStates: {},
    });

    expect(result.supply.sources.brevis.current).toBe(5);
    expect(result.supply.currentIncentive).toBeGreaterThan(0);
  });

  it('adds no cap note for Merkl DUTCH_AUCTION', () => {
    const merkl: MerklOpportunityGroup[] = [
      {
        name: 'Dutch opp',
        breakdowns: [
          {
            campaignApr: 10,
            campaignStartedAt: '2020-01-01T00:00:00.000Z',
            campaignEndedAt: '2099-01-01T00:00:00.000Z',
            campaignId: 'dutch1',
            campaignType: 'DUTCH_AUCTION',
            plannedDaily: 10,
            aprCap: null,
            totalBudget: 100000,
            latestTvl: 1000,
          },
          {
            campaignApr: 5,
            campaignStartedAt: '2020-01-01T00:00:00.000Z',
            campaignEndedAt: '2099-01-01T00:00:00.000Z',
            campaignId: 'dutch2',
            campaignType: 'DUTCH_AUCTION',
            plannedDaily: 10,
            aprCap: null,
            totalBudget: 100000,
            latestTvl: 1000,
          },
        ],
      },
    ];

    const states: Record<string, MerklForecastWireItem> = {
      dutch1: {
        campaignId: 'dutch1',
        distributedSoFar: 0,
        endTimestamp: Math.floor(Date.now() / 1000) + 86400 * 30,
      },
      dutch2: {
        campaignId: 'dutch2',
        distributedSoFar: 0,
        endTimestamp: Math.floor(Date.now() / 1000) + 86400 * 30,
      },
    };

    const reserve: ReserveWithSpread = { ...baseReserve, merklSupplys: merkl };

    const result = buildRateSimulationResult({
      reserve,
      reserveRateInput: baseReserve,
      isApy: false,
      whitelistMerklCampaignIds: new Set(),
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '1000',
      borrowInput: '0',
      forecastStates: states,
    });

    const rows = result.supply.sources.merkl.campaigns ?? [];
    expect(rows.find((r) => r.id.includes('dutch1'))?.capNote).toBeUndefined();
    expect(rows.find((r) => r.id.includes('dutch2'))?.capNote).toBeUndefined();
  });

  it('does not count DUTCH_AUCTION toward forecastUnavailableCampaignCount', () => {
    const reserve: ReserveWithSpread = {
      ...baseReserve,
      merklSupplys: [
        {
          name: 'Dutch opp',
          breakdowns: [
            {
              campaignApr: 10,
              campaignStartedAt: '2020-01-01T00:00:00.000Z',
              campaignEndedAt: '2099-01-01T00:00:00.000Z',
              campaignId: 'dutch1',
              campaignType: 'DUTCH_AUCTION',
              plannedDaily: 10,
              aprCap: null,
              totalBudget: 100000,
            },
          ],
        },
      ],
    };

    const result = buildRateSimulationResult({
      reserve,
      reserveRateInput: baseReserve,
      isApy: false,
      whitelistMerklCampaignIds: new Set(),
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '1000',
      borrowInput: '0',
      forecastStates: {},
    });

    expect(result.forecastUnavailableCampaignCount).toBe(0);
    expect(result.forecastUnavailableCampaignIds).toEqual([]);
  });

  describe('blocked / disabled reserves', () => {
    it('TC1: paused reserve ignores all simulation input (after values all null)', () => {
      const reserve: ReserveWithSpread = {
        ...baseReserve,
        isPaused: true,
      };

      const result = buildRateSimulationResult({
        reserve,
        reserveRateInput: baseReserve,
        isApy: false,
        whitelistMerklCampaignIds: new Set(),
        tydroPointToUsdRate: 1,
        tokenPrice: 1,
        supplyInput: '100000',
        borrowInput: '50000',
        forecastStates: {},
      });

      expect(result.supply.hasInput).toBe(false);
      expect(result.supply.inputUsd).toBe(0);
      expect(result.supply.inputAmount).toBe(0);
      expect(result.supply.afterNative).toBeNull();
      expect(result.supply.afterIncentive).toBeNull();
      expect(result.supply.afterTotal).toBeNull();

      expect(result.borrow.hasInput).toBe(false);
      expect(result.borrow.inputUsd).toBe(0);
      expect(result.borrow.inputAmount).toBe(0);
      expect(result.borrow.afterNative).toBeNull();
      expect(result.borrow.afterIncentive).toBeNull();
      expect(result.borrow.afterTotal).toBeNull();

      expect(result.spread.after).toBeNull();
      expect(result.utilization.after).toBeNull();
    });

    it('TC2: frozen reserve ignores all simulation input (after values all null)', () => {
      const reserve: ReserveWithSpread = {
        ...baseReserve,
        isFrozen: true,
      };

      const result = buildRateSimulationResult({
        reserve,
        reserveRateInput: baseReserve,
        isApy: false,
        whitelistMerklCampaignIds: new Set(),
        tydroPointToUsdRate: 1,
        tokenPrice: 1,
        supplyInput: '100000',
        borrowInput: '50000',
        forecastStates: {},
      });

      expect(result.supply.hasInput).toBe(false);
      expect(result.supply.inputUsd).toBe(0);
      expect(result.supply.afterNative).toBeNull();
      expect(result.supply.afterIncentive).toBeNull();
      expect(result.supply.afterTotal).toBeNull();

      expect(result.borrow.hasInput).toBe(false);
      expect(result.borrow.inputUsd).toBe(0);
      expect(result.borrow.afterNative).toBeNull();
      expect(result.borrow.afterIncentive).toBeNull();
      expect(result.borrow.afterTotal).toBeNull();

      expect(result.spread.after).toBeNull();
      expect(result.utilization.after).toBeNull();
    });

    it('TC3: both supplyDisabled and borrowDisabled → all after null', () => {
      const reserve: ReserveWithSpread = {
        ...baseReserve,
        supplyDisabled: true,
        borrowDisabled: true,
      };

      const result = buildRateSimulationResult({
        reserve,
        reserveRateInput: baseReserve,
        isApy: false,
        whitelistMerklCampaignIds: new Set(),
        tydroPointToUsdRate: 1,
        tokenPrice: 1,
        supplyInput: '100000',
        borrowInput: '50000',
        forecastStates: {},
      });

      expect(result.supply.hasInput).toBe(false);
      expect(result.supply.afterNative).toBeNull();
      expect(result.supply.afterIncentive).toBeNull();
      expect(result.supply.afterTotal).toBeNull();

      expect(result.borrow.hasInput).toBe(false);
      expect(result.borrow.afterNative).toBeNull();
      expect(result.borrow.afterIncentive).toBeNull();
      expect(result.borrow.afterTotal).toBeNull();

      expect(result.spread.after).toBeNull();
      expect(result.utilization.after).toBeNull();
    });

    it('TC4: supplyDisabled only → supply lane blocked, borrow lane works', () => {
      const reserve: ReserveWithSpread = {
        ...baseReserve,
        supplyDisabled: true,
        borrowDisabled: false,
      };

      const result = buildRateSimulationResult({
        reserve,
        reserveRateInput: baseReserve,
        isApy: false,
        whitelistMerklCampaignIds: new Set(),
        tydroPointToUsdRate: 1,
        tokenPrice: 1,
        supplyInput: '100000',
        borrowInput: '20000',
        forecastStates: {},
      });

      expect(result.supply.hasInput).toBe(false);
      expect(result.supply.inputUsd).toBe(0);
      expect(result.supply.afterNative).toBeNull();
      expect(result.supply.afterIncentive).toBeNull();
      expect(result.supply.afterTotal).toBeNull();

      expect(result.borrow.hasInput).toBe(true);
      expect(result.borrow.afterNative).not.toBeNull();
      expect(result.borrow.afterIncentive).not.toBeNull();
      expect(result.borrow.afterTotal).not.toBeNull();

      expect(result.utilization.after).not.toBeNull();

      expect(result.marketMetrics.totalBorrowedUsdAfter).not.toBeNull();
      expect(result.marketMetrics.availableLiquidityUsdAfter).not.toBeNull();
    });

    it('TC5: borrowDisabled only → borrow lane blocked, supply lane works', () => {
      const reserve: ReserveWithSpread = {
        ...baseReserve,
        supplyDisabled: false,
        borrowDisabled: true,
      };

      const result = buildRateSimulationResult({
        reserve,
        reserveRateInput: baseReserve,
        isApy: false,
        whitelistMerklCampaignIds: new Set(),
        tydroPointToUsdRate: 1,
        tokenPrice: 1,
        supplyInput: '100000',
        borrowInput: '20000',
        forecastStates: {},
      });

      expect(result.borrow.hasInput).toBe(false);
      expect(result.borrow.inputUsd).toBe(0);
      expect(result.borrow.afterNative).toBeNull();
      expect(result.borrow.afterIncentive).toBeNull();
      expect(result.borrow.afterTotal).toBeNull();

      expect(result.supply.hasInput).toBe(true);
      expect(result.supply.afterNative).not.toBeNull();
      expect(result.supply.afterIncentive).not.toBeNull();
      expect(result.supply.afterTotal).not.toBeNull();

      expect(result.utilization.after).not.toBeNull();

      expect(result.marketMetrics.totalBorrowedUsdAfter).toBeNull();
      expect(result.marketMetrics.availableLiquidityUsdAfter).not.toBeNull();
    });

    it('TC6: paused reserve with only supply input → all after null', () => {
      const reserve: ReserveWithSpread = {
        ...baseReserve,
        isPaused: true,
      };

      const result = buildRateSimulationResult({
        reserve,
        reserveRateInput: baseReserve,
        isApy: false,
        whitelistMerklCampaignIds: new Set(),
        tydroPointToUsdRate: 1,
        tokenPrice: 1,
        supplyInput: '100000',
        borrowInput: '',
        forecastStates: {},
      });

      expect(result.supply.hasInput).toBe(false);
      expect(result.supply.afterTotal).toBeNull();
      expect(result.utilization.after).toBeNull();
    });

    it('TC7: frozen reserve with only borrow input → all after null', () => {
      const reserve: ReserveWithSpread = {
        ...baseReserve,
        isFrozen: true,
      };

      const result = buildRateSimulationResult({
        reserve,
        reserveRateInput: baseReserve,
        isApy: false,
        whitelistMerklCampaignIds: new Set(),
        tydroPointToUsdRate: 1,
        tokenPrice: 1,
        supplyInput: '',
        borrowInput: '50000',
        forecastStates: {},
      });

      expect(result.borrow.hasInput).toBe(false);
      expect(result.borrow.afterTotal).toBeNull();
      expect(result.utilization.after).toBeNull();
    });
  });

  it('counts only FIX/MAX_REWARD campaigns missing forecast data', () => {
    const reserve: ReserveWithSpread = {
      ...baseReserve,
      merklSupplys: [
        {
          name: 'Dutch opp',
          breakdowns: [
            {
              campaignApr: 10,
              campaignStartedAt: '2020-01-01T00:00:00.000Z',
              campaignEndedAt: '2099-01-01T00:00:00.000Z',
              campaignId: 'dutch1',
              campaignType: 'DUTCH_AUCTION',
              plannedDaily: 10,
              aprCap: null,
              totalBudget: 100000,
            },
          ],
        },
        {
          name: 'Fix opp',
          breakdowns: [
            {
              campaignApr: 5,
              campaignStartedAt: '2020-01-01T00:00:00.000Z',
              campaignEndedAt: '2099-01-01T00:00:00.000Z',
              campaignId: 'fix1',
              campaignType: 'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
              plannedDaily: 10,
              aprCap: 5,
              totalBudget: 100000,
            },
            {
              campaignApr: 3,
              campaignStartedAt: '2020-01-01T00:00:00.000Z',
              campaignEndedAt: '2099-01-01T00:00:00.000Z',
              campaignId: 'fix2',
              campaignType: 'MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
              plannedDaily: 10,
              aprCap: 5,
              totalBudget: 100000,
            },
          ],
        },
      ],
    };

    const result = buildRateSimulationResult({
      reserve,
      reserveRateInput: baseReserve,
      isApy: false,
      whitelistMerklCampaignIds: new Set(),
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '1000',
      borrowInput: '0',
      forecastStates: { fix1: { campaignId: 'fix1', distributedSoFar: 0, endTimestamp: Math.floor(Date.now() / 1000) + 86400 * 30 } },
    });

    // dutch1 excluded, fix1 has forecast, fix2 missing forecast
    expect(result.forecastUnavailableCampaignCount).toBe(1);
    expect(result.forecastUnavailableCampaignIds).toEqual(['fix2']);
  });
});

/**
 * Regression coverage for the perf optimization that replaced the unstable
 * `priceQueries` array dep with stable structural signatures.
 *
 * Invariants under test:
 *  - same logical price set → same signature (memo skip)
 *  - any value change → different signature (memo invalidate)
 *  - null vs undefined collapsed to same signature (transport quirk)
 *  - structural encoding is collision-resistant for ordering / digit boundaries
 *  - loading signature collapses to constant when consumer wouldn't read it
 */
describe('buildPriceDataSignature', () => {
  it('produces identical signatures for identical price values across new array refs', () => {
    const a = buildPriceDataSignature([{ data: 1 }, { data: 2.5 }, { data: null }]);
    const b = buildPriceDataSignature([{ data: 1 }, { data: 2.5 }, { data: null }]);
    expect(a).toBe(b);
  });

  it('treats null and undefined as equivalent (transport may emit either)', () => {
    const withNull = buildPriceDataSignature([{ data: null }]);
    const withUndef = buildPriceDataSignature([{ data: undefined }]);
    const missing = buildPriceDataSignature([{}]);
    expect(withNull).toBe(withUndef);
    expect(withUndef).toBe(missing);
  });

  it('produces a different signature when any single price changes', () => {
    const before = buildPriceDataSignature([{ data: 1 }, { data: 2 }, { data: 3 }]);
    const after = buildPriceDataSignature([{ data: 1 }, { data: 2.0001 }, { data: 3 }]);
    expect(before).not.toBe(after);
  });

  it('produces a different signature when price ordering changes', () => {
    const a = buildPriceDataSignature([{ data: 1 }, { data: 2 }]);
    const b = buildPriceDataSignature([{ data: 2 }, { data: 1 }]);
    expect(a).not.toBe(b);
  });

  it('produces a different signature when array length changes', () => {
    const shorter = buildPriceDataSignature([{ data: 1 }, { data: 2 }]);
    const longer = buildPriceDataSignature([{ data: 1 }, { data: 2 }, { data: null }]);
    expect(shorter).not.toBe(longer);
  });

  it('does NOT collide on digit-boundary cases that a delimiter join could fold', () => {
    // [1, 23] and [12, 3] would both serialize to "1|23" / "12|3" with a join
    // delimiter — JSON encoding makes the boundary unambiguous.
    const a = buildPriceDataSignature([{ data: 1 }, { data: 23 }]);
    const b = buildPriceDataSignature([{ data: 12 }, { data: 3 }]);
    expect(a).not.toBe(b);
  });

  it('handles empty input deterministically', () => {
    expect(buildPriceDataSignature([])).toBe(buildPriceDataSignature([]));
  });
});

describe('buildPriceLoadingSignature', () => {
  it('collapses to a stable empty signature when needsTokenPrice is false', () => {
    const a = buildPriceLoadingSignature(
      [{ isPending: true }, { isFetching: true }, {}],
      false,
    );
    const b = buildPriceLoadingSignature(
      [{}, {}, {}],
      false,
    );
    // Loading state is irrelevant to consumers when not in token-price mode,
    // so the signature should not change with it.
    expect(a).toBe(b);
  });

  it('reflects loading flags when needsTokenPrice is true', () => {
    const idle = buildPriceLoadingSignature([{}, {}], true);
    const someLoading = buildPriceLoadingSignature(
      [{ isPending: true }, {}],
      true,
    );
    expect(idle).not.toBe(someLoading);
  });

  it('treats isPending and isFetching as equivalent loading sources', () => {
    const pending = buildPriceLoadingSignature([{ isPending: true }], true);
    const fetching = buildPriceLoadingSignature([{ isFetching: true }], true);
    expect(pending).toBe(fetching);
  });

  it('produces stable signatures across calls with identical input', () => {
    const a = buildPriceLoadingSignature(
      [{ isPending: true }, { isFetching: false }, {}],
      true,
    );
    const b = buildPriceLoadingSignature(
      [{ isPending: true }, { isFetching: false }, {}],
      true,
    );
    expect(a).toBe(b);
  });
});

describe('buildRateSimulationResult — merkl per-group cross-reserve net eligibility', () => {
  const usdeReserveId = '1:0xPool:0xUSDe';

  const noIncentiveReserve = { ...baseReserve, supplyIncentives: [] as number[], borrowIncentives: [] as number[] };

  const merklGroupWithConstraint: MerklOpportunityGroup = {
    name: 'USDT0 net lending',
    breakdowns: [
      {
        campaignApr: 10,
        campaignStartedAt: '2020-01-01T00:00:00.000Z',
        campaignEndedAt: '2099-01-01T00:00:00.000Z',
        campaignId: 'net-lend-1',
      },
    ],
    opportunityType: 'AAVE_NET_LENDING',
    netPositionConstraint: {
      sourceSide: 'supply',
      offsetReserveIds: [usdeReserveId],
    },
  };

  it('no reservePositions → full merkl APR (backward compat)', () => {
    const reserve: ReserveWithSpread = {
      ...noIncentiveReserve,
      merklSupplys: [merklGroupWithConstraint],
    };
    const withoutPositions = buildRateSimulationResult({
      reserve,
      reserveRateInput: noIncentiveReserve,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '1000',
      borrowInput: '0',
      forecastStates: {},
      meritMerklNetPosition: false,
    });
    const withEmptyPositions = buildRateSimulationResult({
      reserve,
      reserveRateInput: noIncentiveReserve,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '1000',
      borrowInput: '0',
      forecastStates: {},
      meritMerklNetPosition: false,
      reservePositions: new Map(),
    });
    expect(withoutPositions.supply.afterIncentive).toBe(withEmptyPositions.supply.afterIncentive);
    expect(withoutPositions.supply.afterIncentive).toBeCloseTo(10, 1);
  });

  it('offset reserve has borrow → supply incentive scaled down', () => {
    const reserve: ReserveWithSpread = {
      ...noIncentiveReserve,
      merklSupplys: [merklGroupWithConstraint],
    };
    const reservePositions = new Map([
      [usdeReserveId, { supplyUsd: 0, borrowUsd: 600 }],
    ]);
    const result = buildRateSimulationResult({
      reserve,
      reserveRateInput: noIncentiveReserve,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '1000',
      borrowInput: '0',
      forecastStates: {},
      meritMerklNetPosition: false,
      reservePositions,
    });
    expect(result.supply.afterIncentive).toBeCloseTo(4, 1);
  });

  it('offset reserve has no borrow → full incentive', () => {
    const reserve: ReserveWithSpread = {
      ...noIncentiveReserve,
      merklSupplys: [merklGroupWithConstraint],
    };
    const reservePositions = new Map([
      [usdeReserveId, { supplyUsd: 500, borrowUsd: 0 }],
    ]);
    const result = buildRateSimulationResult({
      reserve,
      reserveRateInput: noIncentiveReserve,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '1000',
      borrowInput: '0',
      forecastStates: {},
      meritMerklNetPosition: false,
      reservePositions,
    });
    expect(result.supply.afterIncentive).toBeCloseTo(10, 1);
  });

  it('offset borrow >= supply → incentive zeroed', () => {
    const reserve: ReserveWithSpread = {
      ...noIncentiveReserve,
      merklSupplys: [merklGroupWithConstraint],
    };
    const reservePositions = new Map([
      [usdeReserveId, { supplyUsd: 0, borrowUsd: 1200 }],
    ]);
    const result = buildRateSimulationResult({
      reserve,
      reserveRateInput: noIncentiveReserve,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '1000',
      borrowInput: '0',
      forecastStates: {},
      meritMerklNetPosition: false,
      reservePositions,
    });
    expect(result.supply.afterIncentive).toBeCloseTo(0, 1);
  });

  it('multiple groups: constrained scaled, unconstrained full', () => {
    const unconstrainedGroup: MerklOpportunityGroup = {
      name: 'Standard merkl',
      breakdowns: [
        {
          campaignApr: 5,
          campaignStartedAt: '2020-01-01T00:00:00.000Z',
          campaignEndedAt: '2099-01-01T00:00:00.000Z',
          campaignId: 'std-1',
        },
      ],
    };
    const reserve: ReserveWithSpread = {
      ...noIncentiveReserve,
      merklSupplys: [merklGroupWithConstraint, unconstrainedGroup],
    };
    const reservePositions = new Map([
      [usdeReserveId, { supplyUsd: 0, borrowUsd: 500 }],
    ]);
    const result = buildRateSimulationResult({
      reserve,
      reserveRateInput: noIncentiveReserve,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '1000',
      borrowInput: '0',
      forecastStates: {},
      meritMerklNetPosition: false,
      reservePositions,
    });
    expect(result.supply.afterIncentive).toBeCloseTo(10, 1);
  });
});

describe('buildRateSimulationResult — merkl cross-reserve note in campaign details', () => {
  const usdeReserveId = '1:0xPool:0xUSDe';
  const noIncentiveReserve = { ...baseReserve, supplyIncentives: [] as number[], borrowIncentives: [] as number[] };

  const merklGroupWithConstraint: MerklOpportunityGroup = {
    name: 'USDT0 net lending',
    breakdowns: [
      {
        campaignApr: 10,
        campaignStartedAt: '2020-01-01T00:00:00.000Z',
        campaignEndedAt: '2099-01-01T00:00:00.000Z',
        campaignId: 'net-lend-note-1',
      },
    ],
    opportunityType: 'AAVE_NET_LENDING',
    netPositionConstraint: {
      sourceSide: 'supply',
      offsetReserveIds: [usdeReserveId],
    },
  };

  it('includes cross-reserve note when groupMultiplier < 1 and reserveSymbolById provided', () => {
    const reserve: ReserveWithSpread = {
      ...noIncentiveReserve,
      merklSupplys: [merklGroupWithConstraint],
    };
    const reservePositions = new Map([
      [usdeReserveId, { supplyUsd: 0, borrowUsd: 600 }],
    ]);
    const reserveSymbolById = new Map([
      [usdeReserveId, 'USDe'],
    ]);
    const result = buildRateSimulationResult({
      reserve,
      reserveRateInput: noIncentiveReserve,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '1000',
      borrowInput: '0',
      forecastStates: {},
      meritMerklNetPosition: false,
      reservePositions,
      reserveSymbolById,
    });
    const merklCampaigns = result.supply.sources.merkl.campaigns;
    expect(merklCampaigns).toBeDefined();
    expect(merklCampaigns!.length).toBeGreaterThan(0);
    expect(merklCampaigns![0].capNote).toContain('USDe');
  });

  it('no cross-reserve note when no reserveSymbolById', () => {
    const reserve: ReserveWithSpread = {
      ...noIncentiveReserve,
      merklSupplys: [merklGroupWithConstraint],
    };
    const reservePositions = new Map([
      [usdeReserveId, { supplyUsd: 0, borrowUsd: 600 }],
    ]);
    const result = buildRateSimulationResult({
      reserve,
      reserveRateInput: noIncentiveReserve,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '1000',
      borrowInput: '0',
      forecastStates: {},
      meritMerklNetPosition: false,
      reservePositions,
    });
    const merklCampaigns = result.supply.sources.merkl.campaigns;
    expect(merklCampaigns).toBeDefined();
    expect(merklCampaigns!.length).toBeGreaterThan(0);
    expect(merklCampaigns![0].capNote).toBeUndefined();
  });

  it('no cross-reserve note when no constraint on group', () => {
    const unconstrainedGroup: MerklOpportunityGroup = {
      name: 'Standard merkl',
      breakdowns: [
        {
          campaignApr: 10,
          campaignStartedAt: '2020-01-01T00:00:00.000Z',
          campaignEndedAt: '2099-01-01T00:00:00.000Z',
          campaignId: 'std-note-1',
        },
      ],
    };
    const reserve: ReserveWithSpread = {
      ...noIncentiveReserve,
      merklSupplys: [unconstrainedGroup],
    };
    const reservePositions = new Map([
      [usdeReserveId, { supplyUsd: 0, borrowUsd: 600 }],
    ]);
    const reserveSymbolById = new Map([
      [usdeReserveId, 'USDe'],
    ]);
    const result = buildRateSimulationResult({
      reserve,
      reserveRateInput: noIncentiveReserve,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '1000',
      borrowInput: '0',
      forecastStates: {},
      meritMerklNetPosition: false,
      reservePositions,
      reserveSymbolById,
    });
    const merklCampaigns = result.supply.sources.merkl.campaigns;
    expect(merklCampaigns).toBeDefined();
    expect(merklCampaigns!.length).toBeGreaterThan(0);
    expect(merklCampaigns![0].capNote).toBeUndefined();
  });
});
