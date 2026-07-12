/**
 * PortfolioUnifiedTable v7 — one row per reserve, both sides inline.
 *
 * Width strategy: table = width:100% + table-layout:fixed.
 * ALL columns have explicit px widths on <col>. When the sum of column
 * widths < container width, the browser distributes the extra space
 * proportionally across all columns — no single column hogs the remainder.
 * This ensures the table ALWAYS fills its container, regardless of width.
 *
 * Columns (12):
 *   0  Token           120px
 *   1  Supply Input     88px
 *   2  Borrow Input     88px
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
 * Toggle via ?unified=1 in PortfolioPanel.
 */
import { memo, useCallback, useRef } from 'react';
import { Eraser, Minus, EyeOff, Snowflake, PauseCircle, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatNumberInput, parseNumberInput } from '@/lib/numberFormat';
import { formatConvertedAmount } from '@/lib/portfolioCalculator';
import { cnDsInputSurface } from '@/lib/dsInputSurface';
import { formatPercent, formatUsd } from '@/lib/formatters';
import { TokenIcon } from '@/components/primitives/TokenIcon';
import { getChainIconSrc } from '@/lib/chainIcons';
import { getMarketChipLabel, isV4Market, getHubChipClass } from '@/lib/marketLabels';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useDebouncedInput } from '@/hooks/useDebouncedInput';
import { PORTFOLIO_THEME } from './portfolioTheme';
import type {
  PortfolioReserveEntry,
  PortfolioSideData,
  PortfolioInputMode,
  DeltaSign,
  PortfolioPositionResult,
  PortfolioSummary,
} from '@/types/portfolio';
import type { PortfolioSimulationActions } from '@/hooks/usePortfolioSimulation';
import type { ReserveWithSpread } from '@/types/aave';
import {
  formatProtocolCapText,
  type IncentiveCapWarning,
  type IncentiveOffsetWarning,
  type PortfolioCapWarning,
} from '@/lib/portfolioCapWarnings';
import { isSupplyDisabled, isBorrowDisabled } from '@/lib/reserveStatus';

const DELTA_EPSILON = 0.005;

/* ── Column geometry ─────────────────────────────────────────────── */

// All columns have explicit px widths. With width:100% + table-layout:fixed,
// the browser scales columns proportionally to fill the container — no single
// column absorbs all remaining space, and the table always fills its container.
const COL_WIDTHS = [
  '120px',    // 0  Token
  '88px',     // 1  Supply Input
  '88px',     // 2  Borrow Input
  '62px',     // 3  Supply Native
  '62px',     // 4  Borrow Native
  '62px',     // 5  Supply Incent
  '62px',     // 6  Borrow Incent
  '62px',     // 7  Supply Total
  '62px',     // 8  Borrow Total
  '68px',     // 9  Supply $/day
  '68px',     // 10 Borrow $/day
  '72px',     // 11 Net $/day
] as const;

function UnifiedColgroup() {
  return (
    <colgroup>
      {COL_WIDTHS.map((w, i) => (
        <col key={i} style={{ width: w }} />
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

/* ── Metric value with simulation tooltip ───────────────────────── */

/**
 * Displays a metric value. When the simulation changed it (current → after),
 * the value gets a dotted underline and a hover tooltip showing the change.
 * This gives users the current/after context that was missing when we removed
 * the delta column.
 */
function MetricValue({
  afterValue,
  metric,
  formatFn,
}: {
  afterValue: number;
  metric?: { current: number | null; after: number | null; delta: number | null };
  formatFn: (v: number) => string;
}) {
  const hasChange = metric?.current != null && metric.after != null
    && Math.abs(metric.current - metric.after) >= 0.005;

  if (!hasChange) {
    return <>{formatFn(afterValue)}</>;
  }

  const delta = metric!.delta ?? (metric!.after! - metric!.current!);
  const deltaStr = delta >= 0 ? `+${delta.toFixed(2)}%` : `${delta.toFixed(2)}%`;
  const deltaColor = delta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="underline decoration-dotted underline-offset-2 cursor-help">
          {formatFn(afterValue)}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="ds-text-11">
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Current</span>
          <span className="tabular-nums">{formatFn(metric!.current!)}</span>
          <span className="text-muted-foreground">→</span>
          <span className="font-semibold tabular-nums">{formatFn(metric!.after!)}</span>
          <span className={cn('tabular-nums font-semibold', deltaColor)}>{deltaStr}</span>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

/* ── Formatting helpers ──────────────────────────────────────────── */

function formatUsdCompact(value: number): string {
  if (value === 0) return '$0';
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

function formatUsdDay(value: number): string {
  if (value < 0) return `-$${Math.abs(value).toFixed(2)}`;
  if (value > 0) return `+$${value.toFixed(2)}`;
  return '$0';
}

/** Display $/day as '—' when zero, formatted otherwise. */
function formatUsdDayOrDash(value: number | undefined | null): string {
  if (value == null || value === 0) return '—';
  return formatUsdDay(value);
}

/* ── Inline warning marker (tooltip-only) ────────────────────────── */

/**
 * Small colored dot with tooltip — shows full warning text on hover.
 * Less visually aggressive than ⚠ triangle; standard in financial UIs
 * for inline annotations. Amber = binding cap, muted = informational.
 */
function WarningMarker({ warnings }: { warnings: PortfolioCapWarning[] }) {
  if (warnings.length === 0) return null;

  const hasAmber = warnings.some(w => {
    if (w.kind === 'protocol_cap') return true;
    const notes = w.kind === 'incentive_cap' ? (w as IncentiveCapWarning).notes : (w as IncentiveOffsetWarning).notes;
    return notes?.some(n => n.color === 'amber');
  });

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'inline-flex shrink-0 cursor-help align-middle',
            hasAmber ? 'text-amber-500 dark:text-amber-400' : 'text-muted-foreground',
          )}
        >
          <span
            className={cn(
              'inline-block size-1.5 rounded-full',
              hasAmber ? 'bg-amber-500 dark:bg-amber-400' : 'bg-muted-foreground/60',
            )}
            aria-label="Cap warning"
          />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="ds-text-11 max-w-[320px]">
        <div className="flex flex-col gap-1">
          {warnings.map((w, i) => {
            if (w.kind === 'protocol_cap') {
              const label = formatProtocolCapText({
                side: w.side,
                availableFormatted: formatUsd(w.adjustToUsd),
                limitedByLiquidity: w.limitedByLiquidity,
              });
              return (
                <div key={i} className="flex items-start gap-1">
                  <span className={cn('font-semibold shrink-0', w.side === 'supply' ? SUPPLY_COLOR : BORROW_COLOR)}>
                    {w.side === 'supply' ? 'Supply' : 'Borrow'}
                  </span>
                  <span className="text-amber-600 dark:text-amber-400">{label}</span>
                </div>
              );
            }
            const notes = w.kind === 'incentive_cap' ? (w as IncentiveCapWarning).notes : (w as IncentiveOffsetWarning).notes;
            const source = w.kind === 'incentive_cap' ? (w as IncentiveCapWarning).source : (w as IncentiveOffsetWarning).source;
            return (
              <div key={i} className="flex flex-col gap-0.5">
                <span className={cn('font-semibold', w.side === 'supply' ? SUPPLY_COLOR : BORROW_COLOR)}>
                  {w.side === 'supply' ? 'Supply' : 'Borrow'} · {source}
                </span>
                {notes?.map((note, ni) => (
                  <span key={ni} className={note.color === 'amber' ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}>
                    {note.text}
                  </span>
                ))}
              </div>
            );
          })}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

/* ── Compact table input ─────────────────────────────────────────── */

interface CompactInputProps {
  sideData: PortfolioSideData;
  side: 'supply' | 'borrow';
  tokenSymbol: string;
  tokenPriceInUsd?: number;
  reserveId: string;
  actions: PortfolioSimulationActions;
  disabled?: boolean;
  disabledNotice?: string | null;
  capLimitUsd?: number;
}

function CompactInput({
  sideData,
  side,
  tokenSymbol,
  tokenPriceInUsd,
  reserveId,
  actions,
  disabled,
  disabledNotice,
  capLimitUsd,
}: CompactInputProps) {
  const isBorrow = side === 'borrow';
  const inputVariant = isBorrow ? 'borrow' as const : 'supply' as const;
  const hasWallet = sideData.walletValue !== null;

  const deltaDisplay = hasWallet
    ? (sideData.deltaRawUsd !== undefined
      ? formatNumberInput(formatConvertedAmount(Math.abs(sideData.deltaRawUsd)))
      : (() => {
          const effectiveUsd = sideData.inputMode === 'usd'
            ? parseNumberInput(sideData.amount)
            : parseNumberInput(sideData.amount) * (tokenPriceInUsd ?? 0);
          const deltaUsd = effectiveUsd - sideData.walletValue!;
          if (Math.abs(deltaUsd) < DELTA_EPSILON) return '';
          return formatNumberInput(formatConvertedAmount(Math.abs(deltaUsd)));
        })())
    : sideData.amount;

  const hasValue = Boolean(deltaDisplay.trim());
  const isPositiveDelta = hasWallet ? (sideData.deltaSign ?? 1) === 1 : true;

  const deltaCommitRef = useRef({ initialHasValue: hasValue });
  if (deltaCommitRef.current.initialHasValue !== hasValue) {
    deltaCommitRef.current = { initialHasValue: hasValue };
  }

  const handleDeltaCommit = useCallback((formattedValue: string) => {
    if (!formattedValue.trim()) {
      if (!deltaCommitRef.current.initialHasValue) return;
      if (!hasWallet) {
        actions.updateReserve(reserveId, side === 'supply' ? { supplyAmount: '' } : { borrowAmount: '' });
        return;
      }
      const resetAmount = formatConvertedAmount(sideData.walletValue!);
      const clearPatch = side === 'supply'
        ? { supplyAmount: resetAmount, supplyDeltaSign: 1 as DeltaSign, supplyDeltaRawUsd: null as number | null }
        : { borrowAmount: resetAmount, borrowDeltaSign: 1 as DeltaSign, borrowDeltaRawUsd: null as number | null };
      actions.updateReserve(reserveId, clearPatch);
      return;
    }
    const rawUsd = !hasWallet && sideData.inputMode === 'token'
      ? parseNumberInput(formattedValue) * (tokenPriceInUsd ?? 0)
      : parseNumberInput(formattedValue);
    const absDeltaUsd = rawUsd;
    let effectiveUsd = hasWallet
      ? Math.max(sideData.walletValue! + (isPositiveDelta ? 1 : -1) * absDeltaUsd, 0)
      : rawUsd;
    if (capLimitUsd != null && effectiveUsd > capLimitUsd) {
      effectiveUsd = capLimitUsd;
    }
    const patch = side === 'supply'
      ? { supplyAmount: formattedValue }
      : { borrowAmount: formattedValue };
    if (!hasWallet) {
      if (capLimitUsd != null && rawUsd > capLimitUsd) {
        const clampedAmount = sideData.inputMode === 'usd'
          ? formatNumberInput(formatConvertedAmount(capLimitUsd))
          : (tokenPriceInUsd != null ? formatNumberInput(formatConvertedAmount(capLimitUsd / tokenPriceInUsd)) : formatNumberInput(formatConvertedAmount(capLimitUsd)));
        const clampedPatch = side === 'supply'
          ? { supplyAmount: clampedAmount }
          : { borrowAmount: clampedAmount };
        actions.updateReserve(reserveId, clampedPatch);
      } else {
        actions.updateReserve(reserveId, patch);
      }
      return;
    }
    const sign = isPositiveDelta ? 1 : -1;
    const signPatch = side === 'supply'
      ? { supplyDeltaSign: sign as DeltaSign }
      : { borrowDeltaSign: sign as DeltaSign };
    const amountValue = sideData.inputMode === 'usd'
      ? formatNumberInput(formatConvertedAmount(effectiveUsd))
      : (tokenPriceInUsd != null ? formatNumberInput(formatConvertedAmount(effectiveUsd / tokenPriceInUsd)) : formatNumberInput(formatConvertedAmount(effectiveUsd)));
    const amountPatch = side === 'supply'
      ? { supplyAmount: amountValue }
      : { borrowAmount: amountValue };
    const clampedDeltaRawUsd = effectiveUsd - sideData.walletValue!;
    const deltaRawUsdPatch = side === 'supply'
      ? { supplyDeltaRawUsd: (sign >= 0 ? Math.abs(clampedDeltaRawUsd) : -Math.abs(clampedDeltaRawUsd)) as number | null }
      : { borrowDeltaRawUsd: (sign >= 0 ? Math.abs(clampedDeltaRawUsd) : -Math.abs(clampedDeltaRawUsd)) as number | null };
    actions.updateReserve(reserveId, { ...signPatch, ...amountPatch, ...deltaRawUsdPatch });
  }, [hasWallet, isPositiveDelta, actions, reserveId, side, sideData.walletValue, sideData.inputMode, tokenPriceInUsd, capLimitUsd]);

  const numberInput = useDebouncedInput({
    value: deltaDisplay,
    onCommit: handleDeltaCommit,
    debounceMs: 0,
  });

  const toggleDeltaSign = useCallback(() => {
    if (!hasWallet) return;
    if (sideData.inputMode === 'token' && tokenPriceInUsd == null) return;
    const newSign: DeltaSign = isPositiveDelta ? -1 : 1;
    const signPatch = side === 'supply'
      ? { supplyDeltaSign: newSign }
      : { borrowDeltaSign: newSign };
    const currentEffectiveUsd = sideData.inputMode === 'usd'
      ? parseNumberInput(sideData.amount)
      : parseNumberInput(sideData.amount) * tokenPriceInUsd!;
    const walletValue = sideData.walletValue ?? 0;
    const absDeltaUsd = Math.abs(currentEffectiveUsd - walletValue);
    if (absDeltaUsd < DELTA_EPSILON) {
      actions.updateReserve(reserveId, signPatch);
      return;
    }
    const newEffectiveUsd = Math.max(walletValue + newSign * absDeltaUsd, 0);
    const amountValue = sideData.inputMode === 'usd'
      ? formatConvertedAmount(newEffectiveUsd)
      : formatConvertedAmount(newEffectiveUsd / tokenPriceInUsd!);
    const amountPatch = side === 'supply'
      ? { supplyAmount: amountValue }
      : { borrowAmount: amountValue };
    const newDeltaRawUsd = sideData.deltaRawUsd !== undefined ? -sideData.deltaRawUsd : newSign * absDeltaUsd;
    const deltaRawUsdPatch = side === 'supply'
      ? { supplyDeltaRawUsd: newDeltaRawUsd as number | null }
      : { borrowDeltaRawUsd: newDeltaRawUsd as number | null };
    actions.updateReserve(reserveId, { ...signPatch, ...amountPatch, ...deltaRawUsdPatch });
  }, [hasWallet, isPositiveDelta, actions, reserveId, side, sideData.walletValue, sideData.amount, sideData.inputMode, tokenPriceInUsd, sideData.deltaRawUsd]);

  const handleToggleInputMode = useCallback(() => {
    const newMode: PortfolioInputMode = sideData.inputMode === 'usd' ? 'token' : 'usd';
    const patch = side === 'supply'
      ? { supplyInputMode: newMode }
      : { borrowInputMode: newMode };
    actions.updateReserve(reserveId, patch, tokenPriceInUsd);
  }, [sideData.inputMode, actions, reserveId, side, tokenPriceInUsd]);

  const walletDisplay = hasWallet
    ? (sideData.inputMode === 'usd'
        ? formatNumberInput(formatConvertedAmount(sideData.walletValue!))
        : (tokenPriceInUsd != null
            ? formatNumberInput(formatConvertedAmount(sideData.walletValue! / tokenPriceInUsd))
            : formatNumberInput(formatConvertedAmount(sideData.walletValue!))))
    : '';

  const effectiveUsdForSign = sideData.deltaRawUsd !== undefined
    ? sideData.walletValue! + sideData.deltaRawUsd
    : (sideData.inputMode === 'usd'
        ? parseNumberInput(sideData.amount)
        : parseNumberInput(sideData.amount) * (tokenPriceInUsd ?? 0));
  const effectiveDisplay = sideData.inputMode === 'usd'
    ? formatNumberInput(formatConvertedAmount(effectiveUsdForSign))
    : sideData.amount;
  const isModified = hasWallet && Math.abs(effectiveUsdForSign - sideData.walletValue!) >= 0.005;

  if (disabled) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-0.5 opacity-40 cursor-not-allowed">
            <input
              value={sideData.amount}
              readOnly
              placeholder="—"
              className="h-6 w-full min-w-[2rem] rounded ds-text-10 tabular-nums placeholder:italic cursor-not-allowed border border-border/30 bg-muted/30 text-muted-foreground px-1"
              aria-label={`${side} (disabled) for ${tokenSymbol}`}
            />
          </div>
        </TooltipTrigger>
        {disabledNotice && (
          <TooltipContent side="top" className="ds-text-11">{disabledNotice}</TooltipContent>
        )}
      </Tooltip>
    );
  }

  const placeholder = hasWallet
    ? walletDisplay
    : (sideData.inputMode === 'usd' ? '10K' : '100');

  return (
    <div className="flex items-center gap-0.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            disabled={tokenPriceInUsd === undefined}
            onClick={handleToggleInputMode}
            className={cn(
              'shrink-0 rounded border border-border/40 bg-muted/60 px-0.5 ds-text-9 font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground leading-none',
              tokenPriceInUsd === undefined && 'opacity-40 cursor-not-allowed',
            )}
            aria-label={`Switch to ${sideData.inputMode === 'usd' ? 'token' : 'USD'} input`}
          >
            {sideData.inputMode === 'usd' ? '$' : 'T'}
          </button>
        </TooltipTrigger>
        {tokenPriceInUsd === undefined && (
          <TooltipContent side="top" className="ds-text-11">Price unavailable</TooltipContent>
        )}
      </Tooltip>

      <div className="relative flex-1 min-w-0">
        {hasWallet && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={toggleDeltaSign}
                className={cn(
                  'absolute left-0 top-1/2 -translate-y-1/2 z-10 rounded-sm px-0.5 ds-text-10 font-bold leading-none transition-colors',
                  isPositiveDelta
                    ? 'text-emerald-600 hover:bg-emerald-500/10'
                    : 'text-red-500 hover:bg-red-500/10',
                isModified && 'underline decoration-dotted underline-offset-2',
              )}
                aria-label={isPositiveDelta ? 'Adding' : 'Reducing'}
              >
                {isPositiveDelta ? '+' : '−'}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="ds-text-11">
              {isModified ? (
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Wallet</span>
                  <span className="tabular-nums">{walletDisplay}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="font-semibold tabular-nums">{effectiveDisplay}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Wallet</span>
                  <span className="tabular-nums">{walletDisplay}</span>
                </div>
              )}
            </TooltipContent>
          </Tooltip>
        )}
        <input
          ref={numberInput.inputRef}
          value={numberInput.displayValue}
          onChange={numberInput.handleChange}
          onFocus={numberInput.handleFocus}
          onBlur={numberInput.handleBlur}
          inputMode="decimal"
          placeholder={placeholder}
          className={cn(
            'h-5 w-full min-w-[2rem] rounded ds-text-11 tabular-nums placeholder:text-muted-foreground/40 placeholder:italic',
            hasWallet ? 'pl-3.5 pr-4' : hasValue ? 'pl-1.5 pr-4' : 'pl-1.5 pr-1.5',
            cnDsInputSurface(hasValue, inputVariant),
          )}
          aria-label={`${side} ${hasWallet ? 'delta' : 'amount'} for ${tokenSymbol}`}
        />
        {hasValue && (
          <button
            type="button"
            onClick={() => handleDeltaCommit('')}
            className="absolute right-0 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
            aria-label={`Clear ${tokenSymbol} ${side}`}
          >
            <Eraser className="size-2.5" aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}

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
      <table className={cn('w-full [&_tbody_td]:transition-colors', TABLE_TEXT)} style={{ tableLayout: 'fixed' }}>
        <UnifiedColgroup />
        <thead>
          <tr className="text-muted-foreground border-b border-border/50">
            <th rowSpan={2} className={cn('pl-2 pr-1 py-1 text-left font-semibold', HEADER_BASE)}>Token</th>
            <th colSpan={2} className={cn('px-1 py-1 text-center font-semibold border-l border-border/20', HEADER_BASE)}>Input</th>
            <th colSpan={2} className={cn('px-1 py-1 text-center font-semibold border-l border-border/20', HEADER_BASE)}>Native</th>
            <th colSpan={2} className={cn('px-1 py-1 text-center font-semibold border-l border-border/20', HEADER_BASE)}>Incentive</th>
            <th colSpan={2} className={cn('px-1 py-1 text-center font-semibold border-l border-border/20', HEADER_BASE)}>Total</th>
            <th colSpan={3} className={cn('px-1 py-1 text-center font-semibold border-l border-border/20', HEADER_BASE)}>Earn $/day</th>
          </tr>
          <tr className="text-muted-foreground border-b border-border/50">
            <th className={cn('px-0.5 py-0.5 text-right font-medium ds-text-11', HEADER_BASE, SUPPLY_COLOR)}><span className="hidden lg:inline">Supply</span><span className="lg:hidden">S</span></th>
            <th className={cn('px-0.5 py-0.5 text-right font-medium ds-text-11', HEADER_BASE, BORROW_COLOR)}><span className="hidden lg:inline">Borrow</span><span className="lg:hidden">B</span></th>
            <th className={cn('px-0.5 py-0.5 text-right font-medium border-l border-border/20 ds-text-11', HEADER_BASE, SUPPLY_COLOR)}><span className="hidden lg:inline">Supply</span><span className="lg:hidden">S</span></th>
            <th className={cn('px-0.5 py-0.5 text-right font-medium ds-text-11', HEADER_BASE, BORROW_COLOR)}><span className="hidden lg:inline">Borrow</span><span className="lg:hidden">B</span></th>
            <th className={cn('px-0.5 py-0.5 text-right font-medium border-l border-border/20 ds-text-11', HEADER_BASE, SUPPLY_COLOR)}><span className="hidden lg:inline">Supply</span><span className="lg:hidden">S</span></th>
            <th className={cn('px-0.5 py-0.5 text-right font-medium ds-text-11', HEADER_BASE, BORROW_COLOR)}><span className="hidden lg:inline">Borrow</span><span className="lg:hidden">B</span></th>
            <th className={cn('px-0.5 py-0.5 text-right font-medium border-l border-border/20 ds-text-11', HEADER_BASE, SUPPLY_COLOR)}><span className="hidden lg:inline">Supply</span><span className="lg:hidden">S</span></th>
            <th className={cn('px-0.5 py-0.5 text-right font-medium ds-text-11', HEADER_BASE, BORROW_COLOR)}><span className="hidden lg:inline">Borrow</span><span className="lg:hidden">B</span></th>
            <th className={cn('px-0.5 py-0.5 text-right font-medium border-l border-border/20 ds-text-11', HEADER_BASE, SUPPLY_COLOR)}><span className="hidden lg:inline">Supply</span><span className="lg:hidden">S</span></th>
            <th className={cn('px-0.5 py-0.5 text-right font-medium ds-text-11', HEADER_BASE, BORROW_COLOR)}><span className="hidden lg:inline">Borrow</span><span className="lg:hidden">B</span></th>
            <th className={cn('px-0.5 py-0.5 pr-2 text-right font-semibold border-l border-border/20', HEADER_BASE)}>Net</th>
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
            const chainSrc = getChainIconSrc(entry.chainId);
            const marketLabel = getMarketChipLabel(entry.marketName, entry.chainName);
            const showV4 = isV4Market(entry.marketName);
            const hubChipClass = getHubChipClass(showV4);

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
                className={cn('group border-t border-border/30 hover:bg-muted/5', rowOpacity)}
                onClick={isHidden && !isRestricted ? () => actions.unhideReserve(entry.reserveId) : undefined}
              >
                {/* Token */}
                <td className={cn('pl-2 pr-1 py-1', isHidden && 'cursor-pointer')}>
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
                    <TokenIcon symbol={entry.tokenSymbol} size={14} />
                    <div className="flex flex-col min-w-0 leading-tight">
                      <span className={cn('ds-text-11 font-semibold truncate', isHidden ? 'text-muted-foreground line-through' : 'text-foreground')}>
                        {entry.tokenSymbol}
                      </span>
                      <span className="ds-text-9 text-muted-foreground inline-flex items-center gap-0.5 min-w-0">
                        {chainSrc && <img src={chainSrc} alt={entry.chainName} className="size-2 shrink-0 opacity-70" />}
                        <span className="truncate">{marketLabel}</span>
                        {entry.hubName && (
                          <span className={cn('shrink-0 max-w-full', hubChipClass)} title={`Hub: ${entry.hubName}`}>
                            <span className="truncate">{entry.hubName}</span>
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </td>

                {/* Supply Input */}
                <td className={cn(INPUT_CELL, 'border-l border-border/20 align-top')}>
                  <div className="flex items-center gap-0.5">
                    <div className="flex-1 min-w-0">
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
                <td className={cn(INPUT_CELL, 'align-top')}>
                  <div className="flex items-center gap-0.5">
                    <div className="flex-1 min-w-0">
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
                <td className={cn(VAL_CELL, 'border-l border-border/20', SUPPLY_BAND, SUPPLY_COLOR)}>
                  {supplyResult ? <MetricValue afterValue={supplyResult.nativePercent} metric={supplyResult.nativeMetric} formatFn={formatPercent} /> : '—'}
                </td>
                {/* Borrow Native */}
                <td className={cn(VAL_CELL, BORROW_BAND, BORROW_COLOR)}>
                  {borrowResult ? <MetricValue afterValue={borrowResult.nativePercent} metric={borrowResult.nativeMetric} formatFn={formatPercent} /> : '—'}
                </td>

                {/* Supply Incentive */}
                <td className={cn(VAL_CELL, 'border-l border-border/20', SUPPLY_BAND, SUPPLY_COLOR)}>
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
                <td className={cn(VAL_CELL, BORROW_BAND, BORROW_COLOR)}>
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
                <td className={cn(VAL_CELL, 'border-l border-border/20 font-bold', SUPPLY_BAND, SUPPLY_COLOR)}>
                  {supplyResult ? <MetricValue afterValue={supplyResult.totalPercent} metric={supplyResult.totalMetric} formatFn={formatPercent} /> : '—'}
                </td>
                {/* Borrow Total */}
                <td className={cn(VAL_CELL, 'font-bold', BORROW_BAND, BORROW_COLOR)}>
                  {borrowResult ? <MetricValue afterValue={borrowResult.totalPercent} metric={borrowResult.totalMetric} formatFn={formatPercent} /> : '—'}
                </td>

                {/* Supply $/day */}
                <td className={cn(VAL_CELL, 'border-l border-border/20', SUPPLY_COLOR)}>
                  {supplyResult ? formatUsdDayOrDash(supplyResult.usdPerDay) : '—'}
                </td>
                {/* Borrow $/day */}
                <td className={cn(VAL_CELL, BORROW_COLOR)}>
                  {borrowResult ? formatUsdDayOrDash(borrowResult.usdPerDay) : '—'}
                </td>
                {/* Net $/day */}
                <td className={cn(LAST_CELL, 'border-l border-border/20 font-bold', 'text-foreground')}>
                  {(() => {
                    const s = supplyResult?.usdPerDay ?? 0;
                    const b = borrowResult?.usdPerDay ?? 0;
                    return formatUsdDayOrDash(s - b);
                  })()}
                </td>
              </tr>
            );
          })}
        </tbody>
        {summary && (
          <tfoot>
            <tr className="border-t-2 border-border/60 bg-muted/30">
              <td className="pl-2 pr-1 py-1.5 font-bold ds-text-11">Total</td>
              <td className={cn(VAL_CELL, 'border-l border-border/20 font-bold', SUPPLY_COLOR)}>{formatUsdCompact(summary.totalSupplyUsd)}</td>
              <td className={cn(VAL_CELL, 'font-bold', BORROW_COLOR)}>{formatUsdCompact(summary.totalBorrowUsd)}</td>
              <td className={cn(VAL_CELL, 'border-l border-border/20', SUPPLY_BAND)} />
              <td className={cn(VAL_CELL, BORROW_BAND)} />
              <td className={cn(VAL_CELL, 'border-l border-border/20', SUPPLY_BAND)} />
              <td className={cn(VAL_CELL, BORROW_BAND)} />
              <td className={cn(VAL_CELL, 'border-l border-border/20 font-bold', SUPPLY_BAND, SUPPLY_COLOR)} title="Weighted average">
                {formatPercent(summary.supplyWeightedApy)}
              </td>
              <td className={cn(VAL_CELL, 'font-bold', BORROW_BAND, BORROW_COLOR)} title="Weighted average">
                {formatPercent(summary.borrowWeightedApy)}
              </td>
              <td className={cn(VAL_CELL, 'border-l border-border/20', SUPPLY_COLOR)}>{formatUsdDayOrDash(summary.supplyUsdPerDay)}</td>
              <td className={cn(VAL_CELL, BORROW_COLOR)}>{formatUsdDayOrDash(summary.borrowUsdPerDay)}</td>
              <td className={cn(LAST_CELL, 'border-l border-border/20 font-bold', 'text-foreground')}>{formatUsdDayOrDash(summary.netUsdPerDay)}</td>
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
