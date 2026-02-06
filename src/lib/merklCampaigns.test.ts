import { describe, expect, it } from 'vitest';

import type { PoolWithSpread } from '@/types/aave';
import { collectMerklCampaignOptions } from './merklCampaigns';

describe('collectMerklCampaignOptions', () => {
  it('collects and labels campaign ids from merkl supply/borrow/hold breakdowns', () => {
    const pools: PoolWithSpread[] = [
      {
        marketName: 'AaveV3Ethereum',
        chainName: 'Ethereum',
        chainId: 1,
        tokenName: 'USD Coin',
        tokenSymbol: 'USDC',
        tokenAddress: '0x1',
        merklSupplys: [
          {
            name: 'Supply A',
            breakdowns: [
              {
                campaignApr: 1,
                campaignId: 'supply-1',
                campaignStartedAt: '2026-01-01T00:00:00.000Z',
                campaignEndedAt: '2026-12-31T00:00:00.000Z',
              },
            ],
          },
        ],
        merklBorrows: [
          {
            name: 'Borrow A',
            breakdowns: [
              {
                campaignApr: 2,
                campaignId: 'borrow-1',
                campaignStartedAt: '2026-01-01T00:00:00.000Z',
                campaignEndedAt: '2026-12-31T00:00:00.000Z',
              },
            ],
          },
        ],
      },
      {
        marketName: 'AaveV3Ethereum',
        chainName: 'Ethereum',
        chainId: 1,
        tokenName: 'USD Coin',
        tokenSymbol: 'USDC',
        tokenAddress: '0x1',
        merklHolds: [
          {
            name: 'Hold A',
            breakdowns: [
              {
                campaignApr: 3,
                campaignId: 'hold-1',
                campaignStartedAt: '2026-01-01T00:00:00.000Z',
                campaignEndedAt: '2026-12-31T00:00:00.000Z',
              },
            ],
          },
        ],
        merklSupplys: [
          {
            name: 'Duplicate',
            breakdowns: [
              {
                campaignApr: 1,
                campaignId: 'supply-1',
                campaignStartedAt: '2026-01-01T00:00:00.000Z',
                campaignEndedAt: '2026-12-31T00:00:00.000Z',
              },
            ],
          },
        ],
      },
    ];

    const options = collectMerklCampaignOptions(pools);
    const ids = options.map((option) => option.campaignId);

    expect(ids).toEqual(['borrow-1', 'hold-1', 'supply-1']);
    const supply = options.find((option) => option.campaignId === 'supply-1');
    expect(supply?.label).toContain('Supply');
    expect(supply?.tokenSymbol).toBe('USDC');
    expect(supply?.tokenAddress).toBe('0x1');
    expect(supply?.chainId).toBe(1);
    expect(options.find((option) => option.campaignId === 'borrow-1')?.label).toContain('Borrow');
    expect(options.find((option) => option.campaignId === 'hold-1')?.label).toContain('Hold');
  });
});
