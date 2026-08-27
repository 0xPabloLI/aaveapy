import { describe, expect, it } from 'vitest';

import * as formatters from './formatters';
import {
  calculateTotalIncentiveApr,
  calculateTotalIncentiveApy,
  resolveVisibleIncentiveBadgeValue,
} from './incentiveAggregation';
import { convertAprToApy } from './rateCalculations';
import { MERKL_WHITELIST_NO_CAMPAIGN_ID_SENTINEL } from './merklWhitelist';
import type { BrevisIncentive, MeritCampaignGroup, MerklOpportunityGroup, ReserveWithSpread } from '@/types/aave';

const daysFromNowIso = (days: number): string => {
  const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return date.toISOString();
};

describe('incentive calculations only include active campaigns', () => {
  it('counts only active merit/merkl/brevis campaigns for APR totals', () => {
    const meritIncentives: MeritCampaignGroup[] = [
      {
        link: 'https://example.com/active-merit',
        breakdowns: [
          {
            campaignApr: 2,
            campaignStartedAt: daysFromNowIso(-1),
            campaignEndedAt: daysFromNowIso(1),
            campaignId: 'merit-base',
          },
          {
            campaignApr: 1,
            campaignStartedAt: daysFromNowIso(-1),
            campaignEndedAt: daysFromNowIso(1),
            campaignId: 'merit-self',
          },
        ],
      },
      {
        link: 'https://example.com/past-merit',
        breakdowns: [
          {
            campaignApr: 10,
            campaignStartedAt: daysFromNowIso(-10),
            campaignEndedAt: daysFromNowIso(-5),
            campaignId: 'merit-past',
          },
        ],
      },
      {
        link: 'https://example.com/missing-merit-dates',
        breakdowns: [
          {
            campaignApr: 5,
            campaignStartedAt: '',
            campaignEndedAt: '',
            campaignId: 'merit-missing',
          },
        ],
      },
    ];

    const merklOpportunities: MerklOpportunityGroup[] = [
      {
        breakdowns: [
          {
            campaignApr: 4,
            campaignId: 'active-merkl',
            campaignStartedAt: daysFromNowIso(-1),
            campaignEndedAt: daysFromNowIso(1),
          },
          {
            campaignApr: 9,
            campaignId: 'future-merkl',
            campaignStartedAt: daysFromNowIso(3),
            campaignEndedAt: daysFromNowIso(6),
          },
        ],
      },
    ];

    const brevisIncentives: BrevisIncentive[] = [
      {
        link: 'https://example.com/active-brevis',
        name: 'Brevis Active',
        message: 'Active Brevis',
        campaignApr: 3,
        campaignStartedAt: daysFromNowIso(-1),
        campaignEndedAt: daysFromNowIso(1),
        breakdowns: [
          {
            campaignId: 'brevis-active',
            campaignApr: 3,
            campaignStartedAt: daysFromNowIso(-1),
            campaignEndedAt: daysFromNowIso(1),
          },
        ],
      },
      {
        link: 'https://example.com/future-brevis',
        name: 'Brevis Future',
        message: 'Future Brevis',
        campaignApr: 8,
        campaignStartedAt: daysFromNowIso(4),
        campaignEndedAt: daysFromNowIso(8),
        breakdowns: [
          {
            campaignId: 'brevis-future',
            campaignApr: 8,
            campaignStartedAt: daysFromNowIso(4),
            campaignEndedAt: daysFromNowIso(8),
          },
        ],
      },
    ];

    const protocolIncentives = [1, 0, -2];

    const apr = calculateTotalIncentiveApr(
      meritIncentives,
      merklOpportunities,
      brevisIncentives,
      protocolIncentives
    );

    // active: merit (2 + 1) + merkl (4) + brevis (3) + protocol (1 + 0)
    expect(apr).toBe(11);
  });

  it('uses the same active-only scope for APY totals', () => {
    const meritIncentives: MeritCampaignGroup[] = [
      {
        link: 'https://example.com/active-merit',
        breakdowns: [
          {
            campaignApr: 2,
            campaignStartedAt: daysFromNowIso(-1),
            campaignEndedAt: daysFromNowIso(1),
            campaignId: 'merit-base',
          },
          {
            campaignApr: 1,
            campaignStartedAt: daysFromNowIso(-1),
            campaignEndedAt: daysFromNowIso(1),
            campaignId: 'merit-self',
          },
        ],
      },
      {
        link: 'https://example.com/past-merit',
        breakdowns: [
          {
            campaignApr: 10,
            campaignStartedAt: daysFromNowIso(-10),
            campaignEndedAt: daysFromNowIso(-5),
            campaignId: 'merit-past',
          },
        ],
      },
    ];

    const merklOpportunities: MerklOpportunityGroup[] = [
      {
        breakdowns: [
          {
            campaignApr: 4,
            campaignId: 'active-merkl',
            campaignStartedAt: daysFromNowIso(-1),
            campaignEndedAt: daysFromNowIso(1),
          },
          {
            campaignApr: 9,
            campaignId: 'past-merkl',
            campaignStartedAt: daysFromNowIso(-10),
            campaignEndedAt: daysFromNowIso(-8),
          },
        ],
      },
    ];

    const brevisIncentives: BrevisIncentive[] = [
      {
        campaignApr: 3,
        link: 'https://example.com/active-brevis',
        campaignStartedAt: daysFromNowIso(-1),
        campaignEndedAt: daysFromNowIso(1),
        message: 'Active Brevis',
      },
      {
        campaignApr: 8,
        link: 'https://example.com/future-brevis',
        campaignStartedAt: daysFromNowIso(4),
        campaignEndedAt: daysFromNowIso(8),
        message: 'Future Brevis',
      },
    ];

    const protocolIncentives = [1, 0, -2];

    const apy = calculateTotalIncentiveApy(
      meritIncentives,
      merklOpportunities,
      brevisIncentives,
      protocolIncentives
    );

    const expected =
      convertAprToApy(2) +
      convertAprToApy(1) +
      convertAprToApy(4) +
      convertAprToApy(3) +
      convertAprToApy(1) +
      convertAprToApy(0);

    expect(apy).toBeCloseTo(expected, 10);
  });
});

describe('whitelist-only Merkl campaign handling', () => {
  const merklOpportunities: MerklOpportunityGroup[] = [
    {
      breakdowns: [
        {
          campaignApr: 4,
          campaignId: 'public-merkl',
          campaignStartedAt: daysFromNowIso(-1),
          campaignEndedAt: daysFromNowIso(2),
        },
        {
          campaignApr: 7,
          campaignId: 'whitelist-merkl',
          campaignStartedAt: daysFromNowIso(-1),
          campaignEndedAt: daysFromNowIso(2),
          whitelistOnly: true,
        },
      ],
    },
  ];

  it('excludes whitelist-only Merkl campaigns from APR by default', () => {
    const apr = calculateTotalIncentiveApr([], merklOpportunities, [], []);
    expect(apr).toBe(4);
  });

  it('includes whitelist-only Merkl campaigns when enabled', () => {
    const apr = calculateTotalIncentiveApr([], merklOpportunities, [], [], undefined, {
      whitelistMerklCampaignIds: new Set(['whitelist-merkl']),
    });
    expect(apr).toBe(11);
  });

  it('includes whitelist-only Merkl without campaign id when sentinel is enabled', () => {
    const orphanOpportunities: MerklOpportunityGroup[] = [
      {
        breakdowns: [
          {
            campaignApr: 3,
            campaignId: '',
            campaignStartedAt: daysFromNowIso(-1),
            campaignEndedAt: daysFromNowIso(2),
            whitelistOnly: true,
          },
        ],
      },
    ];
    const aprDefault = calculateTotalIncentiveApr([], orphanOpportunities, [], []);
    expect(aprDefault).toBe(0);
    const aprWithSentinel = calculateTotalIncentiveApr([], orphanOpportunities, [], [], undefined, {
      whitelistMerklCampaignIds: new Set([MERKL_WHITELIST_NO_CAMPAIGN_ID_SENTINEL]),
    });
    expect(aprWithSentinel).toBe(3);
  });
});

describe('Brevis open-ended campaign handling', () => {
  it('includes brevis with no endDate in APR totals', () => {
    const brevisIncentives: BrevisIncentive[] = [
      {
        campaignApr: 5,
        link: 'https://example.com/brevis-open',
        campaignStartedAt: daysFromNowIso(-10),
        campaignEndedAt: '',
        message: 'Open-ended Brevis',
      },
    ];
    const apr = calculateTotalIncentiveApr([], [], brevisIncentives, []);
    expect(apr).toBe(5);
  });

  it('includes brevis with no endDate in APY totals', () => {
    const brevisIncentives: BrevisIncentive[] = [
      {
        campaignApr: 5,
        link: 'https://example.com/brevis-open',
        campaignStartedAt: daysFromNowIso(-10),
        campaignEndedAt: '',
        message: 'Open-ended Brevis',
      },
    ];
    const apy = calculateTotalIncentiveApy([], [], brevisIncentives, []);
    expect(apy).toBeCloseTo(convertAprToApy(5), 10);
  });

  it('excludes brevis with future startDate and no endDate', () => {
    const brevisIncentives: BrevisIncentive[] = [
      {
        campaignApr: 5,
        link: 'https://example.com/brevis-future',
        campaignStartedAt: daysFromNowIso(10),
        campaignEndedAt: '',
        message: 'Future Brevis',
      },
    ];
    const apr = calculateTotalIncentiveApr([], [], brevisIncentives, []);
    expect(apr).toBe(0);
  });
});

describe('scenario size formatting', () => {
  it('formats displayed size values in token units when scenario mode is token', () => {
    const result = (formatters as { formatScenarioSize?: (value: number | null | undefined, options?: unknown) => string })
      .formatScenarioSize?.(12_000, {
        inputMode: 'token',
        tokenPrice: 2_000,
        tokenSymbol: 'WETH',
      });

    expect(result).toBe('6.00');
  });

  it('formats cap-related size values in token units when scenario mode is token', () => {
    const result = (formatters as { formatScenarioSize?: (value: number | null | undefined, options?: unknown) => string })
      .formatScenarioSize?.(2_500, {
        inputMode: 'token',
        tokenPrice: 2_000,
        tokenSymbol: 'WETH',
      });

    expect(result).toBe('1.25');
  });

  it('formats simulation deltas in token units when scenario mode is token', () => {
    const result = (formatters as { formatScenarioSizeDelta?: (value: number | null | undefined, options?: unknown) => string })
      .formatScenarioSizeDelta?.(4_000, {
        inputMode: 'token',
        tokenPrice: 2_000,
      });

    expect(result).toBe('+2.00');
  });

  it('formats simulation negative deltas in token units when scenario mode is token', () => {
    const result = (formatters as { formatScenarioSizeDelta?: (value: number | null | undefined, options?: unknown) => string })
      .formatScenarioSizeDelta?.(-2_500, {
        inputMode: 'token',
        tokenPrice: 2_000,
      });

    expect(result).toBe('-1.25');
  });
});

describe('resolveVisibleIncentiveBadgeValue', () => {
  const minimalReserve = {
    reserveId: 'm-0x0000000000000000000000000000000000000001',
    marketName: 'm',
    chainName: 'c',
    chainId: 1,
    tokenName: 't',
    tokenSymbol: 'T',
    tokenAddress: '0x0000000000000000000000000000000000000001',
  } as ReserveWithSpread;

  it('keeps small positive incentives that were previously hidden by the 0.01% table threshold', () => {
    expect(resolveVisibleIncentiveBadgeValue(0.005, minimalReserve, 'supply', true, 1)).toBe(0.005);
  });

  it('keeps 0 when the tooltip still has Merkl rows (e.g. whitelist-only)', () => {
    const start = daysFromNowIso(-1);
    const end = daysFromNowIso(1);
    const reserve = {
      ...minimalReserve,
      merklSupplys: [
        {
          name: 'op',
          breakdowns: [
            {
              campaignApr: 0,
              campaignStartedAt: start,
              campaignEndedAt: end,
              campaignId: 'wl1',
              whitelistOnly: true,
            },
          ],
        },
      ],
    } as ReserveWithSpread;
    expect(resolveVisibleIncentiveBadgeValue(0, reserve, 'supply', true, 1)).toBe(0);
  });

  it('hides 0 when there are no incentive sources', () => {
    expect(resolveVisibleIncentiveBadgeValue(0, minimalReserve, 'supply', true, 1)).toBe(null);
  });
});

describe('formatUsd', () => {
  it('formats values >= 1000 with locale string and 2 decimal places', () => {
    expect(formatters.formatUsd(1234.56)).toBe('$1,234.56');
  });

  it('formats values < 1000 with toFixed(2)', () => {
    expect(formatters.formatUsd(999.99)).toBe('$999.99');
  });

  it('returns "-" for null', () => {
    expect(formatters.formatUsd(null)).toBe('-');
  });

  it('returns "-" for undefined', () => {
    expect(formatters.formatUsd(undefined)).toBe('-');
  });

  it('returns "-" for NaN', () => {
    expect(formatters.formatUsd(NaN)).toBe('-');
  });

  it('formats zero as $0.00', () => {
    expect(formatters.formatUsd(0)).toBe('$0.00');
  });

  it('formats large values with comma separators', () => {
    expect(formatters.formatUsd(1_000_000)).toBe('$1,000,000.00');
  });
});

describe('formatPercent', () => {
  it('formats a normal percentage value', () => {
    const result = formatters.formatPercent(5.23);
    expect(result).toContain('5.23');
  });

  it('returns "-" for null', () => {
    expect(formatters.formatPercent(null)).toBe('-');
  });

  it('returns "-" for undefined', () => {
    expect(formatters.formatPercent(undefined)).toBe('-');
  });

  it('returns "-" for NaN', () => {
    expect(formatters.formatPercent(NaN)).toBe('-');
  });

  it('returns "-" for Infinity', () => {
    expect(formatters.formatPercent(Infinity)).toBe('-');
    expect(formatters.formatPercent(-Infinity)).toBe('-');
  });

  it('caps extremely large values at >10K%', () => {
    expect(formatters.formatPercent(9_999)).toBe('10K%');
    expect(formatters.formatPercent(10_000)).toBe('>10K%');
    expect(formatters.formatPercent(1_000_000)).toBe('>10K%');
    expect(formatters.formatPercent(321_032_686_389_358)).toBe('>10K%');
  });

  it('caps extremely large negative values at <-10K%', () => {
    expect(formatters.formatPercent(-10_000)).toBe('<-10K%');
    expect(formatters.formatPercent(-1_000_000_000)).toBe('<-10K%');
  });
});

describe('convertAprToApy', () => {
  it('converts 0% APR to 0% APY', () => {
    expect(convertAprToApy(0)).toBeCloseTo(0, 10);
  });

  it('converts positive APR to slightly higher APY due to compounding', () => {
    const apy = convertAprToApy(12);
    expect(apy).toBeGreaterThan(12);
    expect(apy).toBeLessThan(13);
  });

  it('handles negative APR (compounding dampens the effect)', () => {
    const apy = convertAprToApy(-5);
    expect(apy).toBeLessThan(0);
    expect(apy).toBeGreaterThan(-5);
  });

  it('handles very large APR', () => {
    const apy = convertAprToApy(1000);
    expect(apy).toBeGreaterThan(1000);
    expect(Number.isFinite(apy)).toBe(true);
  });
});

describe('formatReserveSizeUsd', () => {
  it('formats billions with B suffix', () => {
    expect(formatters.formatReserveSizeUsd(1_500_000_000)).toBe('$1.50B');
  });

  it('formats millions with M suffix', () => {
    expect(formatters.formatReserveSizeUsd(5_200_000)).toBe('$5.20M');
  });

  it('formats thousands with K suffix', () => {
    expect(formatters.formatReserveSizeUsd(18_800)).toBe('$18.80K');
  });

  it('formats sub-thousand without suffix', () => {
    expect(formatters.formatReserveSizeUsd(999)).toBe('$999.00');
  });

  it('returns "-" for null', () => {
    expect(formatters.formatReserveSizeUsd(null)).toBe('-');
  });

  it('returns "-" for undefined', () => {
    expect(formatters.formatReserveSizeUsd(undefined)).toBe('-');
  });

  it('formats negative values with leading minus', () => {
    expect(formatters.formatReserveSizeUsd(-18_800_000)).toBe('-$18.80M');
  });
});

describe('formatSignedReserveSizeUsd', () => {
  it('formats positive values with + prefix', () => {
    expect(formatters.formatSignedReserveSizeUsd(1_500)).toBe('+$1.50K');
  });

  it('formats negative values with Unicode minus prefix', () => {
    expect(formatters.formatSignedReserveSizeUsd(-5_200_000)).toBe('\u2212$5.20M');
  });

  it('formats zero without sign', () => {
    expect(formatters.formatSignedReserveSizeUsd(0)).toBe('$0.00');
  });

  it('formats sub-thousand positive value', () => {
    expect(formatters.formatSignedReserveSizeUsd(42.5)).toBe('+$42.50');
  });

  it('formats sub-thousand negative value with Unicode minus', () => {
    expect(formatters.formatSignedReserveSizeUsd(-99.99)).toBe('\u2212$99.99');
  });

  it('formats billions with + prefix', () => {
    expect(formatters.formatSignedReserveSizeUsd(1_500_000_000)).toBe('+$1.50B');
  });

  it('formats billions with Unicode minus prefix', () => {
    expect(formatters.formatSignedReserveSizeUsd(-2_300_000_000)).toBe('\u2212$2.30B');
  });

  it('returns em dash for null', () => {
    expect(formatters.formatSignedReserveSizeUsd(null)).toBe('\u2014');
  });

  it('returns em dash for undefined', () => {
    expect(formatters.formatSignedReserveSizeUsd(undefined)).toBe('\u2014');
  });

  it('returns em dash for NaN', () => {
    expect(formatters.formatSignedReserveSizeUsd(NaN)).toBe('\u2014');
  });
});
