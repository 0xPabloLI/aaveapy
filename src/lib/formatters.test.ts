import { describe, expect, it } from 'vitest';

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
