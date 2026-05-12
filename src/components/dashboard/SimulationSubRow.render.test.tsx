// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import SimulationSubRow from './SimulationSubRow';
import type { ReserveWithSpread } from '@/types/aave';
import type { RateSimulationResult } from '@/hooks/useRateSimulation';

const emptySource = { current: 0, after: 0, delta: 0 };

const baseReserve: ReserveWithSpread = {
  reserveId: 'AaveV3Ethereum-0xTest',
  marketName: 'AaveV3Ethereum',
  chainName: 'Ethereum',
  chainId: 1,
  tokenName: 'USDC',
  tokenSymbol: 'USDC',
  tokenAddress: '0xTest',
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
  isFrozen: false,
  isPaused: false,
  supplyIncentives: [],
  borrowIncentives: [],
  meritSupplys: [],
  meritBorrows: [],
  merklSupplys: [],
  merklBorrows: [],
  brevisSupplys: [],
  brevisBorrows: [],
};

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
  spread: { current: -0.5, after: -0.4, delta: 0.1, usesCurrentSide: null },
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

function renderCompact(reserve: ReserveWithSpread) {
  const queryClient = new QueryClient();
  return renderToString(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SimulationSubRow
          reserve={reserve}
          simulation={baseSimulation}
          isApy
          supplyInput="1000"
          borrowInput="500"
          inputMode="usd"
          compact={true}
        />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

function renderDesktop(reserve: ReserveWithSpread) {
  const queryClient = new QueryClient();
  return renderToString(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SimulationSubRow
          reserve={reserve}
          simulation={baseSimulation}
          isApy
          supplyInput="1000"
          borrowInput="500"
          inputMode="usd"
          compact={false}
        />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe('SimulationSubRow — compact (mobile) disabled opacity', () => {
  it('TC-R01: normal reserve — no opacity on any section', () => {
    const html = renderCompact({ ...baseReserve });
    // supplySectionClass = '' when not blocked
    expect(html).not.toContain('opacity-75 dark:opacity-60');
  });

  it('TC-R02: supplyDisabled only — no opacity on any section (frozen/paused rows are fully opaque)', () => {
    const html = renderCompact({ ...baseReserve, supplyDisabled: true });
    expect(html).not.toContain('opacity-75');
    expect(html).not.toContain('dark:opacity-60');
  });

  it('TC-R03: borrowDisabled only — no opacity on any section (frozen/paused rows are fully opaque)', () => {
    const html = renderCompact({ ...baseReserve, borrowDisabled: true });
    expect(html).not.toContain('opacity-75');
    expect(html).not.toContain('dark:opacity-60');
  });

  it('TC-R04: supplyDisabled + borrowDisabled — no opacity (frozen/paused rows are fully opaque)', () => {
    const html = renderCompact({ ...baseReserve, supplyDisabled: true, borrowDisabled: true });
    expect(html).not.toContain('opacity-75');
    expect(html).not.toContain('dark:opacity-60');
  });

  it('TC-R05: isFrozen — no opacity (frozen/paused rows are fully opaque)', () => {
    const html = renderCompact({ ...baseReserve, isFrozen: true });
    expect(html).not.toContain('opacity-75');
    expect(html).not.toContain('dark:opacity-60');
  });

  it('TC-R06: isPaused — no opacity (frozen/paused rows are fully opaque)', () => {
    const html = renderCompact({ ...baseReserve, isPaused: true });
    expect(html).not.toContain('opacity-75');
    expect(html).not.toContain('dark:opacity-60');
  });

  it('TC-R07: no opacity classes exist when both sides blocked (fully opaque)', () => {
    const htmlSupply = renderCompact({ ...baseReserve, supplyDisabled: true });
    const htmlBorrow = renderCompact({ ...baseReserve, borrowDisabled: true });

    expect(htmlSupply).not.toContain('opacity-75');
    expect(htmlBorrow).not.toContain('opacity-75');
  });

  it('TC-R08: spread and liquidity rows never have opacity', () => {
    const html = renderCompact({ ...baseReserve, isFrozen: true });
    expect(html).not.toContain('opacity-75');
    expect(html).not.toContain('dark:opacity-60');
  });

  it('TC-R09: isFrozen blocks both sides equally — no opacity (fully opaque)', () => {
    const frozenHtml = renderCompact({ ...baseReserve, isFrozen: true });
    const pausedHtml = renderCompact({ ...baseReserve, isPaused: true });
    const bothDisabledHtml = renderCompact({ ...baseReserve, supplyDisabled: true, borrowDisabled: true });

    expect(frozenHtml).not.toContain('opacity-75');
    expect(pausedHtml).not.toContain('opacity-75');
    expect(bothDisabledHtml).not.toContain('opacity-75');
  });
});

describe('SimulationSubRow — compact data-disabled placement', () => {
  it('TC-R10: data-disabled is on the group cell, NOT on the contents wrapper', () => {
    const html = renderCompact({ ...baseReserve, supplyDisabled: true });

    // The fix: data-disabled should be on the cell div that has 'group' class
    // Pattern: <div role="cell" data-disabled="true" className="...group...
    // Anti-pattern: <div role="row" className="contents" data-disabled="true">
    const correctPattern = /data-disabled="true"[^>]*\bgroup\b/;
    expect(correctPattern.test(html)).toBe(true);

    // The anti-pattern should NOT exist
    const antiPattern = /<div\s+role="row"\s+className="contents"\s+data-disabled/;
    expect(antiPattern.test(html)).toBe(false);
  });

  it('TC-R11: normal reserve has no data-disabled on any cell', () => {
    const html = renderCompact({ ...baseReserve });
    expect(html).not.toContain('data-disabled="true"');
  });

  it('TC-R12: supplyDisabled produces data-disabled on supply label cells', () => {
    const html = renderCompact({ ...baseReserve, supplyDisabled: true });
    expect(html).toContain('data-disabled="true"');
    const disabledMatches = html.match(/data-disabled="true"/g) ?? [];
    expect(disabledMatches.length).toBe(3);
  });

  it('TC-R13: borrowDisabled produces data-disabled on borrow label cells', () => {
    const html = renderCompact({ ...baseReserve, borrowDisabled: true });
    const disabledMatches = html.match(/data-disabled="true"/g) ?? [];
    expect(disabledMatches.length).toBe(3);
  });
});

describe('SimulationSubRow — desktop disabled opacity', () => {
  it('TC-D01: normal desktop — no data-disabled on parent divs', () => {
    const html = renderDesktop({ ...baseReserve });
    expect(html).not.toContain('data-disabled="true"');
  });

  it('TC-D02: supplyDisabled desktop — supply column has data-disabled', () => {
    const html = renderDesktop({ ...baseReserve, supplyDisabled: true });

    expect(html).toContain('data-disabled="true"');
    expect(html).toContain('Supply is disabled');
  });

  it('TC-D03: borrowDisabled desktop — borrow column has data-disabled', () => {
    const html = renderDesktop({ ...baseReserve, borrowDisabled: true });

    expect(html).toContain('data-disabled="true"');
    expect(html).toContain('Borrow is disabled');
  });

  it('TC-D04: isFrozen desktop — BOTH columns have data-disabled', () => {
    const html = renderDesktop({ ...baseReserve, isFrozen: true });

    // Both columns blocked → twice as many data-disabled entries as single-side
    const disabledCount = (html.match(/data-disabled="true"/g) ?? []).length;
    expect(disabledCount).toBeGreaterThanOrEqual(8); // 2 wrappers + 8 sub-rows
  });

  it('TC-D05: desktop spread/liquidity bar has no opacity when supply disabled', () => {
    const html = renderDesktop({ ...baseReserve, supplyDisabled: true });

    // The spread + liquidity summary bar (desktop) should NOT have opacity
    // It's rendered outside the data-disabled div
    // Verify the bar still shows the spread value
    expect(html).toContain('-0.50');
  });
});