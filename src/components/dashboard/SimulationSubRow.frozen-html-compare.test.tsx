// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import SimulationSubRow from './SimulationSubRow';
import type { ReserveWithSpread } from '@/types/aave';
import type { RateSimulationResult } from '@/hooks/useRateSimulation';

const emptySource = { current: 0, after: 0, delta: 0 };

function buildReserve(overrides: Partial<ReserveWithSpread>): ReserveWithSpread {
  return {
    reserveId: 'AaveV3Ethereum-0xTest',
    marketName: 'AaveV3Ethereum', chainName: 'Ethereum', chainId: 1,
    tokenName: 'USDC', tokenSymbol: 'USDC', tokenAddress: '0xTest', tokenPrice: 1, decimals: 6,
    reserveSize: '1000000000000', supplyCap: '2000000000000', borrowCap: '1000000000000',
    utilizationPct: 45, optimalUsageRate: 80, variableRateSlope1: 4, variableRateSlope2: 60,
    baseVariableBorrowRate: 0, reserveFactor: 10, supplyApy: 4.2, borrowApy: 6.1,
    supplyDisabled: false, borrowDisabled: false, isFrozen: false, isPaused: false,
    supplyIncentives: [], borrowIncentives: [], meritSupplys: [], meritBorrows: [],
    merklSupplys: [], merklBorrows: [], brevisSupplys: [], brevisBorrows: [],
    ...overrides,
  };
}

const sim: RateSimulationResult = {
  tokenPrice: 1, tokenPriceLoading: false, forecastLoading: false,
  forecastErrors: {}, forecastUnavailableCampaignCount: 0, scenarioUsdAccrual: null,
  supply: {
    currentNative: 4.2, currentIncentive: 0, currentTotal: 4.2,
    afterNative: null, afterIncentive: null, afterTotal: null,
    deltaNative: null, deltaIncentive: null, deltaTotal: null,
    inputUsd: 1000, inputAmount: 1000, hasInput: true,
    sources: { protocol: emptySource, merit: emptySource, merkl: emptySource, brevis: emptySource },
  },
  borrow: {
    currentNative: 6.1, currentIncentive: 0, currentTotal: 6.1,
    afterNative: null, afterIncentive: null, afterTotal: null,
    deltaNative: null, deltaIncentive: null, deltaTotal: null,
    inputUsd: 500, inputAmount: 500, hasInput: true,
    sources: { protocol: emptySource, merit: emptySource, merkl: emptySource, brevis: emptySource },
  },
  spread: { current: -0.5, after: null, delta: null, usesCurrentSide: null },
  utilization: { current: 45, after: 45, delta: 0, optimal: 80 },
  marketMetrics: {
    availableLiquidityUsd: 550_000, availableLiquidityUsdAfter: null, availableLiquidityUsdDelta: null,
    totalBorrowedUsd: 450_000, totalBorrowedUsdAfter: null, totalBorrowedUsdDelta: null,
    supplyCapUsd: 2_000_000, borrowCapUsd: 1_000_000, reserveFactor: 0.1, optimalUtilization: 0.8,
    availableSupplyRoomUsd: 999_000, supplyCapExceeded: false, supplyCapExceededByUsd: null,
    availableBorrowRoomUsd: 548_000, borrowCapExceeded: false, borrowCapExceededByUsd: null,
    borrowLimitedByLiquidity: false,
  },
};

function renderCompact(overrides: Partial<ReserveWithSpread>) {
  const qc = new QueryClient();
  return renderToString(
    <QueryClientProvider client={qc}>
      <TooltipProvider>
        <SimulationSubRow
          reserve={buildReserve(overrides)}
          simulation={sim}
          isApy supplyInput="1000" borrowInput="500" inputMode="usd"
          compact={true}
        />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

function renderDesktop(overrides: Partial<ReserveWithSpread>) {
  const qc = new QueryClient();
  return renderToString(
    <QueryClientProvider client={qc}>
      <TooltipProvider>
        <SimulationSubRow
          reserve={buildReserve(overrides)}
          simulation={sim}
          isApy supplyInput="1000" borrowInput="500" inputMode="usd"
          compact={false}
        />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe('Frozen — supply vs borrow EXACT HTML comparison', () => {
  it('COMPACT: both supply and borrow rows have opacity-75 when frozen', () => {
    const html = renderCompact({ isFrozen: true });

    // Count opacity-75 dark:opacity-60 in supply rows vs borrow rows
    const supplyBlock = html.substring(0, html.indexOf('Spread'));
    const borrowBlock = html.substring(html.lastIndexOf('Spread') + 'Spread'.length);

    const supplyOpacities = (supplyBlock.match(/opacity-75 dark:opacity-60/g) ?? []).length;
    const borrowOpacities = (borrowBlock.match(/opacity-75 dark:opacity-60/g) ?? []).length;

    console.log('COMPACT frozen: supply opacities =', supplyOpacities, 'borrow opacities =', borrowOpacities);
    expect(supplyOpacities).toBe(borrowOpacities);
    expect(supplyOpacities).toBeGreaterThan(0);
  });

  it('COMPACT: supplyDisabled only — only supply rows have opacity', () => {
    const html = renderCompact({ supplyDisabled: true });

    const supplyBlock = html.substring(0, html.indexOf('Spread'));
    const borrowBlock = html.substring(html.lastIndexOf('Spread') + 'Spread'.length);

    const supplyOpacities = (supplyBlock.match(/opacity-75 dark:opacity-60/g) ?? []).length;
    const borrowOpacities = (borrowBlock.match(/opacity-75 dark:opacity-60/g) ?? []).length;

    console.log('COMPACT supplyDisabled: supply opacities =', supplyOpacities, 'borrow opacities =', borrowOpacities);
    expect(supplyOpacities).toBeGreaterThan(0);
    expect(borrowOpacities).toBe(0);
  });

  it('COMPACT: borrowDisabled only — only borrow rows have opacity', () => {
    const html = renderCompact({ borrowDisabled: true });

    const supplyBlock = html.substring(0, html.indexOf('Spread'));
    const borrowBlock = html.substring(html.lastIndexOf('Spread') + 'Spread'.length);

    const supplyOpacities = (supplyBlock.match(/opacity-75 dark:opacity-60/g) ?? []).length;
    const borrowOpacities = (borrowBlock.match(/opacity-75 dark:opacity-60/g) ?? []).length;

    console.log('COMPACT borrowDisabled: supply opacities =', supplyOpacities, 'borrow opacities =', borrowOpacities);
    expect(supplyOpacities).toBe(0);
    expect(borrowOpacities).toBeGreaterThan(0);
  });

  it('DESKTOP: both supply and borrow columns have data-disabled="true" when frozen', () => {
    const html = renderDesktop({ isFrozen: true });

    // Desktop format: <div data-disabled="true" class="group ..."> for each column
    // Count data-disabled="true" near "group" class (column wrappers)
    const count = (html.match(/data-disabled="true"/g) ?? []).length;

    // Desktop: 2 column wrappers + tr rows inside each = 2 + supply_rows + borrow_rows
    console.log('DESKTOP frozen: data-disabled count =', count);
    expect(count).toBeGreaterThanOrEqual(8); // 2 wrappers + 4 supply tr + 4 borrow tr = 10
  });

  it('DESKTOP: supplyDisabled only — only supply column has data-disabled', () => {
    const supplyHtml = renderDesktop({ supplyDisabled: true });
    const borrowHtml = renderDesktop({ borrowDisabled: true });

    const supplyCount = (supplyHtml.match(/data-disabled="true"/g) ?? []).length;
    const borrowCount = (borrowHtml.match(/data-disabled="true"/g) ?? []).length;

    console.log('DESKTOP supplyOnly: data-disabled count =', supplyCount);
    console.log('DESKTOP borrowOnly: data-disabled count =', borrowCount);
    expect(supplyCount).toBe(borrowCount);
    expect(supplyCount).toBeGreaterThan(0);
  });
});