import { describe, expect, it } from 'vitest';
import { MarketsResponseSchema, SideDataMetaResponseSchema } from './apiSchemas';

const buildMarketsPayload = (message: unknown) => ({
  snapshot: {
    lastUpdated: '2026-03-09T00:00:00.000Z',
    version: '1.0.0',
  },
  reserves: [
    {
      marketName: 'AaveV3Celo',
      chainName: 'Celo',
      chainId: 42220,
      tokenName: 'Tether USD',
      tokenSymbol: 'USDT',
      tokenAddress: '0x1234',
      aTokenAddress: '0xa1234',
      vTokenAddress: '0xb1234',
      meritSupplys: [
        {
          apr: 4.16,
          link: 'https://app.merit.systems/campaign',
          message,
          startDate: '2026-02-26',
          endDate: '2026-03-12',
        },
      ],
    },
  ],
});

describe('apiSchemas', () => {
  it('rejects Merit message payloads that are not strings, objects, or arrays', () => {
    const result = MarketsResponseSchema.safeParse(buildMarketsPayload(123));

    expect(result.success).toBe(false);
  });

  it('accepts structured Merit message payloads used by staging responses', () => {
    const result = MarketsResponseSchema.safeParse(
      buildMarketsPayload([
        {
          action: 'Supply USDT',
          description:
            'Rewards are distributed using the following formula: f(USDT aToken Holding - USDT vToken Holding / USDT Liquidation Threshold)',
        },
        {
          action: 'Self Authentication',
          description:
            'Supply USDT and double your yield by verifying your humanity through Self for the first $1000 USDT supplied per user.',
        },
      ])
    );

    expect(result.success).toBe(true);
  });

  it('preserves Merkl breakdown forecast fields from /markets', () => {
    const parsed = MarketsResponseSchema.parse({
      snapshot: {
        lastUpdated: '2026-03-25T00:00:00.000Z',
      },
      reserves: [
        {
          marketName: 'AaveV3Ink',
          chainName: 'Ink',
          chainId: 57073,
          tokenName: 'USDG',
          tokenSymbol: 'USDG',
          tokenAddress: '0x1',
          aTokenAddress: '0x2',
          vTokenAddress: '0x3',
          merklSupplys: [
            {
              name: 'Lend USDG on Tydro',
              breakdowns: [
                {
                  campaignApr: 0,
                  campaignStartedAt: '2026-03-24T14:00:00.000Z',
                  campaignEndedAt: '2026-03-31T14:00:00.000Z',
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
        },
      ],
    });

    const breakdown = parsed.reserves[0].merklSupplys?.[0].breakdowns[0];
    expect(breakdown?.campaignType).toBe('DUTCH_AUCTION');
    expect(breakdown?.plannedDaily).toBe(11312);
    expect(breakdown?.aprCap).toBeNull();
    expect(breakdown?.totalBudget).toBe(79184);
    expect(breakdown?.latestTvl).toBe(23586552.55647095);
  });

  it('preserves metrics-only forecast fields from /meta/side-data', () => {
    const parsed = SideDataMetaResponseSchema.parse({
      forecast: {
        staleTimeMs: 600000,
        items: [
          {
            campaignId: '16403393592832236981',
            requiredDaily: 11312,
            distributedSoFar: 0,
            endTimestamp: 1774965600,
          },
        ],
        errors: [],
      },
    });

    const item = parsed.forecast?.items[0];
    expect(item?.campaignId).toBe('16403393592832236981');
    expect(item?.requiredDaily).toBe(11312);
    expect(item?.distributedSoFar).toBe(0);
    expect(item?.endTimestamp).toBe(1774965600);
  });

  it('accepts aligned Brevis fields while preserving extra legacy fields', () => {
    const parsed = MarketsResponseSchema.parse({
      snapshot: {
        lastUpdated: '2026-03-26T00:00:00.000Z',
      },
      reserves: [
        {
          marketName: 'AaveV3Linea',
          chainName: 'Linea',
          chainId: 59144,
          tokenName: 'USDC',
          tokenSymbol: 'USDC',
          tokenAddress: '0x1',
          aTokenAddress: '0x2',
          vTokenAddress: '0x3',
          brevisSupplys: [
            {
              campaignApr: 2.8,
              link: 'https://example.com/brevis',
              campaignStartedAt: '2025-08-13T13:00:00.000Z',
              campaignEndedAt: '2026-08-08T00:00:00.000Z',
              message: 'Aligned message',
              latestTvl: 4_151_203.07,
              totalBudget: 25_000,
              perUserRewardCapUsd: 5000,
              campaignId: 'linea-usdc',
              rewardAddressType: 'token',
              totalRewardAmount: 12345,
              totalRewardTokenSymbol: 'USDC',
              description: 'legacy',
              tvlUsd: 1,
              totalRewardUsd: 2,
            },
          ],
        },
      ],
    });

    const brevis = parsed.reserves[0].brevisSupplys?.[0];
    expect(brevis?.campaignApr).toBe(2.8);
    expect(brevis?.campaignStartedAt).toBe('2025-08-13T13:00:00.000Z');
    expect(brevis?.campaignEndedAt).toBe('2026-08-08T00:00:00.000Z');
    expect(brevis?.message).toBe('Aligned message');
    expect(brevis?.latestTvl).toBe(4_151_203.07);
    expect(brevis?.totalBudget).toBe(25_000);
    expect(brevis?.perUserRewardCapUsd).toBe(5000);
    expect(brevis?.campaignId).toBe('linea-usdc');
    expect((brevis as Record<string, unknown>)?.rewardAddressType).toBe('token');
    expect((brevis as Record<string, unknown>)?.totalRewardAmount).toBe(12345);
    expect((brevis as Record<string, unknown>)?.totalRewardTokenSymbol).toBe('USDC');
    expect((brevis as Record<string, unknown>)?.description).toBe('legacy');
    expect((brevis as Record<string, unknown>)?.tvlUsd).toBe(1);
    expect((brevis as Record<string, unknown>)?.totalRewardUsd).toBe(2);
  });
});
