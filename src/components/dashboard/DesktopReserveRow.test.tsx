import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Table, TableBody } from '@/components/ui/table';
import DesktopReserveRow from './DesktopReserveRow';
import type { ReserveWithSpread } from '@/types/aave';
import type { RateSimulationResult } from '@/hooks/useRateSimulation';
import type { SortActions } from '@/hooks/reserves-table/buildSortActions';

const stubSortAction = { onSort: () => {}, isActive: false, sortOrder: 'desc' as const };
const stubSortActions: SortActions = {
  supply: stubSortAction,
  borrow: stubSortAction,
  borrowAvailability: stubSortAction,
  supplyAvailability: stubSortAction,
  deficitRatio: stubSortAction,
  deficitAmount: stubSortAction,
  supplyCapPct: stubSortAction,
  borrowCapPct: stubSortAction,
  supplyCapValue: stubSortAction,
  borrowCapValue: stubSortAction,
  availableLiquidity: stubSortAction,
  util: stubSortAction,
  optimal: stubSortAction,
};

const reserve: ReserveWithSpread = {
  reserveId: 'AaveV3Ethereum-0x0000000000000000000000000000000000000001',
  marketName: 'AaveV3Ethereum',
  chainName: 'Ethereum',
  chainId: 1,
  tokenName: 'USD Coin',
  tokenSymbol: 'USDC',
  tokenAddress: '0x0000000000000000000000000000000000000001',
  tokenPrice: 1,
  decimals: 6,
  supplied: '1000000000000',
  supplyCap: '2000000000000',
  borrowCap: '1000000000000',
  utilizationPct: 45,
  supplyApy: 4.2,
  borrowApy: 6.1,
  // Rate-model parameters are unified percent numbers (e.g., 80 = 80%); see
  // docs/api/v3-v4-precision-unification-plan.md. Components must NOT apply
  // any RAY/bps divisor when consuming these fields.
  optimalUtilization: 80,
  slopeBelowOptimal: 4,
  slopeAboveOptimal: 60,
  baseBorrowRate: 0,
  protocolFee: 10,
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

const emptySource = {
  current: 0,
  after: 0,
  delta: 0,
};

const simulation: RateSimulationResult = {
  tokenPrice: 1,
  tokenPriceLoading: false,
  forecastLoading: false,
  forecastErrors: {},
  forecastUnavailableCampaignCount: 0,
  forecastUnavailableCampaignIds: [],
  scenarioUsdAccrual: null,
  supply: {
    currentNative: 2.1,
    currentIncentive: 0.3,
    currentTotal: 2.4,
    afterNative: 2.5,
    afterIncentive: 0.4,
    afterTotal: 2.9,
    deltaNative: 0.4,
    deltaIncentive: 0.1,
    deltaTotal: 0.5,
    inputUsd: 1000,
    inputAmount: 1000,
    hasInput: true,
    sources: {
      protocol: emptySource,
      merit: emptySource,
      merkl: emptySource,
      brevis: emptySource,
    },
  },
  borrow: {
    currentNative: 3.1,
    currentIncentive: 0.2,
    currentTotal: 2.9,
    afterNative: 3.4,
    afterIncentive: 0.1,
    afterTotal: 3.3,
    deltaNative: 0.3,
    deltaIncentive: -0.1,
    deltaTotal: 0.4,
    inputUsd: 500,
    inputAmount: 500,
    hasInput: true,
    sources: {
      protocol: emptySource,
      merit: emptySource,
      merkl: emptySource,
      brevis: emptySource,
    },
  },
  spread: {
    current: -0.5,
    after: -0.4,
    delta: 0.1,
    usesCurrentSide: null,
  },
  utilization: {
    current: 45,
    after: 52,
    delta: 7,
    optimal: 80,
  },
  marketMetrics: {
    availableLiquidityUsd: 550_000,
    availableLiquidityUsdAfter: 549_000,
    availableLiquidityUsdDelta: -1_000,
    totalBorrowedUsd: 450_000,
    totalBorrowedUsdAfter: 452_000,
    totalBorrowedUsdDelta: 2_000,
    supplyCapUsd: 2_000_000,
    borrowCapUsd: 1_000_000,
    protocolFee: 0.1,
    optimalUtilization: 0.8,
    availableSupplyRoomUsd: 999_000,
    supplyCapExceeded: false,
    supplyCapExceededByUsd: null,
    availableBorrowRoomUsd: 548_000,
    borrowCapExceeded: false,
    borrowCapExceededByUsd: null,
    borrowLimitedByLiquidity: false,
  },
};

describe('DesktopReserveRow', () => {
  it('renders expanded row without throwing', () => {
    const queryClient = new QueryClient();
    const html = renderToString(
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Table>
            <TableBody>
              <DesktopReserveRow
                reserve={reserve}
                reserveId="AaveV3Ethereum-0x0000000000000000000000000000000000000001"
                isExpanded
                onToggleExpand={() => {}}
                onIncentiveClick={() => {}}
                displaySupplyTotal={2.9}
                displaySupplyNative={2.5}
                displaySupplyIncentive={0.4}
                displayBorrowTotal={3.3}
                displayBorrowNative={3.4}
                displayBorrowIncentive={0.1}
                displayUtilization={52}
                spread={-0.4}
                simulation={simulation}
                supplyInput="1000"
                borrowInput="500"
                inputMode="usd"
                isApy
                isMobile={false}
                sortActions={stubSortActions}
              />
            </TableBody>
          </Table>
        </TooltipProvider>
      </QueryClientProvider>,
    );

    expect(html).toContain('bg-card');
  });

  it('paused row has bg-card opaque base + ds-bg-paused tint overlay', () => {
    const queryClient = new QueryClient();
    const html = renderToString(
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Table>
            <TableBody>
              <DesktopReserveRow
                reserve={{ ...reserve, isPaused: true }}
                reserveId="AaveV3Ethereum-0x0000000000000000000000000000000000000001"
                isExpanded={false}
                onToggleExpand={() => {}}
                onIncentiveClick={() => {}}
                displaySupplyTotal={2.9}
                displaySupplyNative={2.5}
                displaySupplyIncentive={0.4}
                displayBorrowTotal={3.3}
                displayBorrowNative={3.4}
                displayBorrowIncentive={0.1}
                displayUtilization={52}
                spread={-0.4}
                simulation={simulation}
                supplyInput="1000"
                borrowInput="500"
                inputMode="usd"
                isApy
                isMobile={false}
                sortActions={stubSortActions}
              />
            </TableBody>
          </Table>
        </TooltipProvider>
      </QueryClientProvider>,
    );

    expect(html).toContain('bg-card');
    expect(html).toContain('ds-bg-paused');
  });

  it('expanded frozen row applies bg-card to all td cells', () => {
    const queryClient = new QueryClient();
    const html = renderToString(
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Table>
            <TableBody>
              <DesktopReserveRow
                reserve={{ ...reserve, isFrozen: true }}
                reserveId="AaveV3Ethereum-0x0000000000000000000000000000000000000001"
                isExpanded
                onToggleExpand={() => {}}
                onIncentiveClick={() => {}}
                displaySupplyTotal={2.9}
                displaySupplyNative={2.5}
                displaySupplyIncentive={0.4}
                displayBorrowTotal={3.3}
                displayBorrowNative={3.4}
                displayBorrowIncentive={0.1}
                displayUtilization={52}
                spread={-0.4}
                simulation={simulation}
                supplyInput="1000"
                borrowInput="500"
                inputMode="usd"
                isApy
                isMobile={false}
                sortActions={stubSortActions}
              />
            </TableBody>
          </Table>
        </TooltipProvider>
      </QueryClientProvider>,
    );

    expect(html).toContain('[&amp;_td]:bg-card');
    expect(html).toContain('ds-bg-sky-500-8');
  });

  it('inactive row (isActive === false) has ds-bg-paused background', () => {
    const queryClient = new QueryClient();
    const html = renderToString(
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Table>
            <TableBody>
              <DesktopReserveRow
                reserve={{ ...reserve, isActive: false }}
                reserveId="AaveV3Ethereum-0x0000000000000000000000000000000000000001"
                isExpanded={false}
                onToggleExpand={() => {}}
                onIncentiveClick={() => {}}
                displaySupplyTotal={2.9}
                displaySupplyNative={2.5}
                displaySupplyIncentive={0.4}
                displayBorrowTotal={3.3}
                displayBorrowNative={3.4}
                displayBorrowIncentive={0.1}
                displayUtilization={52}
                spread={-0.4}
                simulation={simulation}
                supplyInput="1000"
                borrowInput="500"
                inputMode="usd"
                isApy
                isMobile={false}
                sortActions={stubSortActions}
              />
            </TableBody>
          </Table>
        </TooltipProvider>
      </QueryClientProvider>,
    );

    expect(html).toContain('ds-bg-paused');
  });

  it('expanded inactive row applies ds-bg-paused to all td cells', () => {
    const queryClient = new QueryClient();
    const html = renderToString(
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Table>
            <TableBody>
              <DesktopReserveRow
                reserve={{ ...reserve, isActive: false }}
                reserveId="AaveV3Ethereum-0x0000000000000000000000000000000000000001"
                isExpanded
                onToggleExpand={() => {}}
                onIncentiveClick={() => {}}
                displaySupplyTotal={2.9}
                displaySupplyNative={2.5}
                displaySupplyIncentive={0.4}
                displayBorrowTotal={3.3}
                displayBorrowNative={3.4}
                displayBorrowIncentive={0.1}
                displayUtilization={52}
                spread={-0.4}
                simulation={simulation}
                supplyInput="1000"
                borrowInput="500"
                inputMode="usd"
                isApy
                isMobile={false}
                sortActions={stubSortActions}
              />
            </TableBody>
          </Table>
        </TooltipProvider>
      </QueryClientProvider>,
    );

    expect(html).toContain('[&amp;_td]:ds-bg-paused');
  });

  it('calls onSelectHub with hubId (not hubName) when hub badge is clicked', () => {
    const onSelectHub = vi.fn();
    const html = renderToString(
      <QueryClientProvider client={new QueryClient()}>
        <TooltipProvider>
          <Table>
            <TableBody>
              <DesktopReserveRow
                reserve={{ ...reserve, hubName: 'Core', hubId: 'hub-core' }}
                reserveId="AaveV3Ethereum-0x0000000000000000000000000000000000000001"
                isExpanded={false}
                onToggleExpand={() => {}}
                onSelectHub={onSelectHub}
                onIncentiveClick={() => {}}
                displaySupplyTotal={2.9}
                displaySupplyNative={2.5}
                displaySupplyIncentive={0.4}
                displayBorrowTotal={3.3}
                displayBorrowNative={3.4}
                displayBorrowIncentive={0.1}
                displayUtilization={52}
                spread={-0.4}
                simulation={simulation}
                supplyInput="1000"
                borrowInput="500"
                inputMode="usd"
                isApy
                isMobile={false}
                sortActions={stubSortActions}
              />
            </TableBody>
          </Table>
        </TooltipProvider>
      </QueryClientProvider>,
    );
    expect(html).toContain('Filter by Core hub');
    expect(html).toContain('hub-core');
  });

  describe('field-name regression gates', () => {
    it('renders supply size from reserve.supplied, not a non-existent field', () => {
      const html = renderToString(
        <QueryClientProvider client={new QueryClient()}>
          <TooltipProvider>
            <Table>
              <TableBody>
                <DesktopReserveRow
                  reserve={reserve}
                  reserveId="AaveV3Ethereum-0x0000000000000000000000000000000000000001"
                  isExpanded={false}
                  onToggleExpand={() => {}}
                  onIncentiveClick={() => {}}
                  displaySupplyTotal={2.9}
                  displaySupplyNative={2.5}
                  displaySupplyIncentive={0.4}
                  displayBorrowTotal={3.3}
                  displayBorrowNative={3.4}
                  displayBorrowIncentive={0.1}
                  displayUtilization={52}
                  spread={-0.4}
                  simulation={simulation}
                  supplyInput="1000"
                  borrowInput="500"
                  inputMode="usd"
                  isApy
                  isMobile={false}
                  sortActions={stubSortActions}
                />
              </TableBody>
            </Table>
          </TooltipProvider>
        </QueryClientProvider>,
      );
      expect(html).toContain('$1.00M');
    });

    it('renders utilization bar with optimalUtilization from reserve', () => {
      const html = renderToString(
        <QueryClientProvider client={new QueryClient()}>
          <TooltipProvider>
            <Table>
              <TableBody>
                <DesktopReserveRow
                  reserve={reserve}
                  reserveId="AaveV3Ethereum-0x0000000000000000000000000000000000000001"
                  isExpanded={false}
                  onToggleExpand={() => {}}
                  onIncentiveClick={() => {}}
                  displaySupplyTotal={2.9}
                  displaySupplyNative={2.5}
                  displaySupplyIncentive={0.4}
                  displayBorrowTotal={3.3}
                  displayBorrowNative={3.4}
                  displayBorrowIncentive={0.1}
                  displayUtilization={52}
                  spread={-0.4}
                  simulation={simulation}
                  supplyInput="1000"
                  borrowInput="500"
                  inputMode="usd"
                  isApy
                  isMobile={false}
                  sortActions={stubSortActions}
                />
              </TableBody>
            </Table>
          </TooltipProvider>
        </QueryClientProvider>,
      );
      expect(html).toContain('52.00%');
      expect(html).toContain('viewBox="0 0 10 24"');
    });

    it('renders non-empty borrow size derived from reserve fields', () => {
      const html = renderToString(
        <QueryClientProvider client={new QueryClient()}>
          <TooltipProvider>
            <Table>
              <TableBody>
                <DesktopReserveRow
                  reserve={reserve}
                  reserveId="AaveV3Ethereum-0x0000000000000000000000000000000000000001"
                  isExpanded={false}
                  onToggleExpand={() => {}}
                  onIncentiveClick={() => {}}
                  displaySupplyTotal={2.9}
                  displaySupplyNative={2.5}
                  displaySupplyIncentive={0.4}
                  displayBorrowTotal={3.3}
                  displayBorrowNative={3.4}
                  displayBorrowIncentive={0.1}
                  displayUtilization={52}
                  spread={-0.4}
                  simulation={simulation}
                  supplyInput="1000"
                  borrowInput="500"
                  inputMode="usd"
                  isApy
                  isMobile={false}
                  sortActions={stubSortActions}
                />
              </TableBody>
            </Table>
          </TooltipProvider>
        </QueryClientProvider>,
      );
      expect(html).toContain('2.50%');
      expect(html).toContain('0.40%');
      expect(html).toContain('3.40%');
      expect(html).toContain('0.10%');
      expect(html).toContain('-0.40%');
    });
  });
});
