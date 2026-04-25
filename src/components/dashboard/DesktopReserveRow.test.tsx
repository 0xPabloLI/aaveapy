import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Table, TableBody } from '@/components/ui/table';
import DesktopReserveRow from './DesktopReserveRow';
import type { ReserveWithSpread } from '@/types/aave';
import type { RateSimulationResult } from '@/hooks/useRateSimulation';

const reserve: ReserveWithSpread = {
  reserveId: 'AaveV3Ethereum-0x0000000000000000000000000000000000000001',
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

  it('uses dedicated non-flickering hover groups for market and hub action icons', () => {
    const queryClient = new QueryClient();
    const html = renderToString(
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Table>
            <TableBody>
              <DesktopReserveRow
                reserve={{ ...reserve, hubName: 'Core', hubId: 'hub-core' }}
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
              />
            </TableBody>
          </Table>
        </TooltipProvider>
      </QueryClientProvider>
    );

    expect(html).toContain('group/market-link');
    expect(html).toContain('group-hover/market-link:opacity-100');
    expect(html).toContain('pl-4');
    expect(html).toContain('pr-4');
    expect(html).toContain('group/hub-link');
    expect(html).toContain('group-hover/hub-link:opacity-100');
    expect(html).toContain('pr-3');
  });

  it('keeps Token cell content from overflowing into the Price column at narrow widths', () => {
    // Regression guard: at narrow desktop widths (~768-900px), the table-fixed
    // Token column (13%) is too tight to fit icon + symbol + optional snowflake +
    // AssetActionMenu on one line. If the inner flex uses inline-flex (sizes to
    // content) and the symbol cannot wrap, the whole block overflows into the
    // Price column regardless of cell padding. The fix has four invariants:
    //   1. Token TableCell has `overflow-hidden`
    //   2. Inner flex is `flex w-full min-w-0` (fills cell, can shrink)
    //   3. Token symbol span uses `break-words min-w-0` so multi-token names can
    //      wrap to a new line (single-line-first, wrap-only-when-needed per
    //      DESIGN-SYSTEM-REFERENCE §3 / §4); never `break-all` / `truncate`.
    //   4. Non-text siblings (icon, snowflake, AssetActionMenu) are `shrink-0`
    //      so they stay at intrinsic size and never disappear.
    const queryClient = new QueryClient();
    const html = renderToString(
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Table>
            <TableBody>
              <DesktopReserveRow
                reserve={{ ...reserve, isFrozenOrPaused: true, tokenSymbol: 'syrupUSDT' }}
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
              />
            </TableBody>
          </Table>
        </TooltipProvider>
      </QueryClientProvider>
    );

    // (1) Token cell clips any residual overflow AND uses the centralized
    // padding utility (not raw pl-*/pr-*). The utility class encodes both
    // the edge-left outer padding and the gap/2 right padding from the
    // --ds-reserves-col-gap-body CSS variable, so a single retune updates
    // every cell at once. Re-introducing raw `pl-[var(--ds-space-*)]` or
    // `pr-[var(--ds-space-*)]` here is a regression — it bypasses the
    // single-source-of-truth and lets the Token-Price gap drift below the
    // minimum-visible-gap floor.
    expect(html).toMatch(/class="[^"]*ds-reserves-cell-td-edge-l[^"]*overflow-hidden[^"]*"[^>]*>\s*<div class="flex w-full min-w-0/);
    // Anti-regression: no raw column padding (space-1 .. space-3) should leak onto a <td>.
    // The shadcn-default `[&:has([role=checkbox])]:pr-[var(--ds-space-0)]` is allowed
    // (uses space-0 and is scoped to checkbox cells); only space-1+ values are forbidden.
    expect(html).not.toMatch(/<td[^>]*\bpl-\[var\(--ds-space-(1|1-5|2|2-5|3)\)/);
    expect(html).not.toMatch(/<td[^>]*\bpr-\[var\(--ds-space-(1|1-5|2|2-5|3)\)/);
    expect(html).not.toMatch(/<td[^>]*\bpx-\[var\(--ds-space-(1|1-5|2|2-5|3)\)/);
    // (2) Inner group/token uses flex + min-w-0 (not inline-flex).
    expect(html).toMatch(/class="group\/token flex min-w-0 max-w-full/);
    // (3) Token symbol can wrap (break-words), not truncate / break-all.
    expect(html).toMatch(/<span class="font-semibold text-foreground ds-text-13 break-words min-w-0">/);
    expect(html).not.toMatch(/font-semibold text-foreground ds-text-13 truncate/);
    expect(html).not.toMatch(/font-semibold text-foreground ds-text-13 break-all/);
    // (4) Icon wrapper, snowflake wrapper, and AssetActionMenu trigger are all shrink-0.
    expect(html).toMatch(/<div class="relative inline-block rounded-full shrink-0"/);
    expect(html).toMatch(/<span[^>]*class="inline-flex shrink-0 items-center[^"]*text-sky-500 bg-sky-500\/10"/);
    // AssetActionMenu receives triggerClassName="shrink-0" which merges onto its trigger button.
    const assetMenuMatches = html.match(/<button[^>]*aria-label="Asset actions for[^"]*"[^>]*class="([^"]*)"/);
    expect(assetMenuMatches).not.toBeNull();
    expect(assetMenuMatches?.[1]).toContain('shrink-0');
  });
});
