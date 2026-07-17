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
      tydroPointToUsdRate: 0,
      opportunities,
      inputUsd: 1000,
      forecastStates: states,
      whitelistMerklCampaignIds: new Set(),
      pointRateMap: { tydroinkpoints: 1 },
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
      tydroPointToUsdRate: 0,
      opportunities,
      inputUsd: 5000,
      forecastStates: states,
      whitelistMerklCampaignIds: new Set(),
      pointRateMap: { tydroinkpoints: 1 },
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
            rewardTokenSymbol: 'TydroInkPoints',
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
      tydroPointToUsdRate: 0,
      opportunities,
      inputUsd: 1_000,
      forecastStates: states,
      whitelistMerklCampaignIds: new Set(),
      pointRateMap: { tydroinkpoints: 2 },
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
            rewardTokenSymbol: 'TydroInkPoints',
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
      tydroPointToUsdRate: 0,
      opportunities,
      inputUsd: 1_000,
      forecastStates: states,
      whitelistMerklCampaignIds: new Set(),
      pointRateMap: { tydroinkpoints: 2 },
    });

    expect(result[0].breakdowns[0].campaignApr).toBeCloseTo(5, 10);
  });
});

describe('buildRateSimulationResult', () => {
  it('recomputes supply, spread, borrow, and utilization from one shared scenario', () => {
    const result = buildRateSimulationResult({
      tydroPointToUsdRate: 0,
      reserve: baseReserve,
      reserveRateInput: baseReserve,
      isApy: true,
      whitelistMerklCampaignIds: new Set(),
      pointRateMap: { tydroinkpoints: 1 },
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
      tydroPointToUsdRate: 0,
      reserve: baseReserve,
      reserveRateInput: baseReserve,
      isApy: false,
      whitelistMerklCampaignIds: new Set(),
      pointRateMap: { tydroinkpoints: 1 },
      tokenPrice: 1,
      supplyInput: '36500',
      borrowInput: '3650',
      forecastStates: {},
    });
    const apyModeResult = buildRateSimulationResult({
      tydroPointToUsdRate: 0,
      reserve: baseReserve,
      reserveRateInput: baseReserve,
      isApy: true,
      whitelistMerklCampaignIds: new Set(),
      pointRateMap: { tydroinkpoints: 1 },
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
    // afterNative is always APY (per AprApyToggle contract: "native stays APY").
    // scenarioUsdAccrual uses APR for daily cashflow (per-second compounding),
    // so we can't directly verify the exact amount from afterNative (which is APY).
    // The cross-mode equality above already proves the accrual uses the same
    // underlying APR regardless of display mode.
    expect(aprAcc.netUsdPerDay).toBeCloseTo(
      (aprAcc.supply!.totalUsdPerDay ?? 0) + (aprAcc.borrow!.totalUsdPerDay ?? 0),
      5
    );
  });

  it('keeps incentive scenarioUsdAccrual on fixed APR-linear daily USD in APY mode', () => {
    const apyModeResult = buildRateSimulationResult({
      tydroPointToUsdRate: 0,
      reserve: baseReserve,
      reserveRateInput: baseReserve,
      isApy: true,
      whitelistMerklCampaignIds: new Set(),
      pointRateMap: { tydroinkpoints: 1 },
      tokenPrice: 1,
      supplyInput: '36500',
      borrowInput: '3650',
      forecastStates: {},
    });
    const aprModeResult = buildRateSimulationResult({
      tydroPointToUsdRate: 0,
      reserve: baseReserve,
      reserveRateInput: baseReserve,
      isApy: false,
      whitelistMerklCampaignIds: new Set(),
      pointRateMap: { tydroinkpoints: 1 },
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
      tydroPointToUsdRate: 0,
      reserve,
      reserveRateInput: baseReserve,
      isApy: false,
      whitelistMerklCampaignIds: new Set(),
      pointRateMap: { tydroinkpoints: 1 },
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
      tydroPointToUsdRate: 0,
      reserve,
      reserveRateInput: baseReserve,
      isApy: false,
      whitelistMerklCampaignIds: new Set<string>(),
      pointRateMap: { tydroinkpoints: 1 },
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
      tydroPointToUsdRate: 0,
      reserve,
      reserveRateInput: baseReserve,
      isApy: false,
      whitelistMerklCampaignIds: new Set(),
      pointRateMap: { tydroinkpoints: 1 },
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
              campaignStartedAt: '2026-03-24T14:00:00.000Z',
              campaignEndedAt: '2099-03-31T14:00:00.000Z',
              campaignId: '16403393592832236981',
              campaignType: 'DUTCH_AUCTION',
              plannedDaily: 11312,
              aprCap: null,
              totalBudget: 79184,
              latestTvl: 23586552.55647095,
              rewardTokenSymbol: 'TydroInkPoints',
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
      tydroPointToUsdRate: 0,
      reserve,
      reserveRateInput: baseReserve,
      isApy: false,
      whitelistMerklCampaignIds: new Set(),
      pointRateMap: { tydroinkpoints: 1 },
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
              campaignStartedAt: '2026-03-24T14:00:00.000Z',
              campaignEndedAt: '2099-03-31T14:00:00.000Z',
              campaignId: '16403393592832236981',
              campaignType: 'DUTCH_AUCTION',
              plannedDaily: 11312,
              aprCap: null,
              totalBudget: 79184,
              latestTvl: 23586552.55647095,
              rewardTokenSymbol: 'TydroInkPoints',
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
      tydroPointToUsdRate: 0,
      reserve,
      reserveRateInput: baseReserve,
      isApy: true,
      whitelistMerklCampaignIds: new Set(),
      pointRateMap: { tydroinkpoints: 1 },
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
          link: 'https://apps.aavechan.com/merit/celo-supply-usdt',
          name: 'Supply USDT',
          message: [
            {
              action: 'Supply USDT',
              description:
                'Rewards are distributed using the following formula: f(USD. aToken Holding - USD. vToken Holding / USD. Liquidation Threshold)',
            },
            {
              action: 'Self Authentication',
              description:
                'Supply USDT and double your yield by verifying your humanity through Self for the first $1000 USDT supplied per user.',
            },
          ] as unknown as string,
          breakdowns: [
            {
              campaignApr: 4.084439890516138,
              campaignStartedAt: '2020-01-01',
              campaignEndedAt: '2099-01-01',
              campaignId: 'merit-base-use-rate',
            },
            {
              campaignApr: 4.084439890516138,
              campaignStartedAt: '2020-01-01',
              campaignEndedAt: '2099-01-01',
              campaignId: 'merit-self-use-rate',
              positionCapUsd: 1000,
            },
          ],
        },
      ],
    };

    const result = buildRateSimulationResult({
      tydroPointToUsdRate: 0,
      reserve,
      reserveRateInput: baseReserve,
      isApy: false,
      whitelistMerklCampaignIds: new Set(),
      pointRateMap: { tydroinkpoints: 1 },
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
      tydroPointToUsdRate: 0,
      reserve: baseReserve,
      reserveRateInput: baseReserve,
      isApy: true,
      whitelistMerklCampaignIds: new Set(),
      pointRateMap: { tydroinkpoints: 1 },
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
          campaignType: 'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
          aprCap: 10,
          positionCapUsd: 5000,
          latestTvl: 1_000_000,
          totalBudget: 100_000,
          campaignId: 'brevis-supply',
          name: 'Brevis Supply',
          message: 'Brevis Supply',
          breakdowns: [
            {
              campaignApr: 10,
              campaignStartedAt: '2020-01-01T00:00:00.000Z',
              campaignEndedAt: endDate,
              campaignType: 'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
              aprCap: 10,
              positionCapUsd: 5000,
              latestTvl: 1_000_000,
              totalBudget: 100_000,
              campaignId: 'brevis-supply',
            },
          ],
        },
      ],
    };

    const result = buildRateSimulationResult({
      tydroPointToUsdRate: 0,
      reserve,
      reserveRateInput: baseReserve,
      isApy: false,
      whitelistMerklCampaignIds: new Set(),
      pointRateMap: { tydroinkpoints: 1 },
      tokenPrice: 1,
      supplyInput: '100000',
      borrowInput: '0',
      inputMode: 'usd',
      forecastStates: {},
    });

    expect(result.supply.sources.brevis.current).toBe(10);
    expect(result.supply.sources.brevis.after).toBeLessThan(10);
    expect(result.supply.sources.brevis.after).toBeCloseTo(0.5, 1);
    expect(result.supply.afterIncentive).toBeLessThan(result.supply.currentIncentive);
  });

  it('brevis capNote shows ~Nd to end when no budget data, ~Nd earn when budget data present', () => {
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
          campaignType: 'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
          positionCapUsd: 5000,
          campaignId: 'brevis-supply',
          name: 'Brevis Supply',
          message: 'Brevis Supply',
          breakdowns: [
            {
              campaignApr: 10,
              campaignStartedAt: '2020-01-01T00:00:00.000Z',
              campaignEndedAt: endDate,
              campaignType: 'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
              positionCapUsd: 5000,
              campaignId: 'brevis-supply',
            },
          ],
        },
      ],
    };

    const result = buildRateSimulationResult({
      tydroPointToUsdRate: 0,
      reserve,
      reserveRateInput: baseReserve,
      isApy: false,
      whitelistMerklCampaignIds: new Set(),
      pointRateMap: { tydroinkpoints: 1 },
      tokenPrice: 1,
      supplyInput: '100000',
      borrowInput: '0',
      inputMode: 'usd',
      forecastStates: {},
    });

    const noteText = result.supply.sources.brevis.campaigns?.[0]?.notes?.[0]?.text;
    expect(noteText).toBeDefined();
    expect(noteText).toMatch(/~\d+d to end/);
    const m = noteText!.match(/~(\d+)d to end/);
    expect(m).not.toBeNull();
    const n = Number(m![1]);
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
          campaignType: 'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
          message: 'Brevis Supply',
          positionCapUsd: 5000,
        },
      ],
    };

    const result = buildRateSimulationResult({
      tydroPointToUsdRate: 0,
      reserve,
      reserveRateInput: baseReserve,
      isApy: false,
      whitelistMerklCampaignIds: new Set(),
      pointRateMap: { tydroinkpoints: 1 },
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

  it('keeps brevis incentive unchanged when positionCap is absent', () => {
    const reserve: ReserveWithSpread = {
      ...baseReserve,
      brevisSupplys: [
        {
          campaignApr: 10,
          link: 'https://example.com/brevis',
          campaignStartedAt: '2020-01-01T00:00:00.000Z',
          campaignEndedAt: '2099-01-01T00:00:00.000Z',
          campaignType: 'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
          message: 'Brevis Supply',
        },
      ],
    };

    const result = buildRateSimulationResult({
      tydroPointToUsdRate: 0,
      reserve,
      reserveRateInput: baseReserve,
      isApy: false,
      whitelistMerklCampaignIds: new Set(),
      pointRateMap: { tydroinkpoints: 1 },
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
          campaignType: 'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
          message: 'Brevis Borrow',
          positionCapUsd: 5000,
        },
      ],
    };

    const result = buildRateSimulationResult({
      tydroPointToUsdRate: 0,
      reserve,
      reserveRateInput: baseReserve,
      isApy: false,
      whitelistMerklCampaignIds: new Set(),
      pointRateMap: { tydroinkpoints: 1 },
      tokenPrice: 1,
      supplyInput: '0',
      borrowInput: '200000',
      inputMode: 'usd',
      forecastStates: {},
    });

    expect(result.borrow.sources.brevis.current).toBe(8);
    // position cap: nominalApr × min(position, cap) / position = 8 × 5000/200000 = 0.2%
    expect(result.borrow.sources.brevis.after).toBeLessThan(8);
    expect(result.borrow.sources.brevis.after).toBeCloseTo(0.2, 1);
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
          campaignType: 'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
          message: 'Brevis Supply (no end)',
          positionCapUsd: 5000,
        },
      ],
    };

    const result = buildRateSimulationResult({
      tydroPointToUsdRate: 0,
      reserve,
      reserveRateInput: baseReserve,
      isApy: false,
      whitelistMerklCampaignIds: new Set(),
      pointRateMap: { tydroinkpoints: 1 },
      tokenPrice: 1,
      supplyInput: '100000',
      borrowInput: '0',
      inputMode: 'usd',
      forecastStates: {},
    });

    // Campaign counted as active; cap can't bind without endDate → nominal APR
    expect(result.supply.sources.brevis.current).toBe(10);
    expect(result.supply.sources.brevis.after).toBeCloseTo(0.5, 1);
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
          campaignType: 'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
          latestTvl: 1_000_000,
          totalBudget: 100_000,
          message: 'Shared campaign',
          positionCapUsd: 5000,
          campaignId: 'linea-usdc',
        },
      ],
      brevisBorrows: [
        {
          link: 'https://example.com/brevis-supply',
          campaignApr: 10,
          campaignStartedAt: '2020-01-01T00:00:00.000Z',
          campaignEndedAt: endDate,
          campaignType: 'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
          latestTvl: 1_000_000,
          totalBudget: 100_000,
          message: 'Shared campaign',
          positionCapUsd: 5000,
          campaignId: 'linea-usdc',
        },
      ],
    };

    const result = buildRateSimulationResult({
      tydroPointToUsdRate: 0,
      reserve,
      reserveRateInput: baseReserve,
      isApy: false,
      whitelistMerklCampaignIds: new Set(),
      pointRateMap: { tydroinkpoints: 1 },
      tokenPrice: 1,
      supplyInput: '50000',
      borrowInput: '50000',
      inputMode: 'usd',
      forecastStates: {},
    });

    // Combined deposit = 100k. Position cap: 10 × min(100k, 5k) / 100k = 0.5%
    // Both sides should see the reduced APR
    expect(result.supply.sources.brevis.after).toBeCloseTo(0.5, 1);
    expect(result.borrow.sources.brevis.after).toBeCloseTo(0.5, 1);
    expect(result.supply.sources.brevis.campaigns?.[0]?.notes?.[0]?.text).toContain(
      'Incentive limited to first $5,000.00',
    );
    expect(result.supply.sources.brevis.campaigns?.[0]?.notes?.[0]?.text).toContain(
      'combine',
    );
    expect(result.supply.sources.brevis.campaigns?.[0]?.notes?.[0]?.text).toBe(result.borrow.sources.brevis.campaigns?.[0]?.notes?.[0]?.text);
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
          campaignType: 'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
          latestTvl: 1_000_000,
          totalBudget: 100_000,
          message: 'Shared campaign',
          positionCapUsd: 5000,
          campaignId: 'linea-usdc',
        },
      ],
      brevisBorrows: [
        {
          link: 'https://example.com/brevis-shared',
          campaignApr: 10,
          campaignStartedAt: '2020-01-01T00:00:00.000Z',
          campaignEndedAt: endDate,
          campaignType: 'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
          latestTvl: 1_000_000,
          totalBudget: 100_000,
          message: 'Shared campaign',
          positionCapUsd: 5000,
          campaignId: 'linea-usdc',
        },
      ],
    };

    const result = buildRateSimulationResult({
      tydroPointToUsdRate: 0,
      reserve,
      reserveRateInput: baseReserve,
      isApy: false,
      whitelistMerklCampaignIds: new Set(),
      pointRateMap: { tydroinkpoints: 1 },
      tokenPrice: 1,
      supplyInput: '0',
      borrowInput: '50000',
      inputMode: 'usd',
      forecastStates: {},
    });

    expect(result.supply.sources.brevis.campaigns?.[0]?.notes?.[0]?.text).toContain(
      'Incentive limited to first $5,000.00',
    );
    expect(result.supply.sources.brevis.campaigns?.[0]?.notes?.[0]?.text).toContain(
      'combine',
    );
    expect(result.borrow.sources.brevis.campaigns?.[0]?.notes?.[0]?.text).toContain(
      'Incentive limited to first $5,000.00',
    );
    expect(result.borrow.sources.brevis.campaigns?.[0]?.notes?.[0]?.text).toContain(
      'combine',
    );
    expect(result.supply.sources.brevis.campaigns?.[0]?.notes?.[0]?.text).toBe(result.borrow.sources.brevis.campaigns?.[0]?.notes?.[0]?.text);
    expect(result.supply.sources.brevis.after).not.toBeNull();
    expect(result.borrow.sources.brevis.after).toBeCloseTo(1, 0);
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
          campaignType: 'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
          message: 'Brevis Supply',
          positionCapUsd: 5000,
        },
      ],
      brevisBorrows: [
        {
          campaignApr: 10,
          link: 'https://example.com/brevis-borrow',
          campaignStartedAt: '2020-01-01T00:00:00.000Z',
          campaignEndedAt: endDate,
          campaignType: 'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
          message: 'Brevis Borrow',
          positionCapUsd: 5000,
        },
      ],
    };

    const result = buildRateSimulationResult({
      tydroPointToUsdRate: 0,
      reserve,
      reserveRateInput: baseReserve,
      isApy: false,
      whitelistMerklCampaignIds: new Set(),
      pointRateMap: { tydroinkpoints: 1 },
      tokenPrice: 1,
      supplyInput: '50000',
      borrowInput: '50000',
      inputMode: 'usd',
      forecastStates: {},
    });

    // No shared group → each side evaluated independently
    // 50k deposit per side, position cap: 10 × min(50k, 5k) / 50k = 1%
    expect(result.supply.sources.brevis.after).toBeCloseTo(1, 0);
    expect(result.borrow.sources.brevis.after).toBeCloseTo(1, 0);
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
          campaignType: 'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
          latestTvl: 1_000_000,
          totalBudget: 100_000,
          message: 'Shared campaign',
          positionCapUsd: 5000,
          campaignId: 'linea-usdc',
        },
      ],
      brevisBorrows: [
        {
          link: 'https://example.com/brevis-shared',
          campaignApr: 12,
          campaignStartedAt: '2020-01-01T00:00:00.000Z',
          campaignEndedAt: endDate,
          campaignType: 'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
          latestTvl: 1_000_000,
          totalBudget: 100_000,
          message: 'Shared campaign',
          positionCapUsd: 5000,
          campaignId: 'linea-usdc',
        },
      ],
    };

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = buildRateSimulationResult({
      tydroPointToUsdRate: 0,
      reserve,
      reserveRateInput: baseReserve,
      isApy: false,
      whitelistMerklCampaignIds: new Set(),
      pointRateMap: { tydroinkpoints: 1 },
      tokenPrice: 1,
      supplyInput: '50000',
      borrowInput: '50000',
      inputMode: 'usd',
      forecastStates: {},
    });

    expect(result.supply.sources.brevis.after).toBeCloseTo(1, 0);
    expect(result.borrow.sources.brevis.after).toBeCloseTo(1.2, 1);
    expect(result.supply.sources.brevis.campaigns?.[0]?.notes?.[0]?.text).not.toContain('supply + borrow');
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
          campaignType: 'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
          message: 'Brevis open-ended',
        },
      ],
    };

    const result = buildRateSimulationResult({
      tydroPointToUsdRate: 0,
      reserve,
      reserveRateInput: baseReserve,
      isApy: false,
      whitelistMerklCampaignIds: new Set(),
      pointRateMap: { tydroinkpoints: 1 },
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
      tydroPointToUsdRate: 0,
      reserve,
      reserveRateInput: baseReserve,
      isApy: false,
      whitelistMerklCampaignIds: new Set(),
      pointRateMap: { tydroinkpoints: 1 },
      tokenPrice: 1,
      supplyInput: '1000',
      borrowInput: '0',
      forecastStates: states,
    });

    const rows = result.supply.sources.merkl.campaigns ?? [];
    expect(rows.find((r) => r.id.includes('dutch1'))?.notes).toBeUndefined();
    expect(rows.find((r) => r.id.includes('dutch2'))?.notes).toBeUndefined();
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
      tydroPointToUsdRate: 0,
      reserve,
      reserveRateInput: baseReserve,
      isApy: false,
      whitelistMerklCampaignIds: new Set(),
      pointRateMap: { tydroinkpoints: 1 },
      tokenPrice: 1,
      supplyInput: '1000',
      borrowInput: '0',
      forecastStates: {},
    });

    expect(result.forecastUnavailableCampaignCount).toBe(0);
  });

  describe('blocked / disabled reserves', () => {
    it('TC1: paused reserve ignores all simulation input (after values all null)', () => {
      const reserve: ReserveWithSpread = {
        ...baseReserve,
        isPaused: true,
      };

      const result = buildRateSimulationResult({
        tydroPointToUsdRate: 0,
        reserve,
        reserveRateInput: baseReserve,
        isApy: false,
        whitelistMerklCampaignIds: new Set(),
        pointRateMap: { tydroinkpoints: 1 },
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
        tydroPointToUsdRate: 0,
        reserve,
        reserveRateInput: baseReserve,
        isApy: false,
        whitelistMerklCampaignIds: new Set(),
        pointRateMap: { tydroinkpoints: 1 },
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
        tydroPointToUsdRate: 0,
        reserve,
        reserveRateInput: baseReserve,
        isApy: false,
        whitelistMerklCampaignIds: new Set(),
        pointRateMap: { tydroinkpoints: 1 },
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
        tydroPointToUsdRate: 0,
        reserve,
        reserveRateInput: baseReserve,
        isApy: false,
        whitelistMerklCampaignIds: new Set(),
        pointRateMap: { tydroinkpoints: 1 },
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
        tydroPointToUsdRate: 0,
        reserve,
        reserveRateInput: baseReserve,
        isApy: false,
        whitelistMerklCampaignIds: new Set(),
        pointRateMap: { tydroinkpoints: 1 },
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
        tydroPointToUsdRate: 0,
        reserve,
        reserveRateInput: baseReserve,
        isApy: false,
        whitelistMerklCampaignIds: new Set(),
        pointRateMap: { tydroinkpoints: 1 },
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
        tydroPointToUsdRate: 0,
        reserve,
        reserveRateInput: baseReserve,
        isApy: false,
        whitelistMerklCampaignIds: new Set(),
        pointRateMap: { tydroinkpoints: 1 },
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
      tydroPointToUsdRate: 0,
      reserve,
      reserveRateInput: baseReserve,
      isApy: false,
      whitelistMerklCampaignIds: new Set(),
      pointRateMap: { tydroinkpoints: 1 },
      tokenPrice: 1,
      supplyInput: '1000',
      borrowInput: '0',
      forecastStates: { fix1: { campaignId: 'fix1', distributedSoFar: 0, endTimestamp: Math.floor(Date.now() / 1000) + 86400 * 30 } },
    });

    // dutch1 excluded, fix1 has forecast, fix2 missing forecast
    expect(result.forecastUnavailableCampaignCount).toBe(1);
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
    opportunityId: '9830701213305656660',
    netPositionConstraint: {
      sourceSide: 'supply',
      offsetReserveIds: [usdeReserveId],
    },
  };

  it('no crossReservePositions → full merkl APR (backward compat)', () => {
    const reserve: ReserveWithSpread = {
      ...noIncentiveReserve,
      merklSupplys: [merklGroupWithConstraint],
    };
    const withoutPositions = buildRateSimulationResult({
      tydroPointToUsdRate: 0,
      reserve,
      reserveRateInput: noIncentiveReserve,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      pointRateMap: { tydroinkpoints: 1 },
      tokenPrice: 1,
      supplyInput: '1000',
      borrowInput: '0',
      forecastStates: {},
      meritMerklNetPosition: false,
    });
    const withEmptyPositions = buildRateSimulationResult({
      tydroPointToUsdRate: 0,
      reserve,
      reserveRateInput: noIncentiveReserve,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      pointRateMap: { tydroinkpoints: 1 },
      tokenPrice: 1,
      supplyInput: '1000',
      borrowInput: '0',
      forecastStates: {},
      meritMerklNetPosition: false,
      crossReservePositions: new Map(),
    });
    expect(withoutPositions.supply.afterIncentive).toBe(withEmptyPositions.supply.afterIncentive);
    expect(withoutPositions.supply.afterIncentive).toBeCloseTo(10, 1);
  });

  it('offset reserve has borrow → supply incentive scaled down', () => {
    const reserve: ReserveWithSpread = {
      ...noIncentiveReserve,
      merklSupplys: [merklGroupWithConstraint],
    };
    const crossReservePositions = new Map([
      [usdeReserveId, { supplyUsd: 0, borrowUsd: 600 }],
    ]);
    const result = buildRateSimulationResult({
      tydroPointToUsdRate: 0,
      reserve,
      reserveRateInput: noIncentiveReserve,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      pointRateMap: { tydroinkpoints: 1 },
      tokenPrice: 1,
      supplyInput: '1000',
      borrowInput: '0',
      forecastStates: {},
      meritMerklNetPosition: false,
      crossReservePositions,
    });
    expect(result.supply.afterIncentive).toBeCloseTo(4, 1);
  });

  it('offset reserve has no borrow → full incentive', () => {
    const reserve: ReserveWithSpread = {
      ...noIncentiveReserve,
      merklSupplys: [merklGroupWithConstraint],
    };
    const crossReservePositions = new Map([
      [usdeReserveId, { supplyUsd: 500, borrowUsd: 0 }],
    ]);
    const result = buildRateSimulationResult({
      tydroPointToUsdRate: 0,
      reserve,
      reserveRateInput: noIncentiveReserve,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      pointRateMap: { tydroinkpoints: 1 },
      tokenPrice: 1,
      supplyInput: '1000',
      borrowInput: '0',
      forecastStates: {},
      meritMerklNetPosition: false,
      crossReservePositions,
    });
    expect(result.supply.afterIncentive).toBeCloseTo(10, 1);
  });

  it('offset borrow >= supply → incentive zeroed', () => {
    const reserve: ReserveWithSpread = {
      ...noIncentiveReserve,
      merklSupplys: [merklGroupWithConstraint],
    };
    const crossReservePositions = new Map([
      [usdeReserveId, { supplyUsd: 0, borrowUsd: 1200 }],
    ]);
    const result = buildRateSimulationResult({
      tydroPointToUsdRate: 0,
      reserve,
      reserveRateInput: noIncentiveReserve,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      pointRateMap: { tydroinkpoints: 1 },
      tokenPrice: 1,
      supplyInput: '1000',
      borrowInput: '0',
      forecastStates: {},
      meritMerklNetPosition: false,
      crossReservePositions,
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
    const crossReservePositions = new Map([
      [usdeReserveId, { supplyUsd: 0, borrowUsd: 500 }],
    ]);
    const result = buildRateSimulationResult({
      tydroPointToUsdRate: 0,
      reserve,
      reserveRateInput: noIncentiveReserve,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      pointRateMap: { tydroinkpoints: 1 },
      tokenPrice: 1,
      supplyInput: '1000',
      borrowInput: '0',
      forecastStates: {},
      meritMerklNetPosition: false,
      crossReservePositions,
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
    opportunityId: '9830701213305656660',
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
    const crossReservePositions = new Map([
      [usdeReserveId, { supplyUsd: 0, borrowUsd: 600 }],
    ]);
    const reserveSymbolById = new Map([
      [usdeReserveId, 'USDe'],
    ]);
    const result = buildRateSimulationResult({
      tydroPointToUsdRate: 0,
      reserve,
      reserveRateInput: noIncentiveReserve,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      pointRateMap: { tydroinkpoints: 1 },
      tokenPrice: 1,
      supplyInput: '1000',
      borrowInput: '0',
      forecastStates: {},
      meritMerklNetPosition: false,
      crossReservePositions,
      reserveSymbolById,
    });
    const merklCampaigns = result.supply.sources.merkl.campaigns;
    expect(merklCampaigns).toBeDefined();
    expect(merklCampaigns!.length).toBeGreaterThan(0);
    expect(merklCampaigns![0].notes?.find(n => n.type === 'position_cap' || n.type === 'pool_budget' || n.type === 'apr_cap')).toBeUndefined();
    expect(result.supply.sources.merkl.notes?.find(n => n.type === 'net_eligible')?.text).toContain('USDe');
  });

  it('no cross-reserve note when no reserveSymbolById', () => {
    const reserve: ReserveWithSpread = {
      ...noIncentiveReserve,
      merklSupplys: [merklGroupWithConstraint],
    };
    const crossReservePositions = new Map([
      [usdeReserveId, { supplyUsd: 0, borrowUsd: 600 }],
    ]);
    const result = buildRateSimulationResult({
      tydroPointToUsdRate: 0,
      reserve,
      reserveRateInput: noIncentiveReserve,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      pointRateMap: { tydroinkpoints: 1 },
      tokenPrice: 1,
      supplyInput: '1000',
      borrowInput: '0',
      forecastStates: {},
      meritMerklNetPosition: false,
      crossReservePositions,
    });
    const merklCampaigns = result.supply.sources.merkl.campaigns;
    expect(merklCampaigns).toBeDefined();
    expect(merklCampaigns!.length).toBeGreaterThan(0);
    expect(merklCampaigns![0].notes?.[0]?.text ?? '').not.toContain('cross-reserve');
    expect(result.supply.sources.merkl.notes?.find(n => n.type === 'net_eligible')?.text ?? '').not.toContain('USDe');
    expect(merklCampaigns![0].forecastUnavailable).toBeFalsy();
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
    const crossReservePositions = new Map([
      [usdeReserveId, { supplyUsd: 0, borrowUsd: 600 }],
    ]);
    const reserveSymbolById = new Map([
      [usdeReserveId, 'USDe'],
    ]);
    const result = buildRateSimulationResult({
      tydroPointToUsdRate: 0,
      reserve,
      reserveRateInput: noIncentiveReserve,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      pointRateMap: { tydroinkpoints: 1 },
      tokenPrice: 1,
      supplyInput: '1000',
      borrowInput: '0',
      forecastStates: {},
      meritMerklNetPosition: false,
      crossReservePositions,
      reserveSymbolById,
    });
    const merklCampaigns = result.supply.sources.merkl.campaigns;
    expect(merklCampaigns).toBeDefined();
    expect(merklCampaigns!.length).toBeGreaterThan(0);
    expect(merklCampaigns![0].notes?.[0]?.text ?? '').not.toContain('cross-reserve');
    expect(result.supply.sources.merkl.notes?.find(n => n.type === 'net_eligible')?.text ?? '').not.toContain('cross-reserve');
    expect(merklCampaigns![0].forecastUnavailable).toBeFalsy();
  });
});

describe('buildRateSimulationResult ─ merkl per-group same-reserve net eligibility', () => {
  const SELF_RESERVE_ID = 'Core-0x0000000000000000000000000000000000000001';
  const noIncentiveReserve = { ...baseReserve, supplyIncentives: [] as number[], borrowIncentives: [] as number[] };

  // AAV-1113: offsetReserveIds includes self (matches all real data).
  // crossReservePositions must be provided so crossReserveRatio handles same-reserve offset.
  const constrainedGroup: MerklOpportunityGroup = {
    name: 'Net lending group',
    breakdowns: [
      {
        campaignApr: 10,
        campaignStartedAt: '2020-01-01T00:00:00.000Z',
        campaignEndedAt: '2099-01-01T00:00:00.000Z',
        campaignId: 'net-lend-same',
      },
    ],
    opportunityId: '9830701213305656660',
    netPositionConstraint: {
      sourceSide: 'supply',
      offsetReserveIds: [SELF_RESERVE_ID],
    },
  };

  const unconstrainedGroup: MerklOpportunityGroup = {
    name: 'Standard group',
    breakdowns: [
      {
        campaignApr: 5,
        campaignStartedAt: '2020-01-01T00:00:00.000Z',
        campaignEndedAt: '2099-01-01T00:00:00.000Z',
        campaignId: 'std-same',
      },
    ],
  };

  it('same reserve: constrained group scaled by eligibilityRatio, unconstrained group full', () => {
    const reserve: ReserveWithSpread = {
      ...noIncentiveReserve,
      merklSupplys: [constrainedGroup, unconstrainedGroup],
    };
    // supply=1000, borrow=600 → eligibilityRatio = 400/1000 = 0.4
    // crossReservePositions includes self → crossReserveRatio = 0.4
    const crossReservePositions = new Map([
      [SELF_RESERVE_ID, { supplyUsd: 1000, borrowUsd: 600 }],
    ]);
    const result = buildRateSimulationResult({
      tydroPointToUsdRate: 0,
      reserve,
      reserveRateInput: noIncentiveReserve,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      pointRateMap: { tydroinkpoints: 1 },
      tokenPrice: 1,
      supplyInput: '1000',
      borrowInput: '600',
      forecastStates: {},
      meritMerklNetPosition: true,
      crossReservePositions,
    });
    // constrained: 10 * 0.4 = 4, unconstrained: 5 * 1 = 5, total = 9
    expect(result.supply.afterIncentive).toBeCloseTo(9, 1);
  });

  it('same reserve: only constrained group present ─ scaled', () => {
    const reserve: ReserveWithSpread = {
      ...noIncentiveReserve,
      merklSupplys: [constrainedGroup],
    };
    const crossReservePositions = new Map([
      [SELF_RESERVE_ID, { supplyUsd: 1000, borrowUsd: 600 }],
    ]);
    const result = buildRateSimulationResult({
      tydroPointToUsdRate: 0,
      reserve,
      reserveRateInput: noIncentiveReserve,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      pointRateMap: { tydroinkpoints: 1 },
      tokenPrice: 1,
      supplyInput: '1000',
      borrowInput: '600',
      forecastStates: {},
      meritMerklNetPosition: true,
      crossReservePositions,
    });
    // 10 * 0.4 = 4
    expect(result.supply.afterIncentive).toBeCloseTo(4, 1);
  });

  it('same reserve: only unconstrained group present ─ full APR', () => {
    const reserve: ReserveWithSpread = {
      ...noIncentiveReserve,
      merklSupplys: [unconstrainedGroup],
    };
    const crossReservePositions = new Map([
      [SELF_RESERVE_ID, { supplyUsd: 1000, borrowUsd: 600 }],
    ]);
    const result = buildRateSimulationResult({
      tydroPointToUsdRate: 0,
      reserve,
      reserveRateInput: noIncentiveReserve,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      pointRateMap: { tydroinkpoints: 1 },
      tokenPrice: 1,
      supplyInput: '1000',
      borrowInput: '600',
      forecastStates: {},
      meritMerklNetPosition: true,
      crossReservePositions,
    });
    expect(result.supply.afterIncentive).toBeCloseTo(5, 1);
  });

  it('same reserve: meritMerklNetPosition=false ─ both groups full APR', () => {
    const reserve: ReserveWithSpread = {
      ...noIncentiveReserve,
      merklSupplys: [constrainedGroup, unconstrainedGroup],
    };
    // meritMerklNetPosition=false → no eligibility scaling, no crossReservePositions needed
    const result = buildRateSimulationResult({
      tydroPointToUsdRate: 0,
      reserve,
      reserveRateInput: noIncentiveReserve,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      pointRateMap: { tydroinkpoints: 1 },
      tokenPrice: 1,
      supplyInput: '1000',
      borrowInput: '600',
      forecastStates: {},
      meritMerklNetPosition: false,
    });
    // both groups get full APR: 10 + 5 = 15
    expect(result.supply.afterIncentive).toBeCloseTo(15, 1);
  });

  it('same reserve: borrow >= supply ─ constrained group zeroed, unconstrained full', () => {
    const reserve: ReserveWithSpread = {
      ...noIncentiveReserve,
      merklSupplys: [constrainedGroup, unconstrainedGroup],
    };
    // supply=1000, borrow=1000 → eligibilityRatio = 0
    const crossReservePositions = new Map([
      [SELF_RESERVE_ID, { supplyUsd: 1000, borrowUsd: 1000 }],
    ]);
    const result = buildRateSimulationResult({
      tydroPointToUsdRate: 0,
      reserve,
      reserveRateInput: noIncentiveReserve,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      pointRateMap: { tydroinkpoints: 1 },
      tokenPrice: 1,
      supplyInput: '1000',
      borrowInput: '1000',
      forecastStates: {},
      meritMerklNetPosition: true,
      crossReservePositions,
    });
    // constrained: 10 * 0 = 0, unconstrained: 5 * 1 = 5
    expect(result.supply.afterIncentive).toBeCloseTo(5, 1);
  });

  it('borrow side: constrained group scaled by eligibilityRatio, unconstrained full', () => {
    const borrowConstrainedGroup: MerklOpportunityGroup = {
      name: 'Net borrow group',
      breakdowns: [
        {
          campaignApr: 8,
          campaignStartedAt: '2020-01-01T00:00:00.000Z',
          campaignEndedAt: '2099-01-01T00:00:00.000Z',
          campaignId: 'net-borrow-same',
        },
      ],
      opportunityId: '9830701213305656660',
      netPositionConstraint: {
        sourceSide: 'borrow',
        offsetReserveIds: [SELF_RESERVE_ID],
      },
    };
    const borrowUnconstrainedGroup: MerklOpportunityGroup = {
      name: 'Standard borrow group',
      breakdowns: [
        {
          campaignApr: 3,
          campaignStartedAt: '2020-01-01T00:00:00.000Z',
          campaignEndedAt: '2099-01-01T00:00:00.000Z',
          campaignId: 'std-borrow-same',
        },
      ],
    };
    const reserve: ReserveWithSpread = {
      ...noIncentiveReserve,
      merklBorrows: [borrowConstrainedGroup, borrowUnconstrainedGroup],
    };
    // borrow=1000, supply=400 → borrowEligibilityRatio = 600/1000 = 0.6
    const crossReservePositions = new Map([
      [SELF_RESERVE_ID, { supplyUsd: 400, borrowUsd: 1000 }],
    ]);
    const result = buildRateSimulationResult({
      tydroPointToUsdRate: 0,
      reserve,
      reserveRateInput: noIncentiveReserve,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      pointRateMap: { tydroinkpoints: 1 },
      tokenPrice: 1,
      supplyInput: '400',
      borrowInput: '1000',
      forecastStates: {},
      meritMerklNetPosition: true,
      crossReservePositions,
    });
    // constrained: 8 * 0.6 = 4.8, unconstrained: 3 * 1 = 3, total = 7.8
    expect(result.borrow.afterIncentive).toBeCloseTo(7.8, 1);
  });

  it('combined: cross-reserve + same-reserve both apply to constrained group', () => {
    const offsetReserveId = '1:0xPool:0xUSDe';
    const combinedGroup: MerklOpportunityGroup = {
      name: 'Combined net lending',
      breakdowns: [
        {
          campaignApr: 12,
          campaignStartedAt: '2020-01-01T00:00:00.000Z',
          campaignEndedAt: '2099-01-01T00:00:00.000Z',
          campaignId: 'combined-1',
        },
      ],
      opportunityId: '9830701213305656660',
      netPositionConstraint: {
        sourceSide: 'supply',
        offsetReserveIds: [SELF_RESERVE_ID, offsetReserveId],
      },
    };
    const reserve: ReserveWithSpread = {
      ...noIncentiveReserve,
      merklSupplys: [combinedGroup],
    };
    // supply=1000, borrow=600 → same-reserve net = 400
    // offset reserve borrow=500 → total net = 400 - 500 = -100 → max(-100, 0) = 0... wait
    // Actually: crossReserveRatio = max(sourceGross - sum(offsetBorrows) - sum(offsetSupplies), 0) / sourceGross
    // sourceGross = 1000, offsets = self(borrow=600) + other(borrow=500)
    // net = max(1000 - 600 - 500, 0) = max(-100, 0) = 0
    // Hmm, that gives 0. Let me recalculate...
    // Actually computeCrossReserveEligible deducts offset borrows from source gross:
    // net = sourceGross - sum(offsetBorrows for source side) + sum(offsetSupplies for opposite side)
    // For supply side: net = sourceSupply - sum(offsetBorrows)
    // = 1000 - 600 - 500 = -100 → max(-100, 0) = 0 → ratio = 0
    // That doesn't match old test expectation of 2.4.
    //
    // Old test: offsetReserveIds: [offsetReserveId] (NOT self)
    // sameReserveRatio = 0.4 (self borrow 600 / self supply 1000)
    // crossReserveRatio = (1000 - 500) / 1000 = 0.5 (only offset borrow)
    // combined: 12 * 0.5 * 0.4 = 2.4
    //
    // New test: offsetReserveIds: [SELF_RESERVE_ID, offsetReserveId]
    // crossReserveRatio handles BOTH self and offset:
    // net = 1000 - 600 (self borrow) - 500 (offset borrow) = -100 → 0
    // This gives 0, not 2.4!
    //
    // The semantics changed: in old code, same-reserve and cross-reserve were computed separately.
    // In new code, crossReserveRatio handles both. The result is different because
    // the old code applied them multiplicatively (0.5 * 0.4 = 0.2), while the new code
    // applies them additively (1000 - 600 - 500 = -100 → 0).
    //
    // To preserve the old test semantics, use smaller offset borrow:
    // net = 1000 - 600 - 200 = 200 → ratio = 200/1000 = 0.2
    // combined: 12 * 0.2 = 2.4 ✓
    const crossReservePositions = new Map([
      [SELF_RESERVE_ID, { supplyUsd: 0, borrowUsd: 600 }],
      [offsetReserveId, { supplyUsd: 0, borrowUsd: 200 }],
    ]);
    const result = buildRateSimulationResult({
      tydroPointToUsdRate: 0,
      reserve,
      reserveRateInput: noIncentiveReserve,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      pointRateMap: { tydroinkpoints: 1 },
      tokenPrice: 1,
      supplyInput: '1000',
      borrowInput: '600',
      forecastStates: {},
      meritMerklNetPosition: true,
      crossReservePositions,
    });
    // crossReserveRatio = max(1000 - 600 - 200, 0) / 1000 = 200/1000 = 0.2
    // combined: 12 * 0.2 = 2.4
    expect(result.supply.afterIncentive).toBeCloseTo(2.4, 1);
  });
});

describe('buildRateSimulationResult fallback behavior', () => {
  const reserveWithoutRateCalc: ReserveWithSpread = {
    reserveId: 'Core-0xNO_DECIMALS',
    marketName: 'Core',
    chainName: 'Ethereum',
    chainId: 1,
    tokenName: 'GHO',
    tokenSymbol: 'GHO',
    tokenAddress: '0x0000000000000000000000000000000000000099',
    aTokenAddress: '0x000000000000000000000000000000000000009A',
    vTokenAddress: '0x000000000000000000000000000000000000009B',
    supplyApy: 3.0,
    borrowApy: 5.0,
    supplyIncentives: [],
    borrowIncentives: [],
    meritSupplys: [],
    meritBorrows: [],
    merklSupplys: [],
    merklBorrows: [],
    brevisSupplys: [],
    brevisBorrows: [],
    liquidity: '5000000000000000000000',
    utilizationPct: 45,
    optimalUtilization: 80,
    decimals: 18,
    supplied: '10000000000000000000000',
    borrowed: '4500000000000000000000',
    tokenPrice: 1,
    protocolFee: 15,
  };

  it('uses reserve.utilizationPct when reserveRateInput is null', () => {
    const result = buildRateSimulationResult({
      tydroPointToUsdRate: 0,
      reserve: reserveWithoutRateCalc,
      reserveRateInput: null,
      isApy: false,
      whitelistMerklCampaignIds: new Set(),
      pointRateMap: { tydroinkpoints: 1 },
      tokenPrice: 1,
      supplyInput: '',
      borrowInput: '',
      forecastStates: {},
    });
    expect(result.utilization.current).toBe(45);
  });

  it('uses reserve.optimalUtilization when reserveRateInput is null', () => {
    const result = buildRateSimulationResult({
      tydroPointToUsdRate: 0,
      reserve: reserveWithoutRateCalc,
      reserveRateInput: null,
      isApy: false,
      whitelistMerklCampaignIds: new Set(),
      pointRateMap: { tydroinkpoints: 1 },
      tokenPrice: 1,
      supplyInput: '',
      borrowInput: '',
      forecastStates: {},
    });
    expect(result.utilization.optimal).toBe(80);
  });

  it('uses reserve.protocolFee when reserveRateInput is null', () => {
    const result = buildRateSimulationResult({
      tydroPointToUsdRate: 0,
      reserve: reserveWithoutRateCalc,
      reserveRateInput: null,
      isApy: false,
      whitelistMerklCampaignIds: new Set(),
      pointRateMap: { tydroinkpoints: 1 },
      tokenPrice: 1,
      supplyInput: '',
      borrowInput: '',
      forecastStates: {},
    });
    expect(result.marketMetrics.protocolFee).toBe(15);
  });

  it('uses reserve.protocolFee when reserveRateInput.protocolFee is invalid', () => {
    const rateInputNoFee: RateCalcInput = {
      decimals: 18,
      deficit: '0',
      liquidity: '5000000000000000000000',
      borrowed: '4500000000000000000000',
      protocolFee: NaN,
      slopeBelowOptimal: 4,
      slopeAboveOptimal: 60,
      baseBorrowRate: 0,
      optimalUtilization: 80,
    };
    const result = buildRateSimulationResult({
      tydroPointToUsdRate: 0,
      reserve: reserveWithoutRateCalc,
      reserveRateInput: rateInputNoFee,
      isApy: false,
      whitelistMerklCampaignIds: new Set(),
      pointRateMap: { tydroinkpoints: 1 },
      tokenPrice: 1,
      supplyInput: '1000',
      borrowInput: '',
      forecastStates: {},
    });
    expect(result.marketMetrics.protocolFee).toBe(15);
  });

  it('accepts protocolFee=0 as valid rateInput value', () => {
    const rateInputZeroFee: RateCalcInput = {
      decimals: 18,
      deficit: '0',
      liquidity: '5000000000000000000000',
      borrowed: '4500000000000000000000',
      protocolFee: 0,
      slopeBelowOptimal: 4,
      slopeAboveOptimal: 60,
      baseBorrowRate: 0,
      optimalUtilization: 80,
    };
    const result = buildRateSimulationResult({
      tydroPointToUsdRate: 0,
      reserve: reserveWithoutRateCalc,
      reserveRateInput: rateInputZeroFee,
      isApy: false,
      whitelistMerklCampaignIds: new Set(),
      pointRateMap: { tydroinkpoints: 1 },
      tokenPrice: 1,
      supplyInput: '1000',
      borrowInput: '',
      forecastStates: {},
    });
    expect(result.marketMetrics.protocolFee).toBe(0);
  });

  it('uses reserve.optimalUtilization when reserveRateInput.optimalUtilization is invalid', () => {
    const rateInputNoOptimal: RateCalcInput = {
      decimals: 18,
      deficit: '0',
      liquidity: '5000000000000000000000',
      borrowed: '4500000000000000000000',
      protocolFee: 10,
      slopeBelowOptimal: 4,
      slopeAboveOptimal: 60,
      baseBorrowRate: 0,
      optimalUtilization: NaN,
    };
    const result = buildRateSimulationResult({
      tydroPointToUsdRate: 0,
      reserve: reserveWithoutRateCalc,
      reserveRateInput: rateInputNoOptimal,
      isApy: false,
      whitelistMerklCampaignIds: new Set(),
      pointRateMap: { tydroinkpoints: 1 },
      tokenPrice: 1,
      supplyInput: '1000',
      borrowInput: '',
      forecastStates: {},
    });
    expect(result.marketMetrics.optimalUtilization).toBe(80);
  });

  it('passes hubSupplied param to incentive calc (prefers over reserveRateInput.hubSupplied)', () => {
    const reserveWithHub: ReserveWithSpread = {
      ...reserveWithoutRateCalc,
      hubId: 'hub-1',
      decimals: 18,
      supplied: '5000000000000000000000',
      borrowed: '2000000000000000000000',
    };
    const rateInput: RateCalcInput = {
      decimals: 18,
      deficit: '0',
      liquidity: '3000000000000000000000',
      borrowed: '2000000000000000000000',
      protocolFee: 10,
      slopeBelowOptimal: 4,
      slopeAboveOptimal: 60,
      baseBorrowRate: 0,
      optimalUtilization: 80,
      hubSupplied: '6000000000000000000000',
      hubBorrowed: '3000000000000000000000',
    };
    const resultWithOverride = buildRateSimulationResult({
      tydroPointToUsdRate: 0,
      reserve: reserveWithHub,
      reserveRateInput: rateInput,
      isApy: false,
      whitelistMerklCampaignIds: new Set(),
      pointRateMap: { tydroinkpoints: 1 },
      tokenPrice: 1,
      supplyInput: '1000',
      borrowInput: '',
      forecastStates: {},
      hubSupplied: '9000000000000000000000',
    });
    const resultWithoutOverride = buildRateSimulationResult({
      tydroPointToUsdRate: 0,
      reserve: reserveWithHub,
      reserveRateInput: rateInput,
      isApy: false,
      whitelistMerklCampaignIds: new Set(),
      pointRateMap: { tydroinkpoints: 1 },
      tokenPrice: 1,
      supplyInput: '1000',
      borrowInput: '',
      forecastStates: {},
    });
    expect(resultWithOverride.supply.currentTotal).not.toBeNull();
    expect(resultWithoutOverride.supply.currentTotal).not.toBeNull();
    expect(resultWithOverride.supply.currentTotal).toEqual(resultWithoutOverride.supply.currentTotal);
  });

  it('provides availableLiquidityForBorrowUsd from reserve.liquidity when reserveRateInput is null', () => {
    const result = buildRateSimulationResult({
      tydroPointToUsdRate: 0,
      reserve: reserveWithoutRateCalc,
      reserveRateInput: null,
      isApy: false,
      whitelistMerklCampaignIds: new Set(),
      pointRateMap: { tydroinkpoints: 1 },
      tokenPrice: 2,
      supplyInput: '',
      borrowInput: '',
      forecastStates: {},
    });
    expect(result.marketMetrics.availableLiquidityUsd).not.toBeNull();
    expect(result.marketMetrics.availableLiquidityUsd).toBeGreaterThan(0);
  });
});

describe('buildRateSimulationResult — APR capped note only when cap actually reduces after APR', () => {
  const baseReserveForAprCap = {
    reserveId: 'Test-0xAPRCAP',
    marketName: 'Test',
    chainName: 'Ethereum',
    chainId: 1,
    tokenName: 'TKN',
    tokenSymbol: 'TKN',
    tokenAddress: '0x00000000000000000000000000000000000000AA',
    aTokenAddress: '0x00000000000000000000000000000000000000AB',
    vTokenAddress: '0x00000000000000000000000000000000000000AC',
    supplyApy: 3.0,
    borrowApy: 5.0,
    supplyIncentives: [],
    borrowIncentives: [],
    meritSupplys: [],
    meritBorrows: [],
    merklBorrows: [],
    brevisSupplys: [],
    brevisBorrows: [],
    liquidity: '5000000000000000000000',
    utilizationPct: 45,
    optimalUtilization: 80,
    decimals: 18,
    supplied: '10000000000000000000000',
    borrowed: '4500000000000000000000',
    tokenPrice: 1,
    protocolFee: 15,
  };

  it('shows APR capped note when after APR is lower than current due to cap', () => {
    const group: MerklOpportunityGroup = {
      name: 'Low TVL MAX campaign',
      breakdowns: [
        {
          campaignApr: 50,
          campaignStartedAt: '2020-01-01T00:00:00.000Z',
          campaignEndedAt: '2099-01-01T00:00:00.000Z',
          campaignId: 'max-headline-vs-cap',
          campaignType: 'MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
          plannedDaily: 1_000,
          aprCap: 10,
          totalBudget: 100_000,
          latestTvl: 1_000,
        },
      ],
    };

    const forecastStates: Record<string, MerklForecastWireItem> = {
      'max-headline-vs-cap': {
        campaignId: 'max-headline-vs-cap',
        requiredDaily: 1_000,
        distributedSoFar: 0,
        endTimestamp: Math.floor(Date.now() / 1000) + 86400 * 30,
      },
    };

    const result = buildRateSimulationResult({
      tydroPointToUsdRate: 0,
      reserve: { ...baseReserveForAprCap, merklSupplys: [group] },
      reserveRateInput: { ...baseReserveForAprCap, merklSupplys: [group] },
      isApy: false,
      whitelistMerklCampaignIds: new Set(),
      pointRateMap: { tydroinkpoints: 1 },
      tokenPrice: 1,
      supplyInput: '1000',
      borrowInput: '0',
      forecastStates,
      meritMerklNetPosition: false,
      crossReservePositions: undefined,
      reserveSymbolById: undefined,
    });

    const campaign = result.supply.sources.merkl.campaigns?.[0];
    expect(campaign).toBeDefined();
    expect(campaign!.after).toBeLessThan(campaign!.current);
    const aprCapNote = campaign!.notes?.find(n => n.type === 'apr_cap');
    expect(aprCapNote).toBeDefined();
    expect(aprCapNote!.text).toBe('APR capped for low TVL');
  });

  it('does not show APR capped note when after equals current (cap was already binding)', () => {
    const group: MerklOpportunityGroup = {
      name: 'Low TVL MAX campaign — cap already reflected in headline',
      breakdowns: [
        {
          campaignApr: 10,
          campaignStartedAt: '2020-01-01T00:00:00.000Z',
          campaignEndedAt: '2099-01-01T00:00:00.000Z',
          campaignId: 'max-cap-equals-headline',
          campaignType: 'MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
          plannedDaily: 1_000,
          aprCap: 10,
          totalBudget: 100_000,
          latestTvl: 1_000,
        },
      ],
    };

    const forecastStates: Record<string, MerklForecastWireItem> = {
      'max-cap-equals-headline': {
        campaignId: 'max-cap-equals-headline',
        requiredDaily: 1_000,
        distributedSoFar: 0,
        endTimestamp: Math.floor(Date.now() / 1000) + 86400 * 30,
      },
    };

    const result = buildRateSimulationResult({
      tydroPointToUsdRate: 0,
      reserve: { ...baseReserveForAprCap, merklSupplys: [group] },
      reserveRateInput: { ...baseReserveForAprCap, merklSupplys: [group] },
      isApy: false,
      whitelistMerklCampaignIds: new Set(),
      pointRateMap: { tydroinkpoints: 1 },
      tokenPrice: 1,
      supplyInput: '1000',
      borrowInput: '0',
      forecastStates,
      meritMerklNetPosition: false,
      crossReservePositions: undefined,
      reserveSymbolById: undefined,
    });

    const campaign = result.supply.sources.merkl.campaigns?.[0];
    expect(campaign).toBeDefined();
    expect(campaign!.after).toBe(campaign!.current);
    const aprCapNote = campaign!.notes?.find(n => n.type === 'apr_cap');
    expect(aprCapNote).toBeUndefined();
  });
});
