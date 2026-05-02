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
  // Rate-model parameters are unified percent numbers (e.g., 80 = 80%); see
  // docs/api/v3-v4-precision-unification-plan.md. Components must NOT apply
  // any RAY/bps divisor when consuming these fields.
  optimalUsageRate: 80,
  variableRateSlope1: 4,
  variableRateSlope2: 60,
  baseVariableBorrowRate: 0,
  reserveFactor: 10,
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
                reserve={{ ...reserve, isFrozen: true, tokenSymbol: 'syrupUSDT' }}
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
    // [max-width:max-content] keeps the symbol's box no wider than its single-line natural width
    // so the trailing AssetActionMenu (↗) stays visually adjacent to the text on wide viewports
    // (instead of getting pushed to the cell's right edge while the wrapped text sits on the left).
    expect(html).toMatch(/<span class="font-semibold text-foreground ds-text-13 break-words min-w-0 \[max-width:max-content\]">/);
    expect(html).not.toMatch(/font-semibold text-foreground ds-text-13 truncate/);
    expect(html).not.toMatch(/font-semibold text-foreground ds-text-13 break-all/);
    // (4) Icon wrapper, snowflake wrapper, and AssetActionMenu trigger are all shrink-0.
    const iconWrapperMatch = html.match(/<div class="[^"]*rounded-full[^"]*"/);
    const iconWrapperClasses = iconWrapperMatch?.[0] ?? '';
    expect(iconWrapperClasses).toContain('relative');
    expect(iconWrapperClasses).toContain('inline-block');
    expect(iconWrapperClasses).toContain('shrink-0');
    expect(iconWrapperClasses).toContain('rounded-full');
    expect(html).toMatch(/<button[^>]*class="inline-flex shrink-0 items-center[^"]*text-sky-500 bg-sky-500\/10"/);
    // AssetActionMenu receives triggerClassName="shrink-0" which merges onto its trigger button.
    const assetMenuMatches = html.match(/<button[^>]*aria-label="Asset actions for[^"]*"[^>]*class="([^"]*)"/);
    expect(assetMenuMatches).not.toBeNull();
    expect(assetMenuMatches?.[1]).toContain('shrink-0');
    // (5) Industry-standard alignment lock — see DESIGN-SYSTEM-REFERENCE §4.3
    // 「密集表对齐策略」. Token = text-left + justify-start (identifier 起点对齐).
    // The inner flex (token block) and outer flex (with optional portfolio toggle)
    // both use justify-start so the icon hugs the cell's left edge.
    // group/token uses items-start (not items-center) so the arrow badge hugs the
    // last line of wrapped text instead of floating in the vertical center.
    expect(html).toMatch(/<td[^>]*ds-reserves-cell-td-edge-l[^"]*text-left/);
    expect(html).toMatch(/class="flex w-full min-w-0 items-center justify-start/);
    expect(html).toMatch(/class="group\/token flex min-w-0 max-w-full items-start justify-start/);
    expect(html).not.toMatch(/<td[^>]*ds-reserves-cell-td-edge-l[^"]*text-center/);
  });

  it('aligns numeric columns (Price / Supply / Spread / Borrow) to the right per industry-standard dense-table convention', () => {
    // See DESIGN-SYSTEM-REFERENCE §4.3 「密集表对齐策略」: tabular-nums
    // numeric columns should right-align so that the decimal points and
    // digit positions line up across rows (financial-table convention).
    const queryClient = new QueryClient();
    const html = renderToString(
      <QueryClientProvider client={queryClient}>
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
              />
            </TableBody>
          </Table>
        </TooltipProvider>
      </QueryClientProvider>
    );

    // Price: pure tabular number → text-right.
    expect(html).toMatch(/<td[^>]*ds-reserves-cell-td[^"]*text-right[^"]*tabular-nums[^"]*ds-text-13[^"]*"[^>]*>\$1\.00<\/td>/);
    // Supply / Borrow cells: text-right + inner column flex must use
    // `items-end` so the secondary incentive line stays vertically aligned
    // to the same right edge as the headline APY.
    expect(html).toMatch(/<td[^>]*ds-reserves-cell-td[^"]*whitespace-nowrap text-right[^>]*>\s*<div class="flex flex-col items-end justify-center/);
    expect(html).toMatch(/<td[^>]*ds-reserves-cell-td-edge-r[^"]*whitespace-nowrap text-right[^>]*>\s*<div class="flex flex-col items-end justify-center/);
    // Spread cell: text-right + single span (no internal stack).
    expect(html).toMatch(/<td[^>]*ds-reserves-cell-td[^"]*whitespace-nowrap text-right[^>]*hidden md:table-cell[^>]*>\s*<span/);
    // Size cell: text-right + items-end (numeric stack right-aligned).
    expect(html).toMatch(/<td[^>]*ds-reserves-cell-td[^"]*whitespace-nowrap text-right[^>]*hidden md:table-cell[^"]*tabular-nums[^>]*>\s*<div class="flex flex-col items-end/);
    // Util cell: text-right + inline-flex justify-end (bar prefix + numeric stack right-aligned).
    expect(html).toMatch(/<td[^>]*ds-reserves-cell-td[^"]*whitespace-nowrap text-right[^>]*hidden md:table-cell[^"]*tabular-nums[^>]*>\s*<div class="inline-flex items-center justify-end/);
    // Anti-regression: numeric cells must NOT silently drift back to text-center.
    expect(html).not.toMatch(/<td[^>]*ds-reserves-cell-td[^"]*tabular-nums[^"]*text-center[^"]*"[^>]*>\$/);
    expect(html).not.toMatch(/<td[^>]*ds-reserves-cell-td-edge-r[^"]*text-center/);
    // Anti-regression: Size + Util can't drift back to text-center either now that
    // they're right-aligned per the industry-standard alignment contract.
    expect(html).not.toMatch(/<td[^>]*ds-reserves-cell-td[^"]*tabular-nums[^"]*text-center[^"]*hidden md:table-cell/);
  });

  it('renders a 12×12 transparent ring placeholder on Size rows without cap so numbers stay in the same column', () => {
    // Regression guard: Size column mixes rows with `CapProgressRing` /
    // `BorrowCapProgressRing` (which take 12 px ring + 6 px gap on the right
    // of the number) and rows without caps. Without a placeholder, the
    // numeric column shifts horizontally row-to-row, breaking the tabular-num
    // grid. The fallback branch must render `<span aria-hidden class="inline-block w-3 h-3 shrink-0" />`.
    const queryClient = new QueryClient();
    const reserveWithoutCaps: ReserveWithSpread = {
      ...reserve,
      supplyCapUsd: null,
      borrowCapUsd: null,
    };
    const html = renderToString(
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Table>
            <TableBody>
              <DesktopReserveRow
                reserve={reserveWithoutCaps}
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

    // Two placeholders: one for Supply row (no supply cap), one for Borrow row
    // (no borrow cap). Each is `inline-block w-3 h-3 shrink-0`, aria-hidden.
    const placeholderMatches = html.match(/<span aria-hidden="true" class="inline-block w-3 h-3 shrink-0"/g) ?? [];
    expect(placeholderMatches.length).toBeGreaterThanOrEqual(2);
  });

  it('treats reserve.optimalUsageRate as a percent number (not RAY) when sizing the UtilizationIndicator', () => {
    // Regression guard for the V3/V4 precision-unification migration:
    // After the backend switched optimalUsageRate from RAY/bps strings to
    // percent numbers (e.g., 80 = 80%), the desktop row used to divide the
    // value by `1e25` to convert RAY → percent. With unified percent input
    // that division turned every "Optimal" marker into ~0, making the
    // utilization SVG always render as fully amber and breaking the
    // current-vs-optimal comparison.
    //
    // UtilizationIndicator math (height = 24):
    //     optimalY  = height − (optimalPct / 100) × height
    //                = 24 − (80/100) × 24 = 4.8
    //     belowZoneHeight = height − optimalY = 19.2
    //
    // If a future change re-introduces a RAY/bps divisor, optimalPct would
    // collapse to ~0 and the SVG would emit `y="24"` / cyan-zone-height="0"
    // instead, failing this assertion.
    const queryClient = new QueryClient();
    const html = renderToString(
      <QueryClientProvider client={queryClient}>
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
              />
            </TableBody>
          </Table>
        </TooltipProvider>
      </QueryClientProvider>
    );

    // Extract every numeric `y="..."` and `height="..."` in the SVG output.
    const yValues = [...html.matchAll(/\by="([\d.]+)"/g)].map((m) => Number(m[1]));
    const heightValues = [...html.matchAll(/\bheight="([\d.]+)"/g)].map((m) => Number(m[1]));

    // Optimal mapped to y ≈ 4.8 (24 − 0.8×24). Allow ±0.05 tolerance for floating-point drift.
    const hasOptimalY = yValues.some((y) => Math.abs(y - 4.8) < 0.05);
    expect(hasOptimalY, `expected an SVG y≈4.8 for optimal=80, got y=${yValues.join(',')}`).toBe(true);

    // Below-optimal cyan zone has height ≈ 19.2 (24 − 4.8).
    const hasCyanZoneHeight = heightValues.some((h) => Math.abs(h - 19.2) < 0.05);
    expect(hasCyanZoneHeight, `expected SVG height≈19.2 for cyan zone (optimal=80), got heights=${heightValues.join(',')}`).toBe(true);

    // Anti-regression: if a RAY divisor (1e25) sneaks back in, optimalPct → 0,
    // y → 24, and below-optimal height → 0. Assert neither pathological value
    // appears alongside the optimal indicator.
    const dangerousYExists = yValues.filter((y) => y === 24).length;
    expect(dangerousYExists, 'SVG must not render the bug-state y=24 (which means optimal collapsed to 0%)').toBe(0);
  });
});
