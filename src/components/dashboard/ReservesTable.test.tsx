// @vitest-environment happy-dom
import { useState, type ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ReservesTable from './ReservesTable';
import type { ReserveWithSpread } from '@/types/aave';
import type { PortfolioSimulationActions } from '@/hooks/usePortfolioSimulation';
import type { PortfolioReserveEntry } from '@/types/portfolio';
import { marketKey } from '@/lib/marketKey';

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

// AAV-1315 M12: the wallet sync pair must survive the ReservesTable hop. The panel
// itself is covered by PortfolioPanel.walletSync.test.tsx; here it is a spy.
vi.mock('./PortfolioPanel', () => ({
  default: (props: {
    walletLoadState?: string;
    failedSources?: string[];
    healthFactors?: Array<{ eModeFallback?: boolean }>;
  }) => (
    <div
      data-testid="portfolio-panel"
      data-wallet-state={props.walletLoadState ?? ''}
      data-failed-sources={(props.failedSources ?? []).join(',')}
      data-emode-fallback={props.healthFactors?.some((h) => h.eModeFallback) ? 'true' : 'false'}
    />
  ),
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
              onSelectMarket?.(marketKey(reserve.chainId, reserve.marketName));
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

const reserveBase: Omit<ReserveWithSpread, 'reserveId' | 'marketName' | 'tokenSymbol' | 'tokenName' | 'tokenAddress'> =
  {
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
  return render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);
}

function MarketFilteredTable() {
  const [selectedMarket, setSelectedMarket] = useState<string | null>(null);
  const filteredReserves = selectedMarket
    ? reserves.filter((reserve) => marketKey(reserve.chainId, reserve.marketName) === selectedMarket)
    : reserves;

  return (
    <>
      <button type="button" onClick={() => setSelectedMarket(null)}>
        clear market filter
      </button>
      <ReservesTable
        reserves={filteredReserves}
        allReserves={reserves}
        sortField={null}
        sortOrder="desc"
        onSort={() => {}}
        isApy
        onSelectMarket={setSelectedMarket}
        tydroPointToUsdRate={0}
        whitelistMerklCampaignIds={new Set<string>()}
        onToggleWhitelistMerklCampaign={() => {}}
      />
    </>
  );
}

afterEach(() => {
  cleanup();
});

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
    renderWithQueryClient(<MarketFilteredTable />);

    fireEvent.click(screen.getByLabelText('Filter by Bluechip market'));

    expect(screen.queryByTestId(`expanded-${reserves[0].reserveId}`)).not.toBeInTheDocument();
    expect(screen.queryByTestId('reserves-expanded-scroll-spacer')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Filter by Bluechip market')).toBeInTheDocument();
    expect(screen.queryByLabelText('Filter by Prime market')).not.toBeInTheDocument();
  });

  it('physically gates expanded-only layout to rows visible in the current dataset', () => {
    const { container } = renderWithQueryClient(<MarketFilteredTable />);

    fireEvent.click(screen.getByText('toggle-USDC'));
    expect(screen.getByTestId(`expanded-${reserves[0].reserveId}`)).toBeInTheDocument();
    expect(screen.getByTestId('reserves-expanded-scroll-spacer')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Filter by Prime market'));
    expect(screen.queryByTestId(`expanded-${reserves[0].reserveId}`)).not.toBeInTheDocument();
    expect(screen.queryByTestId('reserves-expanded-scroll-spacer')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Filter by Prime market')).toBeInTheDocument();

    fireEvent.click(screen.getByText('clear market filter'));
    expect(screen.getByTestId(`expanded-${reserves[0].reserveId}`)).toBeInTheDocument();
    expect(screen.getByTestId('reserves-expanded-scroll-spacer')).toBeInTheDocument();
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
          allReserves={reserves}
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
        allReserves={reserves}
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
        allReserves={reserves}
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

  it('forwards the wallet sync pair to PortfolioPanel in portfolio mode', () => {
    const actions = {
      setActive: vi.fn(),
      addReserve: vi.fn(),
      updateReserve: vi.fn(),
      hideReserve: vi.fn(),
      unhideReserve: vi.fn(),
      importReserves: vi.fn(),
      forceSyncReserves: vi.fn(),
      restoreToWallet: vi.fn(),
      removeWalletEntries: vi.fn(() => 0),
      removeReserve: vi.fn(),
      clearAll: vi.fn(),
      saveSnapshot: vi.fn(),
      deleteSnapshot: vi.fn(),
    } as unknown as PortfolioSimulationActions;

    renderWithQueryClient(
      <ReservesTable
        reserves={reserves}
        allReserves={reserves}
        sortField={null}
        sortOrder="desc"
        onSort={() => {}}
        isApy
        tydroPointToUsdRate={0}
        whitelistMerklCampaignIds={new Set<string>()}
        onToggleWhitelistMerklCampaign={() => {}}
        simulationMode="portfolio"
        portfolioEntries={[]}
        portfolioActions={actions}
        walletLoadState="success"
        failedSources={['onchain-v3-chain-42220', 'sdk-v4']}
      />,
    );

    const panel = screen.getByTestId('portfolio-panel');
    expect(panel.getAttribute('data-wallet-state')).toBe('success');
    expect(panel.getAttribute('data-failed-sources')).toBe('onchain-v3-chain-42220,sdk-v4');
  });
});

describe('ReservesTable — eMode overrides forwarding (AAV-1399)', () => {
  it('keeps eMode fallback state through the ReservesTable hop into PortfolioPanel', () => {
    const pool = '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2';
    const weth = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
    const usdc = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
    const wethId = `1:${pool.toLowerCase()}:${weth.toLowerCase()}`;
    const usdcId = `1:${pool.toLowerCase()}:${usdc.toLowerCase()}`;
    const portfolioReserves: ReserveWithSpread[] = [
      {
        ...reserveBase,
        reserveId: wethId,
        marketName: 'AaveV3Ethereum',
        tokenSymbol: 'WETH',
        tokenName: 'Wrapped Ether',
        tokenAddress: weth,
        ltv: 81,
        liquidationThreshold: 84,
      },
      {
        ...reserveBase,
        reserveId: usdcId,
        marketName: 'AaveV3Ethereum',
        tokenSymbol: 'USDC',
        tokenName: 'USD Coin',
        tokenAddress: usdc,
        ltv: 75,
        liquidationThreshold: 78,
      },
    ];
    const portfolioEntries: PortfolioReserveEntry[] = [
      {
        reserveId: wethId,
        marketName: 'AaveV3Ethereum',
        chainName: 'Ethereum',
        chainId: 1,
        tokenSymbol: 'WETH',
        restrictedStatus: null,
        supply: { amount: '100000', inputMode: 'usd', walletValue: null },
        borrow: { amount: '', inputMode: 'usd', walletValue: null },
        hidden: false,
        isOrphan: false,
      },
      {
        reserveId: usdcId,
        marketName: 'AaveV3Ethereum',
        chainName: 'Ethereum',
        chainId: 1,
        tokenSymbol: 'USDC',
        restrictedStatus: null,
        supply: { amount: '', inputMode: 'usd', walletValue: null },
        borrow: { amount: '100000', inputMode: 'usd', walletValue: null },
        hidden: false,
        isOrphan: false,
      },
    ];
    const actions = {
      setActive: vi.fn(),
      addReserve: vi.fn(),
      updateReserve: vi.fn(),
      hideReserve: vi.fn(),
      unhideReserve: vi.fn(),
      importReserves: vi.fn(),
      forceSyncReserves: vi.fn(),
      restoreToWallet: vi.fn(),
      removeReserve: vi.fn(),
      removeWalletEntries: vi.fn(() => 0),
      clearAll: vi.fn(),
      saveSnapshot: vi.fn(),
      deleteSnapshot: vi.fn(),
    } as unknown as PortfolioSimulationActions;

    renderWithQueryClient(
      <ReservesTable
        reserves={portfolioReserves}
        allReserves={portfolioReserves}
        sortField={null}
        sortOrder="desc"
        onSort={() => {}}
        isApy
        tydroPointToUsdRate={0}
        whitelistMerklCampaignIds={new Set<string>()}
        onToggleWhitelistMerklCampaign={() => {}}
        simulationMode="portfolio"
        portfolioEntries={portfolioEntries}
        portfolioActions={actions}
        eModeOverrides={{
          params: new Map(),
          fallbackPools: new Set(['1:AaveV3Ethereum']),
        }}
      />,
    );

    const panel = screen.getByTestId('portfolio-panel');
    expect(panel.getAttribute('data-emode-fallback')).toBe('true');
  });
});
