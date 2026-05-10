// @vitest-environment happy-dom
/**
 * RTL render tests for the mobile (compact) Simulation Grid layout.
 * Companion to SimulationSubRow.compact.test.tsx (source-level invariants).
 *
 * See docs/specs/2026-05-10-mobile-simulation-grid-layout-plan.md (TC-11 ~ TC-19).
 *
 * happy-dom does not do real CSS layout, so geometry-based assertions
 * (getBoundingClientRect.top / scrollWidth) cannot be verified here. Instead we
 * assert the DOM structure, ARIA roles, and class strings that drive the layout.
 * Geometric behavior (label + cap one-line vs. wrap, no horizontal scroll) is
 * locked in by the structural asserts (`flex flex-wrap` + `whitespace-nowrap`
 * children, `grid-cols-[1fr_auto_auto_auto]`, no `overflow-x-*`) — the same set
 * of class strings that the source-regex tests pin down.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import SimulationSubRow from './SimulationSubRow';
import type { ReserveWithSpread } from '@/types/aave';
import type { RateSimulationResult } from '@/hooks/useRateSimulation';

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => true,
}));

const baseReserve: ReserveWithSpread = {
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

const emptySource = { current: 0, after: 0, delta: 0 };

const baseSimulation: RateSimulationResult = {
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
  utilization: { current: 45, after: 52, delta: 7, optimal: 80 },
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

function renderCompact({
  reserve = baseReserve,
  simulation = baseSimulation,
}: {
  reserve?: ReserveWithSpread;
  simulation?: RateSimulationResult;
} = {}) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SimulationSubRow
          reserve={reserve}
          simulation={simulation}
          isApy
          supplyInput="1000"
          borrowInput="500"
          inputMode="usd"
          compact
          embeddedFromTop
        />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe('SimulationSubRow compact (mobile) Grid render', () => {
  afterEach(() => cleanup());

  it('TC-11/12/13: label cell wraps label + cap via flex flex-wrap + whitespace-nowrap children', () => {
    // Long cap value forces the same DOM path as Celo USDT `Supplied / Cap $19.50M`.
    const sim: RateSimulationResult = {
      ...baseSimulation,
      marketMetrics: {
        ...baseSimulation.marketMetrics,
        supplyCapUsd: 19_500_000,
        borrowCapUsd: 12_345_678_900,
      },
    };
    const { getByRole } = renderCompact({ simulation: sim });
    const table = getByRole('table', { name: 'Simulation breakdown' });
    expect(table.className).toContain('grid-cols-[1fr_auto_auto_auto]');

    // The Supplied row's label cell hosts a `flex flex-wrap items-baseline` flex
    // container; its two children (label + cap span) must both be `whitespace-nowrap`.
    const suppliedLabel = within(table).getByText('Supplied');
    const flexWrap = suppliedLabel.parentElement;
    expect(flexWrap).not.toBeNull();
    expect(flexWrap?.className).toContain('flex');
    expect(flexWrap?.className).toContain('flex-wrap');
    expect(flexWrap?.className).toContain('items-baseline');
    // Cap text is sibling, not a separate row, so it can wrap inline within the
    // same label cell.
    const capSpan = within(table).getByText(/Cap\s*\$19\.50M/);
    expect(capSpan.className).toContain('whitespace-nowrap');
    expect(suppliedLabel.className).toContain('whitespace-nowrap');
    // Both spans live in the same flex container.
    expect(capSpan.parentElement).toBe(flexWrap);
  });

  it('TC-14: compact container exposes no overflow-x-* classes (no horizontal scroll)', () => {
    const { getByRole } = renderCompact();
    const table = getByRole('table', { name: 'Simulation breakdown' });
    expect(table.className).not.toMatch(/overflow-x-(auto|scroll)/);
    let parent: HTMLElement | null = table.parentElement;
    while (parent) {
      expect(parent.className).not.toMatch(/overflow-x-(auto|scroll)/);
      parent = parent.parentElement;
    }
  });

  it('TC-15: every numeric cell uses tabular-nums + ds-text-11 (consistent column widths)', () => {
    const { getByRole } = renderCompact();
    const table = getByRole('table', { name: 'Simulation breakdown' });
    const cells = within(table).getAllByRole('cell');
    // Find numeric cells: they have text-right + whitespace-nowrap on the cell element.
    const numericCells = cells.filter((cell) =>
      cell.className.includes('text-right') && cell.className.includes('whitespace-nowrap'),
    );
    expect(numericCells.length).toBeGreaterThanOrEqual(3);
    numericCells.forEach((cell) => {
      // Inner span should carry tabular-nums + ds-text-11.
      const span = cell.querySelector('span');
      // Some numeric cells render no span when value is hidden (e.g. delta when no input);
      // skip those.
      if (!span) return;
      expect(span.className).toContain('tabular-nums');
      expect(span.className).toContain('ds-text-11');
    });
  });

  it('TC-16: frozen reserve renders a Frozen notice and masks After/Δ to "-"', () => {
    const frozen = { ...baseReserve, isFrozen: true };
    const { getByText, getByRole } = renderCompact({ reserve: frozen });
    expect(getByText(/Frozen/i)).toBeInTheDocument();
    const table = getByRole('table', { name: 'Simulation breakdown' });
    // Spread + Liquidity After cells should show "-" when reserve is locked.
    const spreadAfter = within(table).getAllByText('-');
    expect(spreadAfter.length).toBeGreaterThanOrEqual(1);
  });

  it('TC-17: cap warning row applies ds-bg-warning-row class to cells', () => {
    const exceedingSim: RateSimulationResult = {
      ...baseSimulation,
      marketMetrics: {
        ...baseSimulation.marketMetrics,
        supplyCapExceeded: true,
        supplyCapExceededByUsd: 250_000,
        availableSupplyRoomUsd: -250_000,
      },
    };
    const { getByRole } = renderCompact({ simulation: exceedingSim });
    const table = getByRole('table', { name: 'Simulation breakdown' });
    const warningCells = table.querySelectorAll('.ds-bg-warning-row');
    expect(warningCells.length).toBeGreaterThanOrEqual(1);
  });

  it('TC-18: cap progress bar renders as a col-span-4 row when cap is set', () => {
    const { getByRole } = renderCompact();
    const table = getByRole('table', { name: 'Simulation breakdown' });
    const colSpanRows = table.querySelectorAll('.col-span-4');
    // Supply row has supplyCapUsd; borrow row has borrowCapUsd → 2 cap progress bars.
    expect(colSpanRows.length).toBeGreaterThanOrEqual(2);
  });

  it('TC-19: a11y — table exposes role + aria-label, header cells use columnheader role', () => {
    const { getByRole, getAllByRole } = renderCompact();
    const table = getByRole('table', { name: 'Simulation breakdown' });
    expect(table.tagName.toLowerCase()).toBe('div');
    // 4 columnheader cells in the header row.
    const headers = getAllByRole('columnheader');
    expect(headers.length).toBe(4);
    expect(headers[1]?.textContent?.trim()).toBe('Current');
    expect(headers[2]?.textContent?.trim()).toBe('After');
    expect(headers[3]?.textContent?.trim()).toBe('Δ');
  });
});
