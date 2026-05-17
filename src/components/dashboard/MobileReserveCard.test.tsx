// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import MobileReserveCard from './MobileReserveCard';
import { formatPercent, formatUsd } from '@/lib/formatters';
import { nativeToUsd } from '@/lib/scenarioSize';
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
  supplied: '1000000000000',
  supplyCap: '2000000000000',
  borrowCap: '1000000000000',
  utilizationPct: 45,
  // Rate-model parameters are unified percent numbers (e.g., 80 = 80%); see
  // docs/api/v3-v4-precision-unification-plan.md. Components must NOT apply
  // any RAY/bps divisor when consuming these fields.
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
    expect(getAllByText(/liquidity/i).length).toBeGreaterThan(0);
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

  it('renders utilization button in token header with correct styles', () => {
    const { getByLabelText } = render(
      <QueryClientProvider client={new QueryClient()}>
        <TooltipProvider>
          <MobileReserveCard
            reserve={reserve}
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
    expect(utilizationButton.className).toContain('rounded-md');
    expect(utilizationButton.className).toContain('-translate-y-px');
    expect(utilizationButton.textContent).toContain('%');
  });

  it('treats reserve.optimalUtilization as a percent number (not RAY) for utilization comparisons', () => {
    // Regression guard for precision-unification: mobile card used to divide
    // optimalUtilization by 1e25 (RAY → %), which collapses unified percent input
    // (e.g., 80) to ~0 and incorrectly flags normal utilization as above-optimal.
    const reserveAt52PctUtil = {
      ...reserve,
      utilizationPct: 52,
      optimalUtilization: 80,
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
    expect(utilValue.className).toContain('text-foreground');
    expect(utilValue.className).not.toContain('text-amber-600');

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
    expect(html).toContain('class="relative mt-0.5"');
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

    // Base placeholder must use ds-text-11 (same as incentive values like "0.05% + 3.66%") for horizontal alignment
    const placeholderEl = getByText('Base APY only');
    expect(placeholderEl).toHaveClass('ds-text-11');
    expect(placeholderEl).not.toHaveClass('ds-text-10');
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

  it('displays token price using formatUsd (same as desktop)', () => {
    const expectedPrice = formatUsd(reserve.tokenPrice);

    const { container } = renderCard(false);

    const html = container.innerHTML;
    expect(html).toContain(expectedPrice);
    expect(html).not.toMatch(/\$\d+\.\d+e[+-]/);
  });

  it('uses solid background (not gradient) for active incentive badge, matching desktop style', () => {
    const { container } = renderCard(false);

    const html = container.innerHTML;
    expect(html).toContain('ds-bg-emerald-500-10');
    expect(html).toContain('ds-ring-emerald-500-15');
    expect(html).not.toContain('bg-gradient-to-r');
  });

  it('formats utilization rate as integer percentage (no decimal places)', () => {
    const { getByLabelText } = renderCard(false);

    const utilButton = getByLabelText('Show utilization details');
    const utilText = utilButton.querySelector('.ds-text-11');
    expect(utilText).not.toBeNull();
    expect(utilText!.textContent!.trim()).toBe('52%');
  });

  it('renders DeficitLiquidityRing (SVG ring, not button with text) when supply deficit exists', () => {
    const deficitReserve: ReserveWithSpread = {
      ...reserve,
      deficit: '51198023044',
    };

    const { getByLabelText } = render(
      <QueryClientProvider client={new QueryClient()}>
        <TooltipProvider>
          <MobileReserveCard
            reserve={deficitReserve}
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

    const deficitTrigger = getByLabelText(`Deficit details for ${deficitReserve.tokenSymbol}`);
    expect(deficitTrigger.querySelector('svg')).not.toBeNull();
    expect(deficitTrigger.tagName).toBe('DIV');
    expect(deficitTrigger.getAttribute('role')).toBe('button');
  });

  it('prevents button+text pattern in deficit area (no raw USD text)', () => {
    const deficitReserve: ReserveWithSpread = {
      ...reserve,
      deficit: '51198023044',
    };

    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <TooltipProvider>
          <MobileReserveCard
            reserve={deficitReserve}
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

    // The deficit area (absolute positioned) should NOT contain a <button> with formatted USD
    // (the old button+text pattern was: <button><ShieldIcon/><span>$1.00M</span></button>)
    const deficitAreaButtons = container.querySelectorAll('.absolute.-top-1\\.5.right-4 button');
    expect(deficitAreaButtons.length).toBe(0);
  });

  it('renders frozen badge with snowflake icon and sky-500 background', () => {
    const { getByTestId } = render(
      <QueryClientProvider client={new QueryClient()}>
        <TooltipProvider>
          <MobileReserveCard
            reserve={{ ...reserve, isFrozen: true }}
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

    const badge = getByTestId('mobile-reserve-status-badge');
    expect(badge.getAttribute('data-status')).toBe('frozen');
    expect(badge.getAttribute('aria-label')).toBe('Show frozen details');

    const circle = badge.querySelector('span.rounded-full');
    expect(circle).not.toBeNull();
    expect(circle!.className).toContain('bg-sky-500');
    expect(circle!.className).not.toContain('ds-paused');
    expect(badge.querySelectorAll('svg').length).toBe(1);
  });

  it('renders paused badge with PauseCircle icon and paused background', () => {
    const { getByTestId } = render(
      <QueryClientProvider client={new QueryClient()}>
        <TooltipProvider>
          <MobileReserveCard
            reserve={{ ...reserve, isPaused: true }}
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

    const badge = getByTestId('mobile-reserve-status-badge');
    expect(badge.getAttribute('data-status')).toBe('paused');
    expect(badge.getAttribute('aria-label')).toBe('Show paused details');

    const circle = badge.querySelector('span.rounded-full');
    expect(circle).not.toBeNull();
    expect(circle!.className).toContain('ds-paused');
    expect(circle!.className).not.toContain('bg-sky-500');
    expect(badge.querySelectorAll('svg').length).toBe(1);
  });

  it('renders both frozen and paused icons side-by-side when both flags are active', () => {
    const { getByTestId } = render(
      <QueryClientProvider client={new QueryClient()}>
        <TooltipProvider>
          <MobileReserveCard
            reserve={{ ...reserve, isFrozen: true, isPaused: true }}
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

    const badge = getByTestId('mobile-reserve-status-badge');
    expect(badge.getAttribute('data-status')).toBe('paused-frozen');
    expect(badge.getAttribute('aria-label')).toBe('Show paused & frozen details');

    const circles = badge.querySelectorAll(':scope > span > span.rounded-full');
    expect(circles.length).toBe(2);

    const [frozenCircle, pausedCircle] = circles;
    expect(frozenCircle.className).toContain('bg-sky-500');
    expect(pausedCircle.className).toContain('ds-paused');

    expect(badge.querySelectorAll('svg').length).toBe(2);

    const style = badge.getAttribute('style');
    expect(style).toContain('2rem');
  });

  it('renders inactive badge (isActive === false) with Ban icon and amber background', () => {
    const inactiveReserve = { ...reserve, isActive: false as const };

    const { getByTestId } = render(
      <QueryClientProvider client={new QueryClient()}>
        <TooltipProvider>
          <MobileReserveCard
            reserve={inactiveReserve}
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

    const badge = getByTestId('mobile-reserve-status-badge');
    expect(badge.getAttribute('data-status')).toBe('inactive');
    expect(badge.getAttribute('aria-label')).toBe('Show inactive details');

    const circle = badge.querySelector('span.rounded-full');
    expect(circle).not.toBeNull();
    expect(circle!.className).toContain('ds-paused');

    const banIcon = badge.querySelector('svg');
    expect(banIcon).toBeTruthy();
  });

  it('does not render frozen/paused badge when neither flag is set', () => {
    const { queryByTestId } = renderCard(false);

    expect(queryByTestId('mobile-reserve-status-badge')).toBeNull();
  });

  it('shows only one ExternalLink in deficit popup (not duplicated in % row)', () => {
    const deficitReserve: ReserveWithSpread = {
      ...reserve,
      deficit: '51198023044',
    };

    const { getByLabelText, container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <TooltipProvider>
          <MobileReserveCard
            reserve={deficitReserve}
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

    const deficitTrigger = getByLabelText(`Deficit details for ${deficitReserve.tokenSymbol}`);
    fireEvent.click(deficitTrigger);

    // The popup should be visible now
    const allSvgElements = container.querySelectorAll('svg.lucide-external-link');
    // In the deficit popup, only ONE ExternalLink should appear (in the "Deficit" row)
    // (was previously two: one in "Deficit" and one in "% of total")
    expect(allSvgElements.length).toBeLessThanOrEqual(1);
  });

  it('renders frozen status badge with correct aria-label and data-status', () => {
    const frozenReserve: ReserveWithSpread = {
      ...reserve,
      isFrozen: true,
    };

    const { getByTestId } = render(
      <QueryClientProvider client={new QueryClient()}>
        <TooltipProvider>
          <MobileReserveCard
            reserve={frozenReserve}
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

    const badge = getByTestId('mobile-reserve-status-badge');
    expect(badge).toBeInTheDocument();
    expect(badge.getAttribute('data-status')).toBe('frozen');
    expect(badge.getAttribute('aria-label')).toBe('Show frozen details');
  });

  it('renders paused status badge with correct aria-label and data-status', () => {
    const pausedReserve: ReserveWithSpread = {
      ...reserve,
      isPaused: true,
    };

    const { getByTestId } = render(
      <QueryClientProvider client={new QueryClient()}>
        <TooltipProvider>
          <MobileReserveCard
            reserve={pausedReserve}
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

    const badge = getByTestId('mobile-reserve-status-badge');
    expect(badge).toBeInTheDocument();
    expect(badge.getAttribute('data-status')).toBe('paused');
    expect(badge.getAttribute('aria-label')).toBe('Show paused details');
  });

  it('does not wrap frozen status badge in a Tooltip (click already opens bottom sheet)', () => {
    const frozenReserve: ReserveWithSpread = {
      ...reserve,
      isFrozen: true,
    };

    const { getByTestId } = render(
      <QueryClientProvider client={new QueryClient()}>
        <TooltipProvider>
          <MobileReserveCard
            reserve={frozenReserve}
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

    const badge = getByTestId('mobile-reserve-status-badge');
    expect(badge).toBeInTheDocument();
    expect(badge.hasAttribute('data-state')).toBe(false);
  });

  it('does not wrap paused status badge in a Tooltip (click already opens bottom sheet)', () => {
    const pausedReserve: ReserveWithSpread = {
      ...reserve,
      isPaused: true,
    };

    const { getByTestId } = render(
      <QueryClientProvider client={new QueryClient()}>
        <TooltipProvider>
          <MobileReserveCard
            reserve={pausedReserve}
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

    const badge = getByTestId('mobile-reserve-status-badge');
    expect(badge).toBeInTheDocument();
    expect(badge.hasAttribute('data-state')).toBe(false);
  });

  describe('supplyDisable/borrowDisable 变暗效果', () => {
    it('supplyDisabled → APY 使用 text-emerald-500/50 变暗', () => {
      const supplyDisabledReserve = { ...reserve, supplyDisabled: true };

      const { container } = render(
        <QueryClientProvider client={new QueryClient()}>
          <TooltipProvider>
            <MobileReserveCard
              reserve={supplyDisabledReserve}
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

      expect(container.innerHTML).toContain('text-emerald-500/50');
    });

    it('supplyDisabled → 显示 "Supply unavailable" 而非 "Base APY only"', () => {
      const supplyDisabledReserve = { ...reserve, supplyDisabled: true };
      const noIncentiveSim = {
        ...simulation,
        supply: { ...simulation.supply, currentIncentive: 0, afterIncentive: 0 },
      };

      const { getByText, queryByText } = render(
        <QueryClientProvider client={new QueryClient()}>
          <TooltipProvider>
            <MobileReserveCard
              reserve={supplyDisabledReserve}
              isApy
              tydroPointToUsdRate={0}
              onIncentiveClick={() => {}}
              isSimulationExpanded={false}
              onToggleSimulation={() => {}}
              simulation={noIncentiveSim}
              supplyInput="1000"
              borrowInput="500"
              hasSharedScenario
              inputMode="usd"
            />
          </TooltipProvider>
        </QueryClientProvider>,
      );

      expect(getByText('Supply unavailable')).toBeInTheDocument();
      expect(queryByText('Base APY only')).not.toBeInTheDocument();
      expect(queryByText('Base APR only')).not.toBeInTheDocument();
    });

    it('supplyDisabled + 有激励 → Native APY 用 text-emerald-500/40 变暗', () => {
      const supplyDisabledReserve = { ...reserve, supplyDisabled: true };

      const { container } = render(
        <QueryClientProvider client={new QueryClient()}>
          <TooltipProvider>
            <MobileReserveCard
              reserve={supplyDisabledReserve}
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

      expect(container.innerHTML).toContain('text-emerald-500/40');
    });

    it('supplyDisabled + 有激励 → 激励标签使用变暗样式', () => {
      const supplyDisabledReserve = { ...reserve, supplyDisabled: true };

      const { container } = render(
        <QueryClientProvider client={new QueryClient()}>
          <TooltipProvider>
            <MobileReserveCard
              reserve={supplyDisabledReserve}
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

      expect(container.innerHTML).toContain('text-emerald-500/50');
      expect(container.innerHTML).toContain('bg-emerald-500/10');
      expect(container.innerHTML).toContain('ring-emerald-500/20');
    });

    it('borrowDisabled → APY 使用 text-cyan-500/50 变暗', () => {
      const borrowDisabledReserve = { ...reserve, borrowDisabled: true };

      const { container } = render(
        <QueryClientProvider client={new QueryClient()}>
          <TooltipProvider>
            <MobileReserveCard
              reserve={borrowDisabledReserve}
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
              defaultTab="borrow"
            />
          </TooltipProvider>
        </QueryClientProvider>,
      );

      expect(container.innerHTML).toContain('text-cyan-500/50');
    });

    it('borrowDisabled → 显示 "Borrow unavailable" 而非 "Base APY/APR only"', () => {
      const borrowDisabledReserve = { ...reserve, borrowDisabled: true };
      const noIncentiveSim = {
        ...simulation,
        borrow: { ...simulation.borrow, currentIncentive: 0, afterIncentive: 0 },
      };

      const { getByText, queryByText } = render(
        <QueryClientProvider client={new QueryClient()}>
          <TooltipProvider>
            <MobileReserveCard
              reserve={borrowDisabledReserve}
              isApy
              tydroPointToUsdRate={0}
              onIncentiveClick={() => {}}
              isSimulationExpanded={false}
              onToggleSimulation={() => {}}
              simulation={noIncentiveSim}
              supplyInput="1000"
              borrowInput="500"
              hasSharedScenario
              inputMode="usd"
              defaultTab="borrow"
            />
          </TooltipProvider>
        </QueryClientProvider>,
      );

      expect(getByText('Borrow unavailable')).toBeInTheDocument();
      expect(queryByText('Base APY only')).not.toBeInTheDocument();
      expect(queryByText('Base APR only')).not.toBeInTheDocument();
    });

    it('borrowDisabled + 有激励 → Native APY 用 text-cyan-500/40 变暗', () => {
      const borrowDisabledReserve = { ...reserve, borrowDisabled: true };

      const { container } = render(
        <QueryClientProvider client={new QueryClient()}>
          <TooltipProvider>
            <MobileReserveCard
              reserve={borrowDisabledReserve}
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
              defaultTab="borrow"
            />
          </TooltipProvider>
        </QueryClientProvider>,
      );

      expect(container.innerHTML).toContain('text-cyan-500/40');
    });

    it('borrowDisabled + 有激励 → 激励标签使用变暗样式', () => {
      const borrowDisabledReserve = { ...reserve, borrowDisabled: true };

      const { container } = render(
        <QueryClientProvider client={new QueryClient()}>
          <TooltipProvider>
            <MobileReserveCard
              reserve={borrowDisabledReserve}
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
              defaultTab="borrow"
            />
          </TooltipProvider>
        </QueryClientProvider>,
      );

      expect(container.innerHTML).toContain('text-cyan-500/50');
      expect(container.innerHTML).toContain('bg-cyan-500/10');
      expect(container.innerHTML).toContain('ring-cyan-500/20');
    });

    it('frozen → supply APY 变暗 (text-emerald-500/50)', () => {
      const frozenReserve = { ...reserve, isFrozen: true };

      const { container } = render(
        <QueryClientProvider client={new QueryClient()}>
          <TooltipProvider>
            <MobileReserveCard
              reserve={frozenReserve}
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

      expect(container.innerHTML).toContain('text-emerald-500/50');
    });

    it('frozen → borrow APY 变暗 (text-cyan-500/50)', () => {
      const frozenReserve = { ...reserve, isFrozen: true };

      const { container } = render(
        <QueryClientProvider client={new QueryClient()}>
          <TooltipProvider>
            <MobileReserveCard
              reserve={frozenReserve}
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
              defaultTab="borrow"
            />
          </TooltipProvider>
        </QueryClientProvider>,
      );

      expect(container.innerHTML).toContain('text-cyan-500/50');
    });

    it('supplyDisabled 时 APR 模式下也不显示 "Base APR only"', () => {
      const supplyDisabledReserve = { ...reserve, supplyDisabled: true };

      const { queryByText } = render(
        <QueryClientProvider client={new QueryClient()}>
          <TooltipProvider>
            <MobileReserveCard
              reserve={supplyDisabledReserve}
              isApy={false}
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

      expect(queryByText('Base APR only')).not.toBeInTheDocument();
      expect(queryByText('Base APY only')).not.toBeInTheDocument();
    });
  });

  describe('supplyCap/borrowCap 计算回归测试 (AAV-243)', () => {
    it('renders supply CapProgressRing when supplyCap produces a valid positive USD value', () => {
      const { getByLabelText } = renderCard(false);
      const supplyCapButton = getByLabelText('Show supply cap details');
      expect(supplyCapButton).toBeInTheDocument();
      expect(supplyCapButton.querySelector('svg')).not.toBeNull();
    });

    it('renders borrow BorrowCapProgressRing when borrowCap produces a valid positive USD value', () => {
      const { getByLabelText, getByText } = renderCard(false);
      fireEvent.click(getByText('Borrow'));
      const borrowCapButton = getByLabelText('Show borrow cap details');
      expect(borrowCapButton).toBeInTheDocument();
      expect(borrowCapButton.querySelector('svg')).not.toBeNull();
    });

    it('hides supply CapProgressRing when supplyCap is undefined', () => {
      const noSupplyCapReserve = { ...reserve, supplyCap: undefined };
      const { queryByLabelText } = render(
        <QueryClientProvider client={new QueryClient()}>
          <TooltipProvider>
            <MobileReserveCard
              reserve={noSupplyCapReserve}
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
      expect(queryByLabelText('Show supply cap details')).toBeNull();
    });

    it('hides borrow BorrowCapProgressRing when borrowCap is undefined', () => {
      const noBorrowCapReserve = { ...reserve, borrowCap: undefined };
      const { queryByLabelText } = render(
        <QueryClientProvider client={new QueryClient()}>
          <TooltipProvider>
            <MobileReserveCard
              reserve={noBorrowCapReserve}
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
      expect(queryByLabelText('Show borrow cap details')).toBeNull();
    });

    it('hides supply CapProgressRing when nativeToUsd returns null (e.g. tokenPrice=0)', () => {
      const zeroPriceReserve = { ...reserve, tokenPrice: 0 };
      const { queryByLabelText } = render(
        <QueryClientProvider client={new QueryClient()}>
          <TooltipProvider>
            <MobileReserveCard
              reserve={zeroPriceReserve}
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
      expect(queryByLabelText('Show supply cap details')).toBeNull();
      expect(queryByLabelText('Show borrow cap details')).toBeNull();
    });

    it('computes supplyCapUsd from reserve fields using nativeToUsd — matches DesktopReserveRow formula', () => {
      const expectedSupplyCapUsd = nativeToUsd(reserve.supplyCap, reserve.decimals, reserve.tokenPrice);
      const expectedBorrowCapUsd = nativeToUsd(reserve.borrowCap, reserve.decimals, reserve.tokenPrice);
      expect(expectedSupplyCapUsd).toBe(2_000_000);
      expect(expectedBorrowCapUsd).toBe(1_000_000);

      const ethReserve: ReserveWithSpread = {
        ...reserve,
        decimals: 18,
        tokenPrice: 2500,
        supplyCap: '1000000000000000000000000',
        borrowCap: '500000000000000000000000',
      };
      expect(nativeToUsd(ethReserve.supplyCap, ethReserve.decimals, ethReserve.tokenPrice)).toBe(2_500_000_000);
      expect(nativeToUsd(ethReserve.borrowCap, ethReserve.decimals, ethReserve.tokenPrice)).toBe(1_250_000_000);
    });

    it('renders both cap rings with different decimals/tokenPrice combinations', () => {
      const wbtcReserve: ReserveWithSpread = {
        ...reserve,
        tokenSymbol: 'WBTC',
        decimals: 8,
        tokenPrice: 65000,
        supplyCap: '2100000000000000',
        borrowCap: '1050000000000000',
      };
      const expectedSupplyCapUsd = nativeToUsd(wbtcReserve.supplyCap, wbtcReserve.decimals, wbtcReserve.tokenPrice);
      const expectedBorrowCapUsd = nativeToUsd(wbtcReserve.borrowCap, wbtcReserve.decimals, wbtcReserve.tokenPrice);
      expect(expectedSupplyCapUsd).toBeGreaterThan(0);
      expect(expectedBorrowCapUsd).toBeGreaterThan(0);

      const { getByLabelText } = render(
        <QueryClientProvider client={new QueryClient()}>
          <TooltipProvider>
            <MobileReserveCard
              reserve={wbtcReserve}
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
      expect(getByLabelText('Show supply cap details')).toBeInTheDocument();
    });

    it('renders cap sheet with CapProgressContent using nativeToUsd result for supply', () => {
      const { getByLabelText, container } = renderCard(false);
      const supplyCapButton = getByLabelText('Show supply cap details');
      fireEvent.click(supplyCapButton);
      expect(container.innerHTML).toContain('$2.00M');
    });
  });

  it('calls onSelectHub with hubId (not hubName) when hub badge is clicked', () => {
    const onSelectHub = vi.fn();
    const { getByLabelText } = render(
      <QueryClientProvider client={new QueryClient()}>
        <TooltipProvider>
          <MobileReserveCard
            reserve={{ ...reserve, hubName: 'Core', hubId: 'hub-core' }}
            isApy
            tydroPointToUsdRate={0}
            onIncentiveClick={() => {}}
            onSelectHub={onSelectHub}
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
    fireEvent.click(getByLabelText('Filter by Core hub'));
    expect(onSelectHub).toHaveBeenCalledWith('hub-core');
  });

  it('renders supply size from reserve.supplied field', () => {
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <TooltipProvider>
          <MobileReserveCard
            reserve={reserve}
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
    expect(container.textContent).toContain('$1.00M');
  });
});
