// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import MobileReserveCard from './MobileReserveCard';
import type { ReserveWithSpread } from '@/types/aave';
import type { RateSimulationResult } from '@/hooks/useRateSimulation';

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => true,
}));

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
  reserveSize: '1000000000000',
  supplyCap: '2000000000000',
  borrowCap: '1000000000000',
  utilizationPct: 45,
  // Rate-model parameters are unified percent numbers (e.g., 80 = 80%); see
  // docs/api/v3-v4-precision-unification-plan.md. Components must NOT apply
  // any RAY/bps divisor when consuming these fields.
  optimalUsageRate: 80,
  variableRateSlope1: 4,
  variableRateSlope2: 60,
  baseVariableBorrowRate: 0,
  reserveFactor: 10,
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
  forecastLoading: false,
  forecastErrors: {},
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

function renderCard(isSimulationExpanded: boolean) {
  const queryClient = new QueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <MobileReserveCard
          reserve={reserve}
          isApy
          tydroPointToUsdRate={0}
          onIncentiveClick={() => {}}
          isSimulationExpanded={isSimulationExpanded}
          onToggleSimulation={() => {}}
          simulation={simulation}
          supplyInput="1000"
          borrowInput="500"
          hasSharedScenario
          inputMode="usd"
        />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe('MobileReserveCard', () => {
  afterEach(() => cleanup());

  it('renders expand details panel label when collapsed', () => {
    const { getByLabelText, getAllByText } = renderCard(false);

    expect(getByLabelText('Expand details panel')).toBeInTheDocument();
    expect(getAllByText(/spread/i).length).toBeGreaterThan(0);
  });

  it('renders collapse details panel label when expanded', () => {
    const { getByLabelText } = renderCard(true);

    expect(getByLabelText('Collapse details panel')).toBeInTheDocument();
  });

  it('renders the mobile hub chip as a single clickable area without a separate external icon', () => {
    const { container, getByLabelText } = render(
      <QueryClientProvider client={new QueryClient()}>
        <TooltipProvider>
          <MobileReserveCard
            reserve={{ ...reserve, hubName: 'Core', hubId: 'hub-core' }}
            isApy
            tydroPointToUsdRate={0}
            onIncentiveClick={() => {}}
            isSimulationExpanded={false}
            onToggleSimulation={() => {}}
            simulation={simulation}
            supplyInput="1000"
            borrowInput="500"
            hasSharedScenario
            inputMode="usd"
          />
        </TooltipProvider>
      </QueryClientProvider>,
    );

    const hubButton = getByLabelText('Filter by Core hub');
    expect(hubButton.className).toContain('px-1.5');
    expect(hubButton.className).not.toContain('group/hub-link');
    expect(hubButton.className).not.toContain('pr-3');
    expect(container.innerHTML).not.toContain('group-hover/hub-link:opacity-100');
  });

  it('renders utilization before the market and hub metadata row', () => {
    const { getByLabelText, getByText } = render(
      <QueryClientProvider client={new QueryClient()}>
        <TooltipProvider>
          <MobileReserveCard
            reserve={{
              ...reserve,
              marketName: 'AaveV3EthereumHorizon',
              chainName: 'Ethereum',
              hubName: 'Prime',
              hubId: 'hub-prime',
            }}
            isApy
            tydroPointToUsdRate={0}
            onIncentiveClick={() => {}}
            isSimulationExpanded={false}
            onToggleSimulation={() => {}}
            simulation={simulation}
            supplyInput="1000"
            borrowInput="500"
            hasSharedScenario
            inputMode="usd"
          />
        </TooltipProvider>
      </QueryClientProvider>,
    );

    const utilizationButton = getByLabelText('Show utilization details');
    const marketLabel = getByText(/Horizon/);
    const hubButton = getByLabelText('Filter by Prime hub');

    expect(utilizationButton.compareDocumentPosition(marketLabel) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    expect(utilizationButton.compareDocumentPosition(hubButton) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    expect(utilizationButton.className).not.toContain('border-border/50');
    expect(utilizationButton.className).not.toContain('bg-muted/35');
  });

  it('treats reserve.optimalUsageRate as a percent number (not RAY) for utilization comparisons', () => {
    // Regression guard for precision-unification: mobile card used to divide
    // optimalUsageRate by 1e25 (RAY → %), which collapses unified percent input
    // (e.g., 80) to ~0 and incorrectly flags normal utilization as above-optimal.
    const reserveAt52PctUtil = {
      ...reserve,
      utilizationPct: 52,
      optimalUsageRate: 80,
    };

    const { getByLabelText, rerender } = render(
      <QueryClientProvider client={new QueryClient()}>
        <TooltipProvider>
          <MobileReserveCard
            reserve={reserveAt52PctUtil}
            isApy
            tydroPointToUsdRate={0}
            onIncentiveClick={() => {}}
            isSimulationExpanded={false}
            onToggleSimulation={() => {}}
            simulation={simulation}
            supplyInput="1000"
            borrowInput="500"
            hasSharedScenario={false}
            inputMode="usd"
          />
        </TooltipProvider>
      </QueryClientProvider>,
    );

    const utilTrigger = getByLabelText('Show utilization details');
    const utilValue = utilTrigger.querySelector('.ds-text-11');
    expect(utilValue).not.toBeNull();
    expect(utilValue.textContent).toContain('52');
    expect(utilValue.className).toContain('text-muted-foreground');
    expect(utilValue.className).not.toContain('text-amber-500');

    // Flip to truly over-optimal utilization and ensure warning color appears.
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <TooltipProvider>
          <MobileReserveCard
            reserve={{ ...reserveAt52PctUtil, utilizationPct: 92 }}
            isApy
            tydroPointToUsdRate={0}
            onIncentiveClick={() => {}}
            isSimulationExpanded={false}
            onToggleSimulation={() => {}}
            simulation={simulation}
            supplyInput="1000"
            borrowInput="500"
            hasSharedScenario={false}
            inputMode="usd"
          />
        </TooltipProvider>
      </QueryClientProvider>,
    );

    const overUtilTrigger = getByLabelText('Show utilization details');
    const overUtilValue = overUtilTrigger.querySelector('.ds-text-11');
    expect(overUtilValue).not.toBeNull();
    expect(overUtilValue?.className).toContain('text-amber-600');
  });

  it('uses tighter spacing for the mobile header left half', () => {
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <TooltipProvider>
          <MobileReserveCard
            reserve={{ ...reserve, marketName: 'AaveV3EthereumHorizon', hubName: 'Prime', hubId: 'hub-prime' }}
            isApy
            tydroPointToUsdRate={0}
            onIncentiveClick={() => {}}
            isSimulationExpanded={false}
            onToggleSimulation={() => {}}
            simulation={simulation}
            supplyInput="1000"
            borrowInput="500"
            hasSharedScenario
            inputMode="usd"
          />
        </TooltipProvider>
      </QueryClientProvider>,
    );

    const html = container.innerHTML;
    expect(html).toContain('width: 28px; height: 28px;');
    expect(html).toContain('flex items-start gap-1 min-w-0 flex-1');
    expect(html).toContain('flex min-w-0 flex-1 items-start gap-0.5');
    expect(html).toContain('mt-0 flex min-w-0 items-center gap-1');
    expect(html).toContain('style="width: 13px; height: 13px;"');
  });

  it('uses a slightly smaller hero APY size on mobile', () => {
    const { getByText } = renderCard(false);

    expect(getByText('2.90%').className).toContain('ds-text-22');
    expect(getByText('2.90%').className).not.toContain('ds-text-24');
  });

  it('reduces the spacing between the tabs row and the hero APY block', () => {
    const { container } = renderCard(false);

    const html = container.innerHTML;
    expect(html).toContain('mx-3 mb-1 flex gap-[var(--ds-space-1)]');
    expect(html).toContain('class="mt-0.5"');
  });

  it('shows a subtle base APY placeholder when there is no visible incentive', () => {
    const noIncentiveSimulation: RateSimulationResult = {
      ...simulation,
      supply: {
        ...simulation.supply,
        currentIncentive: 0,
        afterIncentive: 0,
        currentTotal: 1.45,
        afterTotal: 1.45,
        currentNative: 1.45,
        afterNative: 1.45,
      },
    };

    const { getByText, queryByText } = render(
      <QueryClientProvider client={new QueryClient()}>
        <TooltipProvider>
          <MobileReserveCard
            reserve={reserve}
            isApy
            tydroPointToUsdRate={0}
            onIncentiveClick={() => {}}
            isSimulationExpanded={false}
            onToggleSimulation={() => {}}
            simulation={noIncentiveSimulation}
            supplyInput="1000"
            borrowInput="500"
            hasSharedScenario
            inputMode="usd"
          />
        </TooltipProvider>
      </QueryClientProvider>,
    );

    expect(getByText('Base APY only')).toBeInTheDocument();
    expect(queryByText('+')).not.toBeInTheDocument();
  });

  it('switches the empty-state placeholder to APR wording when the card is in APR mode', () => {
    const noIncentiveSimulation: RateSimulationResult = {
      ...simulation,
      supply: {
        ...simulation.supply,
        currentIncentive: 0,
        afterIncentive: 0,
        currentTotal: 1.45,
        afterTotal: 1.45,
        currentNative: 1.45,
        afterNative: 1.45,
      },
    };

    const { getByText, queryByText } = render(
      <QueryClientProvider client={new QueryClient()}>
        <TooltipProvider>
          <MobileReserveCard
            reserve={reserve}
            isApy={false}
            tydroPointToUsdRate={0}
            onIncentiveClick={() => {}}
            isSimulationExpanded={false}
            onToggleSimulation={() => {}}
            simulation={noIncentiveSimulation}
            supplyInput="1000"
            borrowInput="500"
            hasSharedScenario
            inputMode="usd"
          />
        </TooltipProvider>
      </QueryClientProvider>,
    );

    expect(getByText('Base APR only')).toBeInTheDocument();
    expect(queryByText('Base APY only')).not.toBeInTheDocument();
  });
});
