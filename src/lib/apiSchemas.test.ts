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

  it('preserves full forecast metrics from /meta/side-data', () => {
    const parsed = SideDataMetaResponseSchema.parse({
      forecast: {
        staleTimeMs: 600000,
        items: [
          {
            campaignId: '16403393592832236981',
            campaignType: 'DUTCH_AUCTION',
            plannedDaily: 11312,
            requiredDaily: 11312,
            aprCap: null,
            totalBudget: 79184,
            distributedSoFar: 0,
            latestTvl: 23586552.55647095,
            endTimestamp: 1774965600,
          },
        ],
        errors: [],
      },
    });

    const item = parsed.forecast?.items[0];
    expect(item?.campaignType).toBe('DUTCH_AUCTION');
    expect(item?.plannedDaily).toBe(11312);
    expect(item?.requiredDaily).toBe(11312);
    expect(item?.aprCap).toBeNull();
    expect(item?.totalBudget).toBe(79184);
    expect(item?.latestTvl).toBe(23586552.55647095);
  });
});
