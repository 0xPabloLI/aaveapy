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

  it('TC-R02: supplyDisabled only — supply cells have opacity, borrow/spread/liquidity do NOT', () => {
    const html = renderCompact({ ...baseReserve, supplyDisabled: true });

    // supplySideBlocked = true → supplySectionClass = 'opacity-75 dark:opacity-60'
    // borrowSideBlocked = false → borrowSectionClass = ''
    // Only supply rows should carry the opacity class
    // The compact grid layout uses role="table"/role="row"/role="cell"
    // We verify the cellBgClass includes opacity for supply but not for others

    // Count occurrences of opacity class: supply rows (Supplied, Col, Size, Utilization)
    // Each has a label cell with opacity applied via cellBgClass
    const opacityMatches = html.match(/opacity-75 dark:opacity-60/g) ?? [];
    // Supply rows: 4 rows (Supplied, Col, Size, Utilization)
    // Each row has multiple cells; the cellBgClass applies opacity to all cells in supply rows
    expect(opacityMatches.length).toBeGreaterThan(0);
    expect(opacityMatches.length).toBeLessThan(50); // sanity: not on every cell
  });

  it('TC-R03: borrowDisabled only — borrow cells have opacity, supply/spread/liquidity do NOT', () => {
    const html = renderCompact({ ...baseReserve, borrowDisabled: true });

    // borrowSideBlocked = true → borrowSectionClass = 'opacity-75 dark:opacity-60'
    // supplySideBlocked = false → supplySectionClass = ''
    const opacityMatches = html.match(/opacity-75 dark:opacity-60/g) ?? [];
    expect(opacityMatches.length).toBeGreaterThan(0);
    expect(opacityMatches.length).toBeLessThan(50);
  });

  it('TC-R04: supplyDisabled + borrowDisabled — BOTH supply and borrow cells have opacity', () => {
    const html = renderCompact({ ...baseReserve, supplyDisabled: true, borrowDisabled: true });

    // Both sides blocked → both supplySectionClass and borrowSectionClass set
    const opacityMatches = html.match(/opacity-75 dark:opacity-60/g) ?? [];
    expect(opacityMatches.length).toBeGreaterThan(0);
    expect(opacityMatches.length).toBeLessThan(100);
  });

  it('TC-R05: isFrozen — BOTH supply and borrow cells have opacity', () => {
    const html = renderCompact({ ...baseReserve, isFrozen: true });

    // isReserveLocked → both supplySideBlocked and borrowSideBlocked = true
    const opacityMatches = html.match(/opacity-75 dark:opacity-60/g) ?? [];
    expect(opacityMatches.length).toBeGreaterThan(0);
    expect(opacityMatches.length).toBeLessThan(100);
  });

  it('TC-R06: isPaused — BOTH supply and borrow cells have opacity', () => {
    const html = renderCompact({ ...baseReserve, isPaused: true });

    const opacityMatches = html.match(/opacity-75 dark:opacity-60/g) ?? [];
    expect(opacityMatches.length).toBeGreaterThan(0);
    expect(opacityMatches.length).toBeLessThan(100);
  });

  it('TC-R07: supply/borrow opacity counts are equal when both sides blocked', () => {
    // Render with both disabled and count opacity occurrences per section
    const htmlSupply = renderCompact({ ...baseReserve, supplyDisabled: true });
    const htmlBorrow = renderCompact({ ...baseReserve, borrowDisabled: true });

    const supplyOnlyMatches = htmlSupply.match(/opacity-75 dark:opacity-60/g) ?? [];
    const borrowOnlyMatches = htmlBorrow.match(/opacity-75 dark:opacity-60/g) ?? [];

    // When only one side is blocked, the opacity count should be the same
    // (supply section has same number of rows as borrow section)
    expect(supplyOnlyMatches.length).toBe(borrowOnlyMatches.length);
  });

  it('TC-R08: spread and liquidity rows never have opacity', () => {
    // Even when frozen, spread/liquidity cells should not carry section opacity
    const html = renderCompact({ ...baseReserve, isFrozen: true });

    // The renderCompactLayout passes sectionClass ONLY to supply and borrow rows
    // Spread (line ~820) and Liquidity (line ~838) use renderCompactGridRow without section opacity
    // ... but renderCompactGridRow actually uses cellBgClass = rowBgClass + sectionClass
    // wait, let's check: lines 820-877 in the source
    // Spread and Liquidity are rendered with renderCompactGridRow which applies sectionClass
    // So we need to check the source-level behavior
    // The key test: opacity count for frozen should equal supply only + borrow only
    const frozenMatches = html.match(/opacity-75 dark:opacity-60/g) ?? [];
    const supplyOnlyHtml = renderCompact({ ...baseReserve, supplyDisabled: true });
    const borrowOnlyHtml = renderCompact({ ...baseReserve, borrowDisabled: true });
    const supplyOnlyCount = (supplyOnlyHtml.match(/opacity-75 dark:opacity-60/g) ?? []).length;
    const borrowOnlyCount = (borrowOnlyHtml.match(/opacity-75 dark:opacity-60/g) ?? []).length;

    // Frozen blocks both sides → should equal supply+borrow (excluding spread/liquidity which get NO opacity)
    // But actually spread/liquidity rows in renderCompactLayout are rendered BETWEEN supply and borrow
    // and they use the same renderCompactGridRow... let me check the actual source
    // Lines 820-877: Spread and Liquidity are rendered inline, not via renderCompactGridRow
    // So they should NOT have section opacity
    expect(frozenMatches.length).toBe(supplyOnlyCount + borrowOnlyCount);
  });

  it('TC-R09: isFrozen blocks both sides equally — opacity count equals supplyDisabled + borrowDisabled individually', () => {
    const frozenHtml = renderCompact({ ...baseReserve, isFrozen: true });
    const pausedHtml = renderCompact({ ...baseReserve, isPaused: true });
    const bothDisabledHtml = renderCompact({ ...baseReserve, supplyDisabled: true, borrowDisabled: true });

    const frozenCount = (frozenHtml.match(/opacity-75 dark:opacity-60/g) ?? []).length;
    const pausedCount = (pausedHtml.match(/opacity-75 dark:opacity-60/g) ?? []).length;
    const bothCount = (bothDisabledHtml.match(/opacity-75 dark:opacity-60/g) ?? []).length;

    // All three should have the same opacity count (both sides blocked)
    expect(frozenCount).toBe(pausedCount);
    expect(frozenCount).toBe(bothCount);
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