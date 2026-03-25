import { describe, expect, it } from 'vitest';
import type {
  MerklOpportunityGroup,
  MerklForecastStateResponse,
  ReserveWithSpread,
} from '@/types/aave';
import type { RateCalcInput } from '@/lib/interestRateCalculator';
import { buildForecastMerklOpportunities, buildRateSimulationResult } from '@/hooks/useRateSimulation';

const baseReserve: ReserveWithSpread & RateCalcInput = {
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
  availableLiquidity: '1000000000000',
  totalVariableDebt: '500000000000',
  reserveFactor: '1000',
  variableRateSlope1: '40000000000000000000000000',
  variableRateSlope2: '600000000000000000000000000',
  baseVariableBorrowRate: '0',
  optimalUsageRate: '800000000000000000000000000',
};

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
          },
        ],
      },
    ];

    const states: Record<string, MerklForecastStateResponse> = {
      c1: {
        campaignId: 'c1',
        campaignType: 'DUTCH_AUCTION',
        plannedDaily: 10,
        requiredDaily: 10,
        aprCap: null,
        totalBudget: 100000,
        distributedSoFar: 0,
        latestTvl: 1000,
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

  it('keeps whitelist-only campaign APR unchanged when excluded', () => {
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
          },
        ],
      },
    ];

    const states: Record<string, MerklForecastStateResponse> = {
      c2: {
        campaignId: 'c2',
        campaignType: 'DUTCH_AUCTION',
        plannedDaily: 100,
        requiredDaily: 100,
        aprCap: null,
        totalBudget: 100000,
        distributedSoFar: 0,
        latestTvl: 1000,
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

    expect(result[0].breakdowns[0].campaignApr).toBe(33);
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
            },
          ],
        },
      ],
    };

    const states: Record<string, MerklForecastStateResponse> = {
      c1: {
        campaignId: 'c1',
        campaignType: 'DUTCH_AUCTION',
        plannedDaily: 10,
        requiredDaily: 10,
        aprCap: null,
        totalBudget: 100000,
        distributedSoFar: 0,
        latestTvl: 1000,
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
          apr: 10,
          link: 'https://example.com/brevis',
          startDate: '2020-01-01T00:00:00.000Z',
          endDate,
          name: 'Brevis Supply',
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

    expect(result.supply.sources.brevis.current).toBe(10);
    expect(result.supply.sources.brevis.after).toBeLessThan(10);
    expect(result.supply.sources.brevis.after).toBeCloseTo(5, 0);
    expect(result.supply.afterIncentive).toBeLessThan(result.supply.currentIncentive);
  });

  it('keeps brevis incentive unchanged when cap is not binding (small deposit)', () => {
    const nowMs = Date.now();
    const endDate = new Date(nowMs + 365 * 86_400_000).toISOString();
    const reserve: ReserveWithSpread = {
      ...baseReserve,
      brevisSupplys: [
        {
          apr: 10,
          link: 'https://example.com/brevis',
          startDate: '2020-01-01T00:00:00.000Z',
          endDate,
          name: 'Brevis Supply',
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
          apr: 10,
          link: 'https://example.com/brevis',
          startDate: '2020-01-01T00:00:00.000Z',
          endDate: '2099-01-01T00:00:00.000Z',
          name: 'Brevis Supply',
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
          apr: 8,
          link: 'https://example.com/brevis',
          startDate: '2020-01-01T00:00:00.000Z',
          endDate,
          name: 'Brevis Borrow',
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
          apr: 10,
          link: 'https://example.com/brevis',
          startDate: '2020-01-01T00:00:00.000Z',
          endDate: '',
          name: 'Brevis Supply (no end)',
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

  it('uses combined supply+borrow deposit for shared cap group', () => {
    const nowMs = Date.now();
    const endDate = new Date(nowMs + 365 * 86_400_000).toISOString();
    const reserve: ReserveWithSpread = {
      ...baseReserve,
      brevisSupplys: [
        {
          apr: 10,
          link: 'https://example.com/brevis-supply',
          startDate: '2020-01-01T00:00:00.000Z',
          endDate,
          name: 'Brevis Supply USDC',
          perUserRewardCapUsd: 5000,
          sharedCapGroupId: 'linea-usdc',
        },
      ],
      brevisBorrows: [
        {
          apr: 10,
          link: 'https://example.com/brevis-borrow',
          startDate: '2020-01-01T00:00:00.000Z',
          endDate,
          name: 'Brevis Borrow USDC',
          perUserRewardCapUsd: 5000,
          sharedCapGroupId: 'linea-usdc',
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
  });

  it('does not share cap when sharedCapGroupId is absent', () => {
    const nowMs = Date.now();
    const endDate = new Date(nowMs + 365 * 86_400_000).toISOString();
    const reserve: ReserveWithSpread = {
      ...baseReserve,
      brevisSupplys: [
        {
          apr: 10,
          link: 'https://example.com/brevis-supply',
          startDate: '2020-01-01T00:00:00.000Z',
          endDate,
          name: 'Brevis Supply',
          perUserRewardCapUsd: 5000,
        },
      ],
      brevisBorrows: [
        {
          apr: 10,
          link: 'https://example.com/brevis-borrow',
          startDate: '2020-01-01T00:00:00.000Z',
          endDate,
          name: 'Brevis Borrow',
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
    expect(result.supply.sources.brevis.after).toBe(10);
    expect(result.borrow.sources.brevis.after).toBe(10);
  });

  it('counts brevis in current totals even without endDate', () => {
    const reserve: ReserveWithSpread = {
      ...baseReserve,
      brevisSupplys: [
        {
          apr: 5,
          link: 'https://example.com/brevis',
          startDate: '2020-01-01T00:00:00.000Z',
          endDate: '',
          name: 'Brevis open-ended',
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
});
