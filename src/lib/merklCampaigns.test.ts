import { describe, expect, it } from 'vitest';

import { collectMerklCampaignOptions } from './merklCampaigns';
import type { PoolWithSpread } from '@/types/aave';

const makePool = (overrides: Partial<PoolWithSpread> = {}): PoolWithSpread =>
  ({
    marketName: 'AaveV3Ink',
    chainName: 'Ink',
    chainId: 57073,
    tokenName: 'USD Coin',
    tokenSymbol: 'USDC',
    tokenAddress: '0xToken',
    ...overrides,
  }) as PoolWithSpread;

describe('collectMerklCampaignOptions', () => {
  it('marks point-based campaigns as rate-driven', () => {
    const pools = [
      makePool({
        merklSupplys: [
          {
            name: 'Ink points campaign',
            breakdowns: [
              {
                campaignApr: 1,
                campaignStartedAt: '2026-01-01T00:00:00.000Z',
                campaignEndedAt: '2026-02-01T00:00:00.000Z',
                campaignId: '123',
                pointsPerThousandUsd: 1,
              },
            ],
          },
        ],
      }),
    ];

    const options = collectMerklCampaignOptions(pools);
    expect(options).toHaveLength(1);
    expect(options[0].usesPointToUsdRate).toBe(true);
  });

  it('excludes whitelist-only campaigns by default and includes them when enabled', () => {
    const pools = [
      makePool({
        merklSupplys: [
          {
            name: 'Mixed campaign',
            breakdowns: [
              {
                campaignApr: 1,
                campaignStartedAt: '2026-01-01T00:00:00.000Z',
                campaignEndedAt: '2026-02-01T00:00:00.000Z',
                campaignId: 'public',
              },
              {
                campaignApr: 1,
                campaignStartedAt: '2026-01-01T00:00:00.000Z',
                campaignEndedAt: '2026-02-01T00:00:00.000Z',
                campaignId: 'whitelist',
                whitelistOnly: true,
              },
            ],
          },
        ],
      }),
    ];

    const defaultOptions = collectMerklCampaignOptions(pools);
    expect(defaultOptions.map((option) => option.campaignId)).toEqual(['public']);

    const includeWhitelistOptions = collectMerklCampaignOptions(pools, {
      includeWhitelistOnly: true,
    });
    expect(includeWhitelistOptions.map((option) => option.campaignId)).toEqual(['public', 'whitelist']);
  });
});
