// @vitest-environment happy-dom
import { useState, type ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ReservesTable from './ReservesTable';
import type { ReserveWithSpread } from '@/types/aave';

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}));

vi.mock('@/hooks/useSideDataMeta', () => ({
  useSideDataMeta: () => ({ data: undefined }),
}));

vi.mock('@/hooks/useRateSimulation', () => ({
  getReserveSimulationId: (reserve: Pick<ReserveWithSpread, 'reserveId'>) => reserve.reserveId,
  useSharedRateSimulations: () => ({
    simulationsById: {},
    hasAnyInput: false,
  }),
}));

vi.mock('@/lib/scrollExpandedSimulationIntoView', () => ({
  scrollExpandedSimulationIntoView: vi.fn(),
  shouldScrollExpandedSimulationIntoView: () => false,
}));

vi.mock('./ScenarioControls', () => ({
  default: () => <div data-testid="scenario-controls" />,
}));

vi.mock('./ReservesTableDesktopHeader', () => ({
  default: () => (
    <thead data-reserves-sticky-thead>
      <tr>
        <th>Token</th>
      </tr>
    </thead>
  ),
}));

vi.mock('./ReservesTableMobileGrid', () => ({
  default: () => null,
}));

vi.mock('./ReservesTableMobileSortBar', () => ({
  default: () => null,
}));

vi.mock('./ReservesTableDesktopSkeleton', () => ({
  default: () => null,
}));

vi.mock('./ReservesTableTooltipOverlay', () => ({
  default: () => null,
}));

vi.mock('./PortfolioModeToggle', () => ({
  default: () => null,
}));

vi.mock('./ReservesTablePagination', () => ({
  ReservesTableShowMore: () => null,
  ReservesTableFloatingScroll: () => null,
}));

vi.mock('./DesktopReserveRow', () => ({
  default: ({
    reserve,
    reserveId,
    isExpanded,
    onToggleExpand,
    onMarketChipClick,
    onSelectMarket,
  }: {
    reserve: ReserveWithSpread;
    reserveId: string;
    isExpanded: boolean;
    onToggleExpand: (reserveId: string) => void;
    onMarketChipClick?: (reserveId: string) => void;
    onSelectMarket?: (marketName: string) => void;
  }) => (
    <>
      <tr data-reserve-id={reserveId}>
        <td>
          <button type="button" onClick={() => onToggleExpand(reserveId)}>
            toggle-{reserve.tokenSymbol}
          </button>
          <button
            type="button"
            aria-label={`Filter by ${reserve.marketName} market`}
            onClick={(event) => {
              event.stopPropagation();
              onMarketChipClick?.(reserveId);
              onSelectMarket?.(reserve.marketName);
            }}
          >
            filter-{reserve.marketName}
          </button>
        </td>
      </tr>
      {isExpanded ? (
        <tr data-testid={`expanded-${reserveId}`}>
          <td>expanded-{reserve.tokenSymbol}</td>
        </tr>
      ) : null}
    </>
  ),
}));

const reserveBase: Omit<ReserveWithSpread, 'reserveId' | 'marketName' | 'tokenSymbol' | 'tokenName' | 'tokenAddress'> = {
  chainName: 'Ethereum',
  chainId: 1,
  tokenPrice: 1,
  decimals: 6,
  supplied: '1000000000000',
  supplyCap: '2000000000000',
  borrowCap: '1000000000000',
  utilizationPct: 45,
  supplyApy: 4.2,
  borrowApy: 6.1,
  supplyDisabled: false,
  borrowDisabled: false,
  supplyIncentives: [],
  borrowIncentives: [],
  meritSupplys: [],
  meritBorrows: [],
  merklSupplys: [],
  merklBorrows: [],
  brevisSupplys: [],
  brevisBorrows: [],
};

const reserves: ReserveWithSpread[] = [
  {
    ...reserveBase,
    reserveId: 'AaveV4Bluechip:1:0x0000000000000000000000000000000000000001:Core',
    marketName: 'Bluechip',
    tokenName: 'USD Coin',
    tokenSymbol: 'USDC',
    tokenAddress: '0x0000000000000000000000000000000000000001',
  },
  {
    ...reserveBase,
    reserveId: 'AaveV3Prime:1:0x0000000000000000000000000000000000000002:Core',
    marketName: 'Prime',
    tokenName: 'Tether USD',
    tokenSymbol: 'USDT',
    tokenAddress: '0x0000000000000000000000000000000000000002',
  },
];

function renderWithQueryClient(ui: ReactNode) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      {ui}
    </QueryClientProvider>,
  );
}

function MarketFilteredTable() {
  const [selectedMarket, setSelectedMarket] = useState<string | null>(null);
  const filteredReserves = selectedMarket
    ? reserves.filter((reserve) => reserve.marketName === selectedMarket)
    : reserves;

  return (
    <ReservesTable
      reserves={filteredReserves}
      sortField={null}
      sortOrder="desc"
      onSort={() => {}}
      isApy
      onSelectMarket={setSelectedMarket}
      tydroPointToUsdRate={0}
      whitelistMerklCampaignIds={new Set<string>()}
      onToggleWhitelistMerklCampaign={() => {}}
    />
  );
}

describe('ReservesTable market chip filtering', () => {
  beforeEach(() => {
    class MockIntersectionObserver {
      observe() {}
      disconnect() {}
      unobserve() {}
    }

    class MockResizeObserver {
      observe() {}
      disconnect() {}
      unobserve() {}
    }

    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
    vi.stubGlobal('ResizeObserver', MockResizeObserver);
  });

  it('filters by market without expanding a collapsed row or rendering the desktop spacer', () => {
    const { container } = renderWithQueryClient(<MarketFilteredTable />);

    fireEvent.click(screen.getByLabelText('Filter by Bluechip market'));

    expect(screen.queryByTestId(`expanded-${reserves[0].reserveId}`)).not.toBeInTheDocument();
    expect(container.innerHTML).not.toContain('100dvh');
    expect(screen.getByLabelText('Filter by Bluechip market')).toBeInTheDocument();
    expect(screen.queryByLabelText('Filter by Prime market')).not.toBeInTheDocument();
  });
});

describe('ReservesTable mobile bottom spacing', () => {
  const MAX_MOBILE_BOTTOM_PB_REM = 1;

  beforeEach(() => {
    vi.resetModules();
  });

  it('does not exceed the compact bottom-padding limit on mobile', async () => {
    vi.doMock('@/hooks/use-mobile', () => ({
      useIsMobile: () => true,
    }));

    vi.doMock('@/hooks/useSideDataMeta', () => ({
      useSideDataMeta: () => ({ data: undefined }),
    }));

    vi.doMock('@/hooks/useRateSimulation', () => ({
      getReserveSimulationId: (reserve: Pick<ReserveWithSpread, 'reserveId'>) => reserve.reserveId,
      useSharedRateSimulations: () => ({
        simulationsById: {},
        hasAnyInput: false,
      }),
    }));

    vi.doMock('@/lib/scrollExpandedSimulationIntoView', () => ({
      scrollExpandedSimulationIntoView: vi.fn(),
      shouldScrollExpandedSimulationIntoView: () => false,
    }));

    vi.doMock('./ScenarioControls', () => ({
      default: () => <div data-testid="scenario-controls" />,
    }));

    vi.doMock('./ReservesTableMobileGrid', () => ({
      default: () => null,
    }));

    vi.doMock('./ReservesTableMobileSortBar', () => ({
      default: () => null,
    }));

    vi.doMock('./ReservesTableDesktopSkeleton', () => ({
      default: () => null,
    }));

    vi.doMock('./ReservesTableTooltipOverlay', () => ({
      default: () => null,
    }));

    vi.doMock('./PortfolioModeToggle', () => ({
      default: () => null,
    }));

    vi.doMock('./ReservesTablePagination', () => ({
      ReservesTableShowMore: () => null,
      ReservesTableFloatingScroll: () => null,
    }));

    const MobileReservesTable = (await import('./ReservesTable')).default;

    class MockIntersectionObserver {
      observe() {}
      disconnect() {}
      unobserve() {}
    }

    class MockResizeObserver {
      observe() {}
      disconnect() {}
      unobserve() {}
    }

    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
    vi.stubGlobal('ResizeObserver', MockResizeObserver);

    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <MobileReservesTable
          reserves={reserves}
          sortField={null}
          sortOrder="desc"
          onSort={() => {}}
          isApy
          tydroPointToUsdRate={0}
          whitelistMerklCampaignIds={new Set<string>()}
          onToggleWhitelistMerklCampaign={() => {}}
        />
      </QueryClientProvider>,
    );

    const mobileRoot = container.querySelector('[class*="pb-[calc"]');
    expect(mobileRoot).toBeInTheDocument();

    const className = mobileRoot?.getAttribute('class') ?? '';
    expect(className).not.toMatch(/pb-\[calc\(env\(safe-area-inset-bottom,0px\)\+[4-9]rem\)\]/);
    expect(className).toMatch(/pb-\[calc\(env\(safe-area-inset-bottom,0px\)\+[0-2]rem\)\]/);
  });
});

describe('ReservesTable expand/collapse interaction', () => {
  beforeEach(() => {
    class MockIntersectionObserver {
      observe() {}
      disconnect() {}
      unobserve() {}
    }

    class MockResizeObserver {
      observe() {}
      disconnect() {}
      unobserve() {}
    }

    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
    vi.stubGlobal('ResizeObserver', MockResizeObserver);
  });

  it('toggles simulation panel on row click', () => {
    renderWithQueryClient(
      <ReservesTable
        reserves={reserves}
        sortField={null}
        sortOrder="desc"
        onSort={() => {}}
        isApy
        tydroPointToUsdRate={0}
        whitelistMerklCampaignIds={new Set<string>()}
        onToggleWhitelistMerklCampaign={() => {}}
      />,
    );
    const toggleButtons = screen.getAllByText('toggle-USDC');
    expect(screen.queryByTestId(`expanded-${reserves[0].reserveId}`)).not.toBeInTheDocument();
    fireEvent.click(toggleButtons[0]);
    expect(screen.getByTestId(`expanded-${reserves[0].reserveId}`)).toBeInTheDocument();
    fireEvent.click(toggleButtons[0]);
    expect(screen.queryByTestId(`expanded-${reserves[0].reserveId}`)).not.toBeInTheDocument();
  });

  it('expands a different row when clicking its toggle', () => {
    renderWithQueryClient(
      <ReservesTable
        reserves={reserves}
        sortField={null}
        sortOrder="desc"
        onSort={() => {}}
        isApy
        tydroPointToUsdRate={0}
        whitelistMerklCampaignIds={new Set<string>()}
        onToggleWhitelistMerklCampaign={() => {}}
      />,
    );
    const usdcButtons = screen.getAllByText('toggle-USDC');
    const usdtButtons = screen.getAllByText('toggle-USDT');
    fireEvent.click(usdcButtons[0]);
    expect(screen.getByTestId(`expanded-${reserves[0].reserveId}`)).toBeInTheDocument();
    fireEvent.click(usdtButtons[0]);
    expect(screen.getByTestId(`expanded-${reserves[1].reserveId}`)).toBeInTheDocument();
  });
});
