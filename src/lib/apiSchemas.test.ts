import { describe, expect, it } from 'vitest';

import { MarketsResponseSchema } from './apiSchemas';

const buildMarketsPayload = (message: unknown) => ({
  data: [
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
  lastUpdated: '2026-03-09T00:00:00.000Z',
  isStale: false,
  updateInProgress: false,
});

describe('MarketsResponseSchema', () => {
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
});
