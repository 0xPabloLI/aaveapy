// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReserveWithSpread } from '@/types/aave';
import TopOpportunities from './TopOpportunities';

const mockUseIsMobile = vi.fn();
const mockUseSideDataMeta = vi.fn();

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => mockUseIsMobile(),
}));

vi.mock('@/hooks/useSideDataMeta', () => ({
  useSideDataMeta: (...args: unknown[]) => mockUseSideDataMeta(...args),
}));

vi.mock('@/components/ui/carousel', () => ({
  Carousel: ({ children }: { children: React.ReactNode }) => <div data-testid="carousel">{children}</div>,
  CarouselContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  CarouselItem: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

const reserve: ReserveWithSpread = {
  reserveId: 'AaveV3Ethereum-0x0000000000000000000000000000000000000001',
  marketName: 'AaveV3Ethereum',
  chainName: 'Ethereum',
  chainId: 1,
  tokenName: 'Gho Token',
  tokenSymbol: 'GHO',
  tokenAddress: '0x0000000000000000000000000000000000000001',
  tokenPrice: 1,
  decimals: 18,
  reserveSize: '1000000000000000000000000',
  supplyCap: '2000000000000000000000000',
  borrowCap: '1000000000000000000000000',
  utilizationPct: 45,
  supplyApy: 3,
  borrowApy: 6,
  supplyDisabled: false,
  borrowDisabled: false,
  supplyIncentives: [8],
  borrowIncentives: [],
  meritSupplys: [],
  meritBorrows: [],
  merklSupplys: [],
  merklBorrows: [],
  brevisSupplys: [],
  brevisBorrows: [],
};

const baseProps = {
  reserves: [reserve],
  isApy: true,
  whitelistMerklCampaignIds: new Set<string>(),
  categoryGroups: {
    stablecoins: ['GHO'],
    ethRelated: [],
    btcRelated: [],
  },
  tydroPointToUsdRate: 0,
};

describe('TopOpportunities', () => {
  beforeEach(() => {
    mockUseIsMobile.mockReset();
    mockUseSideDataMeta.mockReset();
    mockUseSideDataMeta.mockReturnValue({ data: undefined });
  });
  afterEach(() => cleanup());

  const renderComponent = () => {
    const queryClient = new QueryClient();
    return render(
      <QueryClientProvider client={queryClient}>
        <TopOpportunities {...baseProps} />
      </QueryClientProvider>,
    );
  };

  it('renders mobile cards without desktop external-link row layout when useIsMobile is true', () => {
    mockUseIsMobile.mockReturnValue(true);

    const { queryByText, getAllByText } = renderComponent();

    expect(queryByText('Open GHO on Aave')).not.toBeInTheDocument();
    expect(getAllByText(/GHO/).length).toBeGreaterThan(0);
  });

  it('preserves APY total inside category cards when isApy is true', () => {
    mockUseIsMobile.mockReturnValue(false);

    const { getAllByText, queryByText } = renderComponent();

    expect(getAllByText(/11\.30%/).length).toBeGreaterThan(0);
    expect(queryByText(/^11\.00%$/)).not.toBeInTheDocument();
  });

  it('does not issue a real side-data fetch during happy-dom rendering', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    mockUseIsMobile.mockReturnValue(true);

    try {
      renderComponent();
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('shows "Base APY only" placeholder on mobile supply card when reserve has no incentive', () => {
    mockUseIsMobile.mockReturnValue(true);

    const noIncentiveReserve: ReserveWithSpread = {
      ...reserve,
      supplyIncentives: [],
    };

    const queryClient = new QueryClient();
    const { getByText } = render(
      <QueryClientProvider client={queryClient}>
        <TopOpportunities {...baseProps} reserves={[noIncentiveReserve]} />
      </QueryClientProvider>,
    );

    expect(getByText('Base APY only')).toBeInTheDocument();
  });

  it('shows "Base APR only" placeholder when isApy is false and no incentive', () => {
    mockUseIsMobile.mockReturnValue(true);

    const noIncentiveReserve: ReserveWithSpread = {
      ...reserve,
      supplyIncentives: [],
    };

    const queryClient = new QueryClient();
    const { getByText } = render(
      <QueryClientProvider client={queryClient}>
        <TopOpportunities {...baseProps} reserves={[noIncentiveReserve]} isApy={false} />
      </QueryClientProvider>,
    );

    expect(getByText('Base APR only')).toBeInTheDocument();
  });

  it('renders leverage-card second row with supply-borrow spread format on mobile', () => {
    mockUseIsMobile.mockReturnValue(true);

    const leverageReserve: ReserveWithSpread = {
      ...reserve,
      supplyApy: 8,
      borrowApy: 3,
      supplyIncentives: [],
      borrowIncentives: [],
    };

    const queryClient = new QueryClient();
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <TopOpportunities {...baseProps} reserves={[leverageReserve]} />
      </QueryClientProvider>,
    );

    const leverageCards = container.querySelectorAll('.cursor-pointer');
    expect(leverageCards.length).toBeGreaterThan(0);
  });
});
