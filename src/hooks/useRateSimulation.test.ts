import { describe, expect, it } from 'vitest';
import type {
  MerklOpportunityGroup,
  MerklForecastStateResponse,
  ReserveWithSpread,
} from '@/types/aave';
import { buildForecastMerklOpportunities, buildRateSimulationResult } from '@/hooks/useRateSimulation';

const baseReserve: ReserveWithSpread = {
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
      includeWhitelistOnlyMerkl: true,
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
      includeWhitelistOnlyMerkl: false,
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
      includeWhitelistOnlyMerkl: true,
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
      includeWhitelistOnlyMerkl: true,
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
      includeWhitelistOnlyMerkl: true,
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
      includeWhitelistOnlyMerkl: true,
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
});
