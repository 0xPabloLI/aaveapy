import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Table, TableBody } from '@/components/ui/table';
import DesktopReserveRow from './DesktopReserveRow';
import type { ReserveWithSpread } from '@/types/aave';
import type { RateSimulationResult } from '@/hooks/useRateSimulation';

const reserve: ReserveWithSpread = {
  marketName: 'AaveV3Ethereum',
  chainName: 'Ethereum',
  chainId: 1,
  tokenName: 'USD Coin',
  tokenSymbol: 'USDC',
  tokenAddress: '0x0000000000000000000000000000000000000001',
  tokenPrice: 1,
  reserveSizeUsd: 1_000_000,
  supplyCapUsd: 2_000_000,
  borrowCapUsd: 1_000_000,
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

const emptySource = {
  current: 0,
  after: 0,
  delta: 0,
};

const simulation: RateSimulationResult = {
  tokenPrice: 1,
  tokenPriceLoading: false,
  reserveRateInputLoading: false,
  reserveRateInputError: null,
  forecastLoading: false,
  forecastErrors: {},
  hasRateInput: true,
  forecastUnavailableCampaignCount: 0,
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
    reserveFactor: 0.1,
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

    expect(() => renderToString(
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
              />
            </TableBody>
          </Table>
        </TooltipProvider>
      </QueryClientProvider>
    )).not.toThrow();
  });
});
