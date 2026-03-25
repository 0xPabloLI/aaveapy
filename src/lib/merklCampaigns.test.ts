import { describe, expect, it } from 'vitest';

import { MERKL_WHITELIST_NO_CAMPAIGN_ID_SENTINEL } from './formatters';
import { collectMerklCampaignOptions, collectWhitelistOnlyMerklCampaignEntries } from './merklCampaigns';
import type { ReserveWithSpread } from '@/types/aave';

const daysFromNowIso = (days: number): string => {
  const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return date.toISOString();
};

const makeReserve = (overrides: Partial<ReserveWithSpread> = {}): ReserveWithSpread =>
  ({
    marketName: 'AaveV3Ink',
    chainName: 'Ink',
    chainId: 57073,
    tokenName: 'USD Coin',
    tokenSymbol: 'USDC',
    tokenAddress: '0xToken',
    ...overrides,
  }) as ReserveWithSpread;

describe('collectMerklCampaignOptions', () => {
  it('marks point-based campaigns as rate-driven', () => {
    const reserves = [
      makeReserve({
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

    const options = collectMerklCampaignOptions(reserves);
    expect(options).toHaveLength(1);
    expect(options[0].usesPointToUsdRate).toBe(true);
  });

  it('excludes whitelist-only campaigns by default and includes them when enabled', () => {
    const reserves = [
      makeReserve({
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

    const defaultOptions = collectMerklCampaignOptions(reserves);
    expect(defaultOptions.map((option) => option.campaignId)).toEqual(['public']);

    const includeWhitelistOptions = collectMerklCampaignOptions(reserves, {
      whitelistMerklCampaignIds: new Set(['whitelist']),
    });
    expect(includeWhitelistOptions.map((option) => option.campaignId)).toEqual(['public', 'whitelist']);
  });
});

describe('collectWhitelistOnlyMerklCampaignEntries', () => {
  it('includes a sentinel entry when a whitelist-only breakdown has no campaign id', () => {
    const reserves = [
      makeReserve({
        merklSupplys: [
          {
            name: 'Orphan WL',
            breakdowns: [
              {
                campaignApr: 1,
                campaignStartedAt: daysFromNowIso(-1),
                campaignEndedAt: daysFromNowIso(30),
                campaignId: '',
                whitelistOnly: true,
              },
            ],
          },
        ],
      }),
    ];
    const entries = collectWhitelistOnlyMerklCampaignEntries(reserves);
    expect(entries.some((e) => e.campaignId === MERKL_WHITELIST_NO_CAMPAIGN_ID_SENTINEL)).toBe(true);
  });
});
