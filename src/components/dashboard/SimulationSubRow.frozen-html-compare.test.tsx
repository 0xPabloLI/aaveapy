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

describe('Frozen/paused rows are fully opaque (no visual opacity reduction)', () => {
  it('COMPACT: frozen rows have no opacity-75 or dark:opacity-60 classes', () => {
    const html = renderCompact({ isFrozen: true });
    expect(html).not.toContain('opacity-75');
    expect(html).not.toContain('dark:opacity-60');
  });

  it('COMPACT: paused rows have no opacity-75 or dark:opacity-60 classes', () => {
    const html = renderCompact({ isPaused: true });
    expect(html).not.toContain('opacity-75');
    expect(html).not.toContain('dark:opacity-60');
  });

  it('COMPACT: supplyDisabled rows have no opacity-75 or dark:opacity-60 classes', () => {
    const html = renderCompact({ supplyDisabled: true });
    expect(html).not.toContain('opacity-75');
    expect(html).not.toContain('dark:opacity-60');
  });

  it('COMPACT: borrowDisabled rows have no opacity-75 or dark:opacity-60 classes', () => {
    const html = renderCompact({ borrowDisabled: true });
    expect(html).not.toContain('opacity-75');
    expect(html).not.toContain('dark:opacity-60');
  });

  it('DESKTOP: frozen rows — tbody has no group-data-[disabled]:opacity classes', () => {
    const html = renderDesktop({ isFrozen: true });
    expect(html).not.toContain('group-data-[disabled]:opacity-75');
    expect(html).not.toContain('dark:group-data-[disabled]:opacity-60');
  });

  it('DESKTOP: frozen rows — cap progress bars have no grayscale or opacity-50', () => {
    const html = renderDesktop({ isFrozen: true });
    expect(html).not.toContain('group-data-[disabled]:grayscale-[50%]');
    expect(html).not.toContain('group-data-[disabled]:opacity-50');
  });

  it('DESKTOP: frozen rows — labels are not faded to text-muted-foreground', () => {
    const html = renderDesktop({ isFrozen: true });
    expect(html).not.toContain('group-data-[disabled]:text-muted-foreground');
  });

  it('DESKTOP: data-disabled semantic attribute is still present for accessibility', () => {
    const html = renderDesktop({ isFrozen: true });
    const count = (html.match(/data-disabled="true"/g) ?? []).length;
    expect(count).toBeGreaterThanOrEqual(8);
  });

  it('DESKTOP: supplyDisabled only — data-disabled still present in supply column', () => {
    const html = renderDesktop({ supplyDisabled: true });
    const count = (html.match(/data-disabled="true"/g) ?? []).length;
    expect(count).toBeGreaterThan(0);
  });

  it('DESKTOP: paused rows — same opacity-free guarantees as frozen', () => {
    const html = renderDesktop({ isPaused: true });
    expect(html).not.toContain('group-data-[disabled]:opacity-75');
    expect(html).not.toContain('group-data-[disabled]:grayscale-[50%]');
    expect(html).not.toContain('group-data-[disabled]:opacity-50');
    expect(html).not.toContain('group-data-[disabled]:text-muted-foreground');
  });
});
