// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import ReservesTableMobileGrid from './ReservesTableMobileGrid';
import type { ReserveWithSpread } from '@/types/aave';
import type { RateSimulationResult } from '@/hooks/useRateSimulation';

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => true,
}));

const makeReserve = (symbol: string, id: string): ReserveWithSpread => ({
  reserveId: id,
  marketName: 'AaveV3Ethereum',
  chainName: 'Ethereum',
  chainId: 1,
  tokenName: symbol,
  tokenSymbol: symbol,
  tokenAddress: `0x${id.slice(0, 40).padEnd(40, '0')}`,
  tokenPrice: 1,
  decimals: 6,
  supplied: '1000000000000',
  supplyCap: '2000000000000',
  borrowCap: '1000000000000',
  utilizationPct: 45,
  optimalUtilization: 80,
  slopeBelowOptimal: 4,
  slopeAboveOptimal: 60,
  baseBorrowRate: 0,
  protocolFee: 10,
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
});

const emptySource = { current: 0, after: 0, delta: 0 };

const makeSimulation = (): RateSimulationResult => ({
  tokenPrice: 1,
  tokenPriceLoading: false,
  forecastLoading: false,
  forecastErrors: {},
  forecastUnavailableCampaignCount: 0,
  scenarioUsdAccrual: null,
  supply: {
    currentNative: 2.1, currentIncentive: 0.3, currentTotal: 2.4,
    afterNative: 2.5, afterIncentive: 0.4, afterTotal: 2.9,
    deltaNative: 0.4, deltaIncentive: 0.1, deltaTotal: 0.5,
    inputUsd: 1000, inputAmount: 1000, hasInput: true,
    sources: { protocol: emptySource, merit: emptySource, merkl: emptySource, brevis: emptySource },
  },
  borrow: {
    currentNative: 3.1, currentIncentive: 0.2, currentTotal: 2.9,
    afterNative: 3.4, afterIncentive: 0.1, afterTotal: 3.3,
    deltaNative: 0.3, deltaIncentive: -0.1, deltaTotal: 0.4,
    inputUsd: 500, inputAmount: 500, hasInput: true,
    sources: { protocol: emptySource, merit: emptySource, merkl: emptySource, brevis: emptySource },
  },
  spread: { current: -0.5, after: -0.4, delta: 0.1, usesCurrentSide: null },
  utilization: { current: 45, after: 52, delta: 7, optimal: 80 },
  marketMetrics: {
    availableLiquidityUsd: 550_000, availableLiquidityUsdAfter: 549_000, availableLiquidityUsdDelta: -1_000,
    totalBorrowedUsd: 450_000, totalBorrowedUsdAfter: 452_000, totalBorrowedUsdDelta: 2_000,
    supplyCapUsd: 2_000_000, borrowCapUsd: 1_000_000,
    protocolFee: 0.1, optimalUtilization: 0.8,
    availableSupplyRoomUsd: 999_000, supplyCapExceeded: false, supplyCapExceededByUsd: null,
    availableBorrowRoomUsd: 548_000, borrowCapExceeded: false, borrowCapExceededByUsd: null,
    borrowLimitedByLiquidity: false,
  },
});

const noop = () => {};

function renderGrid(overrides: Partial<Parameters<typeof ReservesTableMobileGrid>[0]> = {}) {
  const reserves = [
    makeReserve('USDC', 'r-usdc'),
    makeReserve('USDT', 'r-usdt'),
    makeReserve('DAI', 'r-dai'),
  ];
  const sim = makeSimulation();
  const simulationsById: Record<string, RateSimulationResult> = {};
  for (const r of reserves) {
    simulationsById[r.reserveId] = sim;
  }

  const props: Parameters<typeof ReservesTableMobileGrid>[0] = {
    displayData: reserves,
    expandedReserveId: null,
    reservesCount: reserves.length,
    isApy: true,
    tydroPointToUsdRate: 0,
    hasSharedScenario: true,
    inputMode: 'usd',
    supplyInput: '1000',
    borrowInput: '500',
    mobileCardDefaultTab: 'supply',
    simulationsById,
    onIncentiveClick: noop,
    onToggleExpand: noop,
    ...overrides,
  };

  return render(
    <QueryClientProvider client={new QueryClient()}>
      <TooltipProvider>
        <ReservesTableMobileGrid {...props} />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe('ReservesTableMobileGrid', () => {
  afterEach(() => cleanup());

  it('renders skeleton grid when isLoading and reservesCount is 0', () => {
    const { container } = renderGrid({ isLoading: true, reservesCount: 0, displayData: [] });
    const skeletons = container.querySelectorAll('[data-testid="skeleton"], .bg-card.rounded-xl');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders skeleton grid when reservesCount > 0 but displayData is empty', () => {
    const { container } = renderGrid({ reservesCount: 3, displayData: [] });
    const skeletons = container.querySelectorAll('.bg-card.rounded-xl');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders MobileReserveCard for each reserve in displayData', () => {
    const { container } = renderGrid();
    const cards = container.querySelectorAll('[data-reserve-id]');
    expect(cards.length).toBe(3);
  });

  it('lays out reserves in two-column grid rows', () => {
    const { container } = renderGrid();
    const rows = container.querySelectorAll('.col-span-2');
    expect(rows.length).toBe(2);
  });

  it('renders odd number of reserves with last row having only one card', () => {
    const reserves = [makeReserve('USDC', 'r-usdc'), makeReserve('USDT', 'r-usdt'), makeReserve('DAI', 'r-dai')];
    const sim = makeSimulation();
    const simulationsById: Record<string, RateSimulationResult> = {};
    for (const r of reserves) simulationsById[r.reserveId] = sim;

    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <TooltipProvider>
          <ReservesTableMobileGrid
            displayData={reserves}
            expandedReserveId={null}
            reservesCount={3}
            isApy
            tydroPointToUsdRate={0}
            hasSharedScenario
            inputMode="usd"
            supplyInput="1000"
            borrowInput="500"
            mobileCardDefaultTab="supply"
            simulationsById={simulationsById}
            onIncentiveClick={noop}
            onToggleExpand={noop}
          />
        </TooltipProvider>
      </QueryClientProvider>,
    );
    const rows = container.querySelectorAll('.col-span-2');
    expect(rows.length).toBe(2);
  });

  it('does not render skeleton when data is loaded', () => {
    const { container } = renderGrid();
    const shimmerElements = container.querySelectorAll('.animate-shimmer');
    expect(shimmerElements.length).toBe(0);
  });

  it('renders expanded reserve shell when expandedReserveId matches a reserve', () => {
    const { container } = renderGrid({ expandedReserveId: 'r-usdc' });
    const expandedShell = container.querySelector('[data-mobile-expanded-shell="true"]');
    expect(expandedShell).not.toBeNull();
  });

  it('does not render expanded shell when expandedReserveId is null', () => {
    const { container } = renderGrid({ expandedReserveId: null });
    const expandedShell = container.querySelector('[data-mobile-expanded-shell="true"]');
    expect(expandedShell).toBeNull();
  });

  it('sets data-reserve-expanded-anchor on the row containing the expanded reserve', () => {
    const { container } = renderGrid({ expandedReserveId: 'r-usdt' });
    const anchorRow = container.querySelector('[data-reserve-expanded-anchor="r-usdt"]');
    expect(anchorRow).not.toBeNull();
  });

  it('renders single reserve without errors', () => {
    const reserve = makeReserve('USDC', 'r-usdc');
    const sim = makeSimulation();
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <TooltipProvider>
          <ReservesTableMobileGrid
            displayData={[reserve]}
            expandedReserveId={null}
            reservesCount={1}
            isApy
            tydroPointToUsdRate={0}
            hasSharedScenario
            inputMode="usd"
            supplyInput="1000"
            borrowInput="500"
            mobileCardDefaultTab="supply"
            simulationsById={{ 'r-usdc': sim }}
            onIncentiveClick={noop}
            onToggleExpand={noop}
          />
        </TooltipProvider>
      </QueryClientProvider>,
    );
    const cards = container.querySelectorAll('[data-reserve-id]');
    expect(cards.length).toBe(1);
  });

  it('renders empty content when displayData is empty and not loading', () => {
    const { container } = renderGrid({ displayData: [], reservesCount: 0 });
    expect(container.innerHTML).toBe('');
  });
});
