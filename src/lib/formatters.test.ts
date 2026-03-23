import { describe, expect, it } from 'vitest';

import * as formatters from './formatters';
import { calculateTotalIncentiveApr, calculateTotalIncentiveApy, convertAprToApy } from './formatters';
import type { BrevisIncentive, MeritIncentive, MerklOpportunityGroup } from '@/types/aave';

const daysFromNowIso = (days: number): string => {
  const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return date.toISOString();
};

describe('incentive calculations only include active campaigns', () => {
  it('counts only active merit/merkl/brevis campaigns for APR totals', () => {
    const meritIncentives: MeritIncentive[] = [
      {
        apr: 2,
        selfApr: 1,
        link: 'https://example.com/active-merit',
        startDate: daysFromNowIso(-1),
        endDate: daysFromNowIso(1),
      },
      {
        apr: 10,
        link: 'https://example.com/past-merit',
        startDate: daysFromNowIso(-10),
        endDate: daysFromNowIso(-5),
      },
      {
        apr: 5,
        link: 'https://example.com/missing-merit-dates',
        startDate: '',
        endDate: '',
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
        apr: 3,
        link: 'https://example.com/active-brevis',
        startDate: daysFromNowIso(-1),
        endDate: daysFromNowIso(1),
        name: 'Active Brevis',
      },
      {
        apr: 8,
        link: 'https://example.com/future-brevis',
        startDate: daysFromNowIso(4),
        endDate: daysFromNowIso(8),
        name: 'Future Brevis',
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
    const meritIncentives: MeritIncentive[] = [
      {
        apr: 2,
        selfApr: 1,
        link: 'https://example.com/active-merit',
        startDate: daysFromNowIso(-1),
        endDate: daysFromNowIso(1),
      },
      {
        apr: 10,
        link: 'https://example.com/past-merit',
        startDate: daysFromNowIso(-10),
        endDate: daysFromNowIso(-5),
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
        apr: 3,
        link: 'https://example.com/active-brevis',
        startDate: daysFromNowIso(-1),
        endDate: daysFromNowIso(1),
        name: 'Active Brevis',
      },
      {
        apr: 8,
        link: 'https://example.com/future-brevis',
        startDate: daysFromNowIso(4),
        endDate: daysFromNowIso(8),
        name: 'Future Brevis',
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
      includeWhitelistOnlyMerkl: true,
    });
    expect(apr).toBe(11);
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
