import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReserveWithSpread } from '@/types/aave';
import TopOpportunities from './TopOpportunities';

const mockUseIsMobile = vi.fn();

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => mockUseIsMobile(),
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
  marketName: 'AaveV3Ethereum',
  chainName: 'Ethereum',
  chainId: 1,
  tokenName: 'Gho Token',
  tokenSymbol: 'GHO',
  tokenAddress: '0x0000000000000000000000000000000000000001',
  tokenPrice: 1,
  reserveSizeUsd: 1_000_000,
  supplyCapUsd: 2_000_000,
  borrowCapUsd: 1_000_000,
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
  });

  const renderComponent = () => {
    const queryClient = new QueryClient();
    return renderToString(
      <QueryClientProvider client={queryClient}>
        <TopOpportunities {...baseProps} />
      </QueryClientProvider>,
    );
  };

  it('renders mobile cards without desktop external-link row layout when useIsMobile is true', () => {
    mockUseIsMobile.mockReturnValue(true);

    const html = renderComponent();

    expect(html).not.toContain('Open GHO on Aave');
    expect(html).toContain('GHO');
  });

  it('preserves APY total inside category cards when isApy is true', () => {
    mockUseIsMobile.mockReturnValue(false);

    const html = renderComponent();

    expect(html).toContain('11.30%');
    expect(html).not.toContain('11.00%');
  });
});
