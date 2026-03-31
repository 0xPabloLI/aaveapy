import { describe, expect, it } from 'vitest';
import {
  hasAnyIncentiveBreakdownHref,
  hasAnyCampaignIncentiveHref,
  includeIncentiveSourceInBreakdown,
  incentiveSourceToTableRows,
  resolveFirstIncentiveSourceHref,
  type IncentiveSourceRow,
} from './simulationIncentiveTableRows';

describe('incentiveSourceToTableRows', () => {
  it('uses src.href when a campaign omits href (Merkl group fallback)', () => {
    const src: IncentiveSourceRow = {
      label: 'Merkl Incentive',
      current: 1,
      after: 1,
      delta: 0,
      href: 'https://merkl.example/opps',
      hideAggregateWhenCampaigns: true,
      campaigns: [
        {
          id: 'c1',
          label: 'Campaign A',
          current: 1,
          after: 1,
          delta: 0,
          href: undefined,
        },
      ],
    };
    const rows = incentiveSourceToTableRows(src, 0, 'supply', true);
    expect(rows).toHaveLength(1);
    expect(rows[0].href).toBe('https://merkl.example/opps');
  });

  it('prefers per-campaign href over src.href when present', () => {
    const src: IncentiveSourceRow = {
      label: 'Merkl Incentive',
      current: 1,
      after: 1,
      delta: 0,
      href: 'https://merkl.example/opps',
      hideAggregateWhenCampaigns: true,
      campaigns: [
        {
          id: 'c1',
          label: 'Campaign A',
          current: 1,
          after: 1,
          delta: 0,
          href: 'https://campaign.example/a',
        },
      ],
    };
    const rows = incentiveSourceToTableRows(src, 0, 'supply', true);
    expect(rows[0].href).toBe('https://campaign.example/a');
  });

  it('sub-rows under aggregate use src.href when campaign omits href', () => {
    const src: IncentiveSourceRow = {
      label: 'Protocol Incentive',
      current: 0.5,
      after: 0.5,
      delta: 0,
      href: 'https://aave.example/reserve',
      campaigns: [
        {
          id: 'p1',
          label: 'Boost',
          current: 0.5,
          after: 0.5,
          delta: 0,
        },
      ],
    };
    const rows = incentiveSourceToTableRows(src, 0, 'borrow', false);
    expect(rows).toHaveLength(2);
    expect(rows[1].href).toBe('https://aave.example/reserve');
  });

  it('mergeSingleCampaignRow uses c.href ?? src.href', () => {
    const src: IncentiveSourceRow = {
      label: 'Brevis Incentive',
      current: 2,
      after: 2,
      delta: 0,
      href: 'https://brevis.example/fallback',
      mergeSingleCampaignRow: true,
      campaigns: [
        {
          id: 'b1',
          label: 'Brevis',
          current: 2,
          after: 2,
          delta: 0,
        },
      ],
    };
    const rows = incentiveSourceToTableRows(src, 0, 'supply', true);
    expect(rows).toHaveLength(1);
    expect(rows[0].href).toBe('https://brevis.example/fallback');
  });
});

describe('includeIncentiveSourceInBreakdown', () => {
  it('includes sources with aggregate below 0.005% when still non-zero (Brevis slice)', () => {
    const src: IncentiveSourceRow = {
      label: 'Brevis Incentive',
      current: 0.004,
      after: null,
      delta: null,
      href: 'https://brevis.example',
    };
    expect(includeIncentiveSourceInBreakdown(src)).toBe(true);
  });

  it('still excludes strict zeros', () => {
    const src: IncentiveSourceRow = {
      label: 'Brevis Incentive',
      current: 0,
      after: null,
      delta: null,
      href: null,
    };
    expect(includeIncentiveSourceInBreakdown(src)).toBe(false);
  });
});

describe('resolveFirstIncentiveSourceHref', () => {
  it('returns first campaign href when available', () => {
    const sources: IncentiveSourceRow[] = [
      {
        label: 'Merkl',
        current: 1,
        after: 1,
        delta: 0,
        href: 'https://merkl.example',
        campaigns: [{ id: 'x', label: 'C', current: 1, after: 1, delta: 0, href: 'https://per-campaign' }],
      },
    ];
    expect(resolveFirstIncentiveSourceHref(sources, 'https://fallback')).toBe('https://per-campaign');
  });

  it('falls back to src.href when campaigns have no href', () => {
    const sources: IncentiveSourceRow[] = [
      {
        label: 'Merkl',
        current: 1,
        after: 1,
        delta: 0,
        href: 'https://merkl.example',
        campaigns: [{ id: 'x', label: 'C', current: 1, after: 1, delta: 0 }],
      },
    ];
    expect(resolveFirstIncentiveSourceHref(sources, 'https://fallback')).toBe('https://merkl.example');
  });

  it('uses final fallback when nothing else matches', () => {
    const sources: IncentiveSourceRow[] = [
      {
        label: 'Empty',
        current: 1,
        after: 1,
        delta: 0,
        href: null,
      },
    ];
    expect(resolveFirstIncentiveSourceHref(sources, 'https://fallback')).toBe('https://fallback');
  });
});

describe('hasAnyCampaignIncentiveHref', () => {
  it('returns true only when at least one campaign has href', () => {
    const withCampaignHref: IncentiveSourceRow[] = [
      {
        label: 'Merkl',
        current: 1,
        after: 1,
        delta: 0,
        href: 'https://merkl.example',
        campaigns: [{ id: 'x', label: 'C', current: 1, after: 1, delta: 0, href: 'https://campaign.example' }],
      },
    ];
    const withoutCampaignHref: IncentiveSourceRow[] = [
      {
        label: 'Merkl',
        current: 1,
        after: 1,
        delta: 0,
        href: 'https://merkl.example',
        campaigns: [{ id: 'x', label: 'C', current: 1, after: 1, delta: 0 }],
      },
    ];
    expect(hasAnyCampaignIncentiveHref(withCampaignHref)).toBe(true);
    expect(hasAnyCampaignIncentiveHref(withoutCampaignHref)).toBe(false);
  });
});

describe('hasAnyIncentiveBreakdownHref', () => {
  it('treats campaign fallback (c.href ?? src.href) as breakdown link', () => {
    const sources: IncentiveSourceRow[] = [
      {
        label: 'Brevis',
        current: 1,
        after: 1,
        delta: 0,
        href: 'https://source.example',
        campaigns: [{ id: 'x', label: 'Campaign', current: 1, after: 1, delta: 0 }],
      },
    ];
    expect(hasAnyIncentiveBreakdownHref(sources)).toBe(true);
  });

  it('returns false when neither source nor campaigns have links', () => {
    const sources: IncentiveSourceRow[] = [
      {
        label: 'No link',
        current: 1,
        after: 1,
        delta: 0,
        href: null,
        campaigns: [{ id: 'x', label: 'Campaign', current: 1, after: 1, delta: 0 }],
      },
    ];
    expect(hasAnyIncentiveBreakdownHref(sources)).toBe(false);
  });
});
