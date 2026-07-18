/**
 * PortfolioUnifiedTable v7 — one row per reserve, both sides inline.
 *
 * Width strategy: table-layout:auto.
 * Reserve col uses width:1px — in auto layout, the browser still sizes it to
 * content (auto always fits content, never truncates), but the 1px "claim"
 * means it absorbs almost zero extra space. Input cols share remaining space
 * equally (50% each) via colgroup hint. Other cols have fixed px widths.
 *
 * Columns (12):
 *   0  Reserve           1px  (content-adaptive, no extra space)
 *   1  Supply Input     auto (absorbs remaining space)
 *   2  Borrow Input     auto (absorbs remaining space)
 *   3  Supply Native    62px
 *   4  Borrow Native    62px
 *   5  Supply Incent    62px
 *   6  Borrow Incent    62px
 *   7  Supply Total     62px
 *   8  Borrow Total     62px
 *   9  Supply $/day     68px
 *  10  Borrow $/day     68px
 *  11  Net $/day        72px
 *
 * Typography: ds-text-12 (12px) for table body — the DESIGN.md "Data" tier
 * is 13px, but 12 columns at 13px overflow the typical container. 12px is the
 * design system's compact-data tier; headers use ds-text-11 (Label tier).
 *
 * Metric values with simulation changes get a dotted underline + tooltip
 * (before→after+delta). No extra marker — the underline is the affordance.
 *
 * Cap warnings are inline colored dots with tooltips.
 * Sub-headers show "Supply"/"Borrow" full text on large screens, "S"/"B"
 * abbreviation on small screens (responsive span swap).
 *
 * Wallet display (Option E modified): wallet value shown as full-precision
 * non-editable text outside the input, with → arrow when modified.
 * The ± sign toggle button stays inside the input for interaction.
 *
 * Banded cluster rule: ALL per-side columns (Input, Native, Incentive, Total,
 * $/day) carry semantic band tints (emerald=Supply, cyan=Borrow). Only the
 * Net $/day column (cross-side aggregate) uses neutral HEADER_BASE. This
 * creates a consistent visual rhythm: every Supply cell is emerald-tinted,
 * every Borrow cell is cyan-tinted, regardless of which module group it's in.
 */
import { memo } from 'react';
import { Minus, EyeOff, Snowflake, PauseCircle, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPercent, formatReserveSizeUsd, formatSignedReserveSizeUsd } from '@/lib/formatters';
import ReserveIdentity from '@/components/primitives/ReserveIdentity';
import { PORTFOLIO_THEME } from './portfolioTheme';
import type {
  PortfolioReserveEntry,
  PortfolioPositionResult,
  PortfolioSummary,
} from '@/types/portfolio';
import type { PortfolioSimulationActions } from '@/hooks/usePortfolioSimulation';
import type { ReserveWithSpread } from '@/types/aave';
import type { PortfolioCapWarning } from '@/lib/portfolioCapWarnings';
import { isSupplyDisabled, isBorrowDisabled } from '@/lib/reserveStatus';
import {
  CompactInput,
  MetricValue,
  WarningMarker,
} from './PortfolioTablePrimitives';

/* ── Column geometry ─────────────────────────────────────────────── */

// table-layout:auto. Reserve col uses width:1px trick — browser sizes it
// to content (auto layout always fits content, never truncates) but the 1px
// claim means it absorbs almost zero extra space. Input cols have no width
// → they absorb all remaining space. Other cols have fixed px widths.
const COL_WIDTHS = [
  '1px',         // 0  Reserve — content-adaptive, no extra space claim
  '50%',         // 1  Supply Input — equal share with Borrow Input (auto layout hint)
  '50%',         // 2  Borrow Input — equal share with Supply Input (auto layout hint)
  '62px',        // 3  Supply Native
  '62px',        // 4  Borrow Native
  '62px',        // 5  Supply Incent
  '62px',        // 6  Borrow Incent
  '62px',        // 7  Supply Total
  '62px',        // 8  Borrow Total
  '68px',        // 9  Supply $/day
  '68px',        // 10 Borrow $/day
  '72px',        // 11 Net $/day
] as const;

function UnifiedColgroup() {
  return (
    <colgroup>
      {COL_WIDTHS.map((w, i) => (
        <col key={i} style={w ? { width: w } : undefined} />
      ))}
    </colgroup>
  );
}

/* ── Shared cell padding tokens ──────────────────────────────────── */

// DESIGN.md: Data tier = 13px, but 12-col compact table uses 12px (ds-text-12)
// to fit without overflow. Headers use ds-text-11 (Label tier).
const TABLE_TEXT = 'ds-text-12';
const VAL_CELL = cn('px-1.5 py-1 text-right tabular-nums whitespace-nowrap', TABLE_TEXT);
const INPUT_CELL = 'px-1 py-1';
// Last column gets extra right padding for breathing space
const LAST_CELL = cn('pr-2 pl-1.5 py-1 text-right tabular-nums whitespace-nowrap', TABLE_TEXT);

/* ── Header bands (semantic tint) ────────────────────────────────── */

// Per DESIGN-SYSTEM-REFERENCE §3: semantic colors (emerald/cyan) are reserved
// for their designated concept (Supply/Borrow). Group-level header tints use
// neutral HEADER_BASE — only per-column body bands carry semantic color.
const SUPPLY_BAND = 'bg-emerald-500/10 dark:bg-emerald-500/12 group-hover:bg-emerald-500/16';
const BORROW_BAND = 'bg-cyan-500/10 dark:bg-cyan-500/12 group-hover:bg-cyan-500/16';
const HEADER_BASE = 'bg-muted/40';

const SUPPLY_COLOR = 'ds-text-emerald-600';
const BORROW_COLOR = 'ds-text-brand-cyan';

// Group separator border — stronger than row borders to create clear visual
// hierarchy between module groups (Input / Native / Incentive / Total / Earn).
// At /60: dark mode effective L15.6 (Δ9.6 from bg L6), light mode L89.2 (Δ10.8
// from bg L100). Row separator stays at /30 (Δ~5), creating a 2× hierarchy.
const GROUP_SEP = 'border-l border-border/60';

// Supply → Borrow separator within each module group.
// Lighter than GROUP_SEP (module boundary) but visible enough to distinguish sides.
// At /40: dark mode Δ7.2, light mode Δ7.6 — between GROUP_SEP (/60, Δ10) and row (/30, Δ5).
const SIDE_SEP = 'border-l border-border/40';

/* ── Main component ──────────────────────────────────────────────── */

interface PortfolioUnifiedTableProps {
  entries: PortfolioReserveEntry[];
  actions: PortfolioSimulationActions;
  reserves: ReserveWithSpread[];
  positionResults?: PortfolioPositionResult[];
  summary?: PortfolioSummary;
  capWarningsMap?: Map<string, { supply?: PortfolioCapWarning[]; borrow?: PortfolioCapWarning[] }>;
}

const PortfolioUnifiedTable = memo(function PortfolioUnifiedTable({
  entries,
  actions,
  reserves,
  positionResults,
  summary,
  capWarningsMap,
}: PortfolioUnifiedTableProps) {
  if (entries.length === 0) return null;

  const reserveIdToReserve = new Map(reserves.map(r => [r.reserveId, r]));

  const resultMap = new Map<string, { supply?: PortfolioPositionResult; borrow?: PortfolioPositionResult }>();
  if (positionResults) {
    for (const r of positionResults) {
      const existing = resultMap.get(r.reserveId) ?? {};
      if (r.side === 'supply') existing.supply = r;
      else existing.borrow = r;
      resultMap.set(r.reserveId, existing);
    }
  }

  const hasForecastUnavailable = positionResults?.some(r => (r.forecastUnavailableCampaignCount ?? 0) > 0) ?? false;

  return (
    <div className="rounded-lg border border-border/50 overflow-x-auto">
      <table className={cn('w-full [&_tbody_td]:transition-colors', TABLE_TEXT)} style={{ tableLayout: 'auto' }}>
        <UnifiedColgroup />
        <thead>
          <tr className="text-muted-foreground border-b border-border/50">
            <th rowSpan={2} className={cn('pl-2 pr-3 py-1 text-center font-semibold', HEADER_BASE)}>Reserve</th>
            <th colSpan={2} className={cn('px-1 py-1 text-center font-semibold', GROUP_SEP, HEADER_BASE)}>Input</th>
            <th colSpan={2} className={cn('px-1 py-1 text-center font-semibold', GROUP_SEP, HEADER_BASE)}>Native</th>
            <th colSpan={2} className={cn('px-1 py-1 text-center font-semibold', GROUP_SEP, HEADER_BASE)}>Incentive</th>
            <th colSpan={2} className={cn('px-1 py-1 text-center font-semibold', GROUP_SEP, HEADER_BASE)}>Total</th>
            <th colSpan={3} className={cn('px-1 py-1 text-center font-semibold', GROUP_SEP, HEADER_BASE)}>Earn $/day</th>
          </tr>
          <tr className="text-muted-foreground border-b border-border/50">
            <th className={cn('px-1 py-0.5 text-right font-medium', GROUP_SEP, 'ds-text-11', HEADER_BASE, SUPPLY_COLOR)}><span className="hidden lg:inline">Supply</span><span className="lg:hidden">S</span></th>
            <th className={cn('px-1 py-0.5 text-right font-medium ds-text-11', SIDE_SEP, HEADER_BASE, BORROW_COLOR)}><span className="hidden lg:inline">Borrow</span><span className="lg:hidden">B</span></th>
            <th className={cn('px-1 py-0.5 text-right font-medium', GROUP_SEP, 'ds-text-11', HEADER_BASE, SUPPLY_COLOR)}><span className="hidden lg:inline">Supply</span><span className="lg:hidden">S</span></th>
            <th className={cn('px-1 py-0.5 text-right font-medium ds-text-11', SIDE_SEP, HEADER_BASE, BORROW_COLOR)}><span className="hidden lg:inline">Borrow</span><span className="lg:hidden">B</span></th>
            <th className={cn('px-1 py-0.5 text-right font-medium', GROUP_SEP, 'ds-text-11', HEADER_BASE, SUPPLY_COLOR)}><span className="hidden lg:inline">Supply</span><span className="lg:hidden">S</span></th>
            <th className={cn('px-1 py-0.5 text-right font-medium ds-text-11', SIDE_SEP, HEADER_BASE, BORROW_COLOR)}><span className="hidden lg:inline">Borrow</span><span className="lg:hidden">B</span></th>
            <th className={cn('px-1 py-0.5 text-right font-medium', GROUP_SEP, 'ds-text-11', HEADER_BASE, SUPPLY_COLOR)}><span className="hidden lg:inline">Supply</span><span className="lg:hidden">S</span></th>
            <th className={cn('px-1 py-0.5 text-right font-medium ds-text-11', SIDE_SEP, HEADER_BASE, BORROW_COLOR)}><span className="hidden lg:inline">Borrow</span><span className="lg:hidden">B</span></th>
            <th className={cn('px-1 py-0.5 text-right font-medium', GROUP_SEP, 'ds-text-11', HEADER_BASE, SUPPLY_COLOR)}><span className="hidden lg:inline">Supply</span><span className="lg:hidden">S</span></th>
            <th className={cn('px-1 py-0.5 text-right font-medium ds-text-11', SIDE_SEP, HEADER_BASE, BORROW_COLOR)}><span className="hidden lg:inline">Borrow</span><span className="lg:hidden">B</span></th>
            <th className={cn('px-1 py-0.5 pr-2 text-right font-semibold', GROUP_SEP, HEADER_BASE)}>Net</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const reserve = reserveIdToReserve.get(entry.reserveId);
            const tokenPriceInUsd = reserve?.tokenPrice;
            const results = resultMap.get(entry.reserveId);
            const supplyResult = results?.supply;
            const borrowResult = results?.borrow;

            const isHidden = entry.hidden;
            const isRestricted = entry.restrictedStatus != null;

            const disabledNotice = reserve ? {
              supply: reserve.isPaused ? 'Paused' : isSupplyDisabled(reserve) ? 'Supply unavailable' : null,
              borrow: reserve.isPaused ? 'Paused' : isBorrowDisabled(reserve) ? 'Borrow unavailable' : null,
            } : { supply: 'Reserve unavailable', borrow: 'Reserve unavailable' };

            const supplyCapLimitUsd = capWarningsMap?.get(entry.reserveId)?.supply?.find(w => w.kind === 'protocol_cap')?.adjustToUsd;
            const borrowCapLimitUsd = capWarningsMap?.get(entry.reserveId)?.borrow?.find(w => w.kind === 'protocol_cap')?.adjustToUsd;
            const supplyWarnings = capWarningsMap?.get(entry.reserveId)?.supply ?? [];
            const borrowWarnings = capWarningsMap?.get(entry.reserveId)?.borrow ?? [];

            // Split warnings: protocol caps go on Input columns, incentive caps/offsets go on Incentive columns
            const supplyInputWarns = supplyWarnings.filter(w => w.kind === 'protocol_cap');
            const supplyIncentWarns = supplyWarnings.filter(w => w.kind === 'incentive_cap' || w.kind === 'incentive_offset');
            const borrowInputWarns = borrowWarnings.filter(w => w.kind === 'protocol_cap');
            const borrowIncentWarns = borrowWarnings.filter(w => w.kind === 'incentive_cap' || w.kind === 'incentive_offset');

            const hasWallet = entry.supply.walletValue !== null || entry.borrow.walletValue !== null;

            const handleMinusClick = () => {
              if (isHidden) actions.unhideReserve(entry.reserveId);
              else if (hasWallet) actions.hideReserve(entry.reserveId);
              else actions.removeReserve(entry.reserveId);
            };

            const restrictedIcon = (() => {
              switch (entry.restrictedStatus) {
                case 'frozen': return <Snowflake className="size-2.5 text-sky-500" aria-hidden />;
                case 'paused': return <PauseCircle className="size-2.5 ds-text-paused" aria-hidden />;
                case 'inactive': return <Ban className="size-2.5 ds-text-paused" aria-hidden />;
                default: return null;
              }
            })();

            const rowOpacity = isHidden ? 'opacity-40' : entry.isOrphan ? 'opacity-60' : '';

            return (
              <tr
                key={entry.reserveId}
                data-reserve-id={entry.reserveId}
                className={cn('group border-t border-border/30 hover:bg-muted/5', rowOpacity)}
                onClick={isHidden && !isRestricted ? () => actions.unhideReserve(entry.reserveId) : undefined}
              >
                {/* Reserve */}
                <td data-cell="reserve" className={cn('pl-2 pr-3 py-1', isHidden && 'cursor-pointer')}>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); if (!isRestricted) handleMinusClick(); }}
                      className={cn(
                        'shrink-0 rounded p-0.5 text-muted-foreground/60 transition-colors',
                        !isRestricted && PORTFOLIO_THEME.trashHoverBg,
                        !isRestricted && PORTFOLIO_THEME.trashHoverText,
                      )}
                      aria-label={isRestricted ? `${entry.tokenSymbol} is restricted` : isHidden ? `Restore ${entry.tokenSymbol}` : `Remove ${entry.tokenSymbol}`}
                    >
                      {isRestricted ? restrictedIcon : isHidden ? <EyeOff className="size-2.5" strokeWidth={2.5} aria-hidden /> : <Minus className="size-2.5" strokeWidth={2.5} aria-hidden />}
                    </button>
                    <ReserveIdentity
                      tokenSymbol={entry.tokenSymbol}
                      chainId={entry.chainId}
                      chainName={entry.chainName}
                      marketName={entry.marketName}
                      hubName={entry.hubName}
                      variant="stacked"
                      disabled={isHidden}
                    />
                  </div>
                </td>

                {/* Supply Input */}
                <td data-cell="supply-input" className={cn(INPUT_CELL, GROUP_SEP, SUPPLY_BAND)}>
                  <div className="flex items-center gap-0.5">
                    <div className="flex-1 min-w-[7rem]">

                      <CompactInput
                        sideData={entry.supply}
                        side="supply"
                        tokenSymbol={entry.tokenSymbol}
                        tokenPriceInUsd={tokenPriceInUsd}
                        reserveId={entry.reserveId}
                        actions={actions}
                        disabled={!!disabledNotice.supply}
                        disabledNotice={disabledNotice.supply}
                        capLimitUsd={supplyCapLimitUsd}
                      />
                    </div>
                    {supplyInputWarns.length > 0 && <WarningMarker warnings={supplyInputWarns} />}
                  </div>
                </td>

                {/* Borrow Input */}
                <td data-cell="borrow-input" className={cn(INPUT_CELL, SIDE_SEP, BORROW_BAND)}>
                  <div className="flex items-center gap-0.5">
                    <div className="flex-1 min-w-[7rem]">
                      <CompactInput
                        sideData={entry.borrow}
                        side="borrow"
                        tokenSymbol={entry.tokenSymbol}
                        tokenPriceInUsd={tokenPriceInUsd}
                        reserveId={entry.reserveId}
                        actions={actions}
                        disabled={!!disabledNotice.borrow}
                        disabledNotice={disabledNotice.borrow}
                        capLimitUsd={borrowCapLimitUsd}
                      />
                    </div>
                    {borrowInputWarns.length > 0 && <WarningMarker warnings={borrowInputWarns} />}
                  </div>
                </td>

                {/* Supply Native */}
                <td data-cell="supply-native" className={cn(VAL_CELL, GROUP_SEP, SUPPLY_BAND, SUPPLY_COLOR)}>
                  {supplyResult ? <MetricValue afterValue={supplyResult.nativePercent} metric={supplyResult.nativeMetric} formatFn={formatPercent} /> : '—'}
                </td>
                {/* Borrow Native */}
                <td data-cell="borrow-native" className={cn(VAL_CELL, SIDE_SEP, BORROW_BAND, BORROW_COLOR)}>
                  {borrowResult ? <MetricValue afterValue={borrowResult.nativePercent} metric={borrowResult.nativeMetric} formatFn={formatPercent} /> : '—'}
                </td>

                {/* Supply Incentive */}
                <td data-cell="supply-incentive" className={cn(VAL_CELL, GROUP_SEP, SUPPLY_BAND, SUPPLY_COLOR)}>
                  <span className="inline-flex items-center gap-0.5 justify-end">
                    {supplyResult ? (
                      <>
                        <MetricValue afterValue={supplyResult.incentivePercent} metric={supplyResult.incentiveMetric} formatFn={formatPercent} />
                        {supplyResult.forecastUnavailableCampaignCount != null && supplyResult.forecastUnavailableCampaignCount > 0 && (
                          <span className="ds-text-9 text-muted-foreground" title="No forecast">*</span>
                        )}
                      </>
                    ) : '—'}
                    {supplyIncentWarns.length > 0 && <WarningMarker warnings={supplyIncentWarns} />}
                  </span>
                </td>
                {/* Borrow Incentive */}
                <td data-cell="borrow-incentive" className={cn(VAL_CELL, SIDE_SEP, BORROW_BAND, BORROW_COLOR)}>
                  <span className="inline-flex items-center gap-0.5 justify-end">
                    {borrowResult ? (
                      <>
                        <MetricValue afterValue={borrowResult.incentivePercent} metric={borrowResult.incentiveMetric} formatFn={formatPercent} />
                        {borrowResult.forecastUnavailableCampaignCount != null && borrowResult.forecastUnavailableCampaignCount > 0 && (
                          <span className="ds-text-9 text-muted-foreground" title="No forecast">*</span>
                        )}
                      </>
                    ) : '—'}
                    {borrowIncentWarns.length > 0 && <WarningMarker warnings={borrowIncentWarns} />}
                  </span>
                </td>

                {/* Supply Total */}
                <td data-cell="supply-total" className={cn(VAL_CELL, GROUP_SEP, 'font-bold', SUPPLY_BAND, SUPPLY_COLOR)}>
                  {supplyResult ? <MetricValue afterValue={supplyResult.totalPercent} metric={supplyResult.totalMetric} formatFn={formatPercent} /> : '—'}
                </td>
                {/* Borrow Total */}
                <td data-cell="borrow-total" className={cn(VAL_CELL, SIDE_SEP, 'font-bold', BORROW_BAND, BORROW_COLOR)}>
                  {borrowResult ? <MetricValue afterValue={borrowResult.totalPercent} metric={borrowResult.totalMetric} formatFn={formatPercent} /> : '—'}
                </td>

                {/* Supply $/day */}
                <td data-cell="supply-usd-per-day" className={cn(VAL_CELL, GROUP_SEP, SUPPLY_BAND, SUPPLY_COLOR)}>
                  {supplyResult ? (supplyResult.usdPerDay === 0 ? '—' : formatSignedReserveSizeUsd(supplyResult.usdPerDay)) : '—'}
                </td>
                {/* Borrow $/day */}
                <td data-cell="borrow-usd-per-day" className={cn(VAL_CELL, SIDE_SEP, BORROW_BAND, BORROW_COLOR)}>
                  {borrowResult ? (borrowResult.usdPerDay === 0 ? '—' : formatSignedReserveSizeUsd(borrowResult.usdPerDay)) : '—'}
                </td>
                {/* Net $/day */}
                <td data-cell="net-usd-per-day" className={cn(LAST_CELL, GROUP_SEP, 'font-bold', 'text-foreground', 'bg-muted/15')}>
                  {(() => {
                    const s = supplyResult?.usdPerDay ?? 0;
                    const b = borrowResult?.usdPerDay ?? 0;
                    const net = s + b;
                    return net === 0 ? '—' : formatSignedReserveSizeUsd(net);
                  })()}
                </td>
              </tr>
            );
          })}
        </tbody>
        {summary && entries.length > 1 && (
          <tfoot>
            <tr className="border-t-2 border-border/60 bg-muted/30">
              <td className="pl-2 pr-3 py-1.5 font-bold ds-text-11 text-center">Total</td>
              <td className={cn(VAL_CELL, GROUP_SEP, 'font-bold', SUPPLY_COLOR)}>{formatReserveSizeUsd(summary.totalSupplyUsd)}</td>
              <td className={cn(VAL_CELL, SIDE_SEP, 'font-bold', BORROW_COLOR)}>{formatReserveSizeUsd(summary.totalBorrowUsd)}</td>
              <td className={cn(VAL_CELL, GROUP_SEP)} />
              <td className={cn(VAL_CELL, SIDE_SEP)} />
              <td className={cn(VAL_CELL, GROUP_SEP)} />
              <td className={cn(VAL_CELL, SIDE_SEP)} />
              <td className={cn(VAL_CELL, GROUP_SEP, 'font-bold', SUPPLY_COLOR)} title="Weighted average">
                {formatPercent(summary.supplyWeightedApy)}
              </td>
              <td className={cn(VAL_CELL, SIDE_SEP, 'font-bold', BORROW_COLOR)} title="Weighted average">
                {formatPercent(summary.borrowWeightedApy)}
              </td>
              <td className={cn(VAL_CELL, GROUP_SEP, SUPPLY_COLOR)}>{summary.supplyUsdPerDay === 0 ? '—' : formatSignedReserveSizeUsd(summary.supplyUsdPerDay)}</td>
              <td className={cn(VAL_CELL, SIDE_SEP, BORROW_COLOR)}>{summary.borrowUsdPerDay === 0 ? '—' : formatSignedReserveSizeUsd(summary.borrowUsdPerDay)}</td>
              <td className={cn(LAST_CELL, GROUP_SEP, 'font-bold', 'text-foreground')}>{summary.netUsdPerDay === 0 ? '—' : formatSignedReserveSizeUsd(summary.netUsdPerDay)}</td>
            </tr>
          </tfoot>
        )}
      </table>
      {hasForecastUnavailable && (
        <p className="ds-text-9 text-muted-foreground px-2 py-1 border-t border-border/30">
          * No forecast data — using current APR.
        </p>
      )}
    </div>
  );
});

export default PortfolioUnifiedTable;
