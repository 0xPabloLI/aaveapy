import { describe, expect, it } from 'vitest';
import { MarketsResponseSchema, SideDataMetaResponseSchema } from './apiSchemas';

const buildMarketsPayload = (message: unknown) => ({
  snapshot: {
    lastUpdated: '2026-03-09T00:00:00.000Z',
    version: '1.0.0',
  },
    reserves: [
      {
        reserveId: 'AaveV3Celo-0x1234',
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
        version: '1.0.0',
      },
      reserves: [
        {
          reserveId: 'AaveV3Ink-0x1',
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
              // DUTCH_AUCTION no longer includes aprCap in Merkl campaign fields.
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
    expect(breakdown?.aprCap).toBeUndefined();
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

  it('accepts aligned Brevis fields while dropping deprecated legacy fields', () => {
    const parsed = MarketsResponseSchema.parse({
      snapshot: {
        lastUpdated: '2026-03-26T00:00:00.000Z',
        version: '1.0.0',
      },
      reserves: [
        {
          reserveId: 'AaveV3Linea-0x1',
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
              link: 'https://example.com/brevis',
              name: 'Brevis USDC',
              message: 'Aligned message',
              breakdowns: [
                {
                  campaignApr: 2.8,
                  campaignStartedAt: '2025-08-13T13:00:00.000Z',
                  campaignEndedAt: '2026-08-08T00:00:00.000Z',
                  latestTvl: 4_151_203.07,
                  totalBudget: 25_000,
                  perUserRewardCapUsd: 5000,
                  campaignId: 'linea-usdc',
                  totalRewardAmount: 12345,
                  totalRewardTokenSymbol: 'USDC',
                  description: 'legacy',
                  tvlUsd: 1,
                  totalRewardUsd: 2,
                },
              ],
            },
          ],
        },
      ],
    });

    const brevis = parsed.reserves[0].brevisSupplys?.[0];
    expect(brevis?.name).toBe('Brevis USDC');
    expect(brevis?.message).toBe('Aligned message');
    // Grouped Brevis payloads are normalized to flat incentives (breakdown fields merged up).
    expect(brevis?.campaignApr).toBe(2.8);
    expect(brevis?.campaignStartedAt).toBe('2025-08-13T13:00:00.000Z');
    expect(brevis?.campaignEndedAt).toBe('2026-08-08T00:00:00.000Z');
    expect(brevis?.latestTvl).toBe(4_151_203.07);
    expect(brevis?.totalBudget).toBe(25_000);
    expect(brevis?.perUserRewardCapUsd).toBe(5000);
    expect(brevis?.campaignId).toBe('linea-usdc');
    expect('totalRewardAmount' in (brevis ?? {})).toBe(true);
    expect('totalRewardTokenSymbol' in (brevis ?? {})).toBe(true);
    expect('description' in (brevis ?? {})).toBe(true);
    expect('tvlUsd' in (brevis ?? {})).toBe(true);
    expect('totalRewardUsd' in (brevis ?? {})).toBe(true);
  });

  it('accepts isFrozen and isPaused fields on reserves', () => {
    const parsed = MarketsResponseSchema.parse({
      snapshot: {
        lastUpdated: '2026-04-24T00:00:00.000Z',
        version: '1.0.0',
      },
      reserves: [
        {
          reserveId: 'AaveV3Ethereum-0xfrozen',
          marketName: 'AaveV3Ethereum',
          chainName: 'Ethereum',
          chainId: 1,
          tokenName: 'Frozen Token',
          tokenSymbol: 'FRZ',
          tokenAddress: '0xfrozen',
          isFrozen: true,
          supplyApy: 2.5,
        },
        {
          reserveId: 'AaveV3Ethereum-0xpaused',
          marketName: 'AaveV3Ethereum',
          chainName: 'Ethereum',
          chainId: 1,
          tokenName: 'Paused Token',
          tokenSymbol: 'PAU',
          tokenAddress: '0xpaused',
          isFrozen: true,
          isPaused: true,
        },
        {
          reserveId: 'AaveV3Ethereum-0xnormal',
          marketName: 'AaveV3Ethereum',
          chainName: 'Ethereum',
          chainId: 1,
          tokenName: 'Normal Token',
          tokenSymbol: 'NRM',
          tokenAddress: '0xnormal',
          supplyApy: 3.0,
        },
      ],
    });

    expect(parsed.reserves[0].isFrozen).toBe(true);
    expect(parsed.reserves[0].isPaused).toBeUndefined();
    expect(parsed.reserves[0].supplyDisabled).toBeUndefined();
    expect(parsed.reserves[1].isFrozen).toBe(true);
    expect(parsed.reserves[1].isPaused).toBe(true);
    expect(parsed.reserves[2].isFrozen).toBeUndefined();
    expect(parsed.reserves[2].isPaused).toBeUndefined();
  });

  it('normalizes grouped Brevis breakdowns from /markets into flat Brevis incentives', () => {
    const parsed = MarketsResponseSchema.parse({
      snapshot: {
        lastUpdated: '2026-03-31T00:00:00.000Z',
        version: '1.0.0',
      },
      reserves: [
        {
          reserveId: 'AaveV3Linea-0x1',
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
              link: 'https://example.com/brevis-group',
              name: 'Grouped Brevis',
              message: 'Group-level message',
              breakdowns: [
                {
                  campaignApr: 2.4,
                  campaignStartedAt: '2025-08-13T13:00:00.000Z',
                  campaignEndedAt: '2026-08-08T00:00:00.000Z',
                  latestTvl: 3_784_092,
                  totalBudget: 9_996_400.6,
                  perUserRewardCapUsd: 5000,
                  campaignId: '1754995104',
                  customBreakdownField: 'from-breakdown',
                },
                {
                  campaignApr: 1.2,
                  campaignStartedAt: '2025-09-01T00:00:00.000Z',
                  campaignEndedAt: '2026-01-01T00:00:00.000Z',
                  campaignId: '1754995105',
                },
              ],
            },
          ],
        },
      ],
    });

    const brevisSupplys = parsed.reserves[0].brevisSupplys ?? [];
    expect(brevisSupplys).toHaveLength(2);
    expect(brevisSupplys[0]?.campaignApr).toBe(2.4);
    expect(brevisSupplys[0]?.campaignStartedAt).toBe('2025-08-13T13:00:00.000Z');
    expect(brevisSupplys[0]?.campaignEndedAt).toBe('2026-08-08T00:00:00.000Z');
    expect(brevisSupplys[0]?.campaignId).toBe('1754995104');
    expect(brevisSupplys[0]?.link).toBe('https://example.com/brevis-group');
    expect(brevisSupplys[0]?.message).toBe('Group-level message');
    expect((brevisSupplys[0] as Record<string, unknown>)?.customBreakdownField).toBe('from-breakdown');
    expect(brevisSupplys[1]?.campaignApr).toBe(1.2);
    expect(brevisSupplys[1]?.campaignId).toBe('1754995105');
    expect(brevisSupplys[1]?.link).toBe('https://example.com/brevis-group');
    expect(brevisSupplys[1]?.message).toBe('Group-level message');
  });
});
