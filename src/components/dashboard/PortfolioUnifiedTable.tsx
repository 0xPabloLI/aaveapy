/**
 * PortfolioUnifiedTable v7 — one row per reserve, both sides inline.
 *
 * Width strategy: table-layout:auto.
 * Token, Supply Input, and Borrow Input columns all have no explicit width.
 * In auto layout, the browser distributes remaining space proportionally
 * based on content max-width. Token content is narrow (symbol + icon), so it
 * gets less; Input columns are wider (input box + wallet label), so they get
 * more. All other columns have fixed px widths.
 *
 * Columns (12):
 *   0  Token            auto (content-adaptive, shares remaining space)
 *   1  Supply Input     auto (shares remaining space)
 *   2  Borrow Input     auto (shares remaining space)
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

// table-layout:auto. Token + Input cols have no explicit width — browser
// distributes remaining space proportionally by content. Token is narrow so
// it gets less; Input cols are wider so they get more. Other cols are fixed px.
const COL_WIDTHS = [
  undefined,     // 0  Token — content-adaptive, shares remaining space
  undefined,     // 1  Supply Input — shares remaining space
  undefined,     // 2  Borrow Input — shares remaining space
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
        <span className="underline decoration-dotted underline-offset-2 cursor-auto">
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

/** Compact value formatter — used for wallet display outside the input. */
function formatCompactValue(value: number, withDollar = false): string {
  const prefix = withDollar ? '$' : '';
  if (value === 0) return `${prefix}0`;
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${prefix}${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${prefix}${(value / 1_000).toFixed(1)}K`;
  return `${prefix}${value.toFixed(2)}`;
}

function formatUsdCompact(value: number): string {
  return formatCompactValue(value, true);
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
            'inline-flex shrink-0 cursor-auto align-middle',
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
                <div key={i} className="text-amber-600 dark:text-amber-400">
                  {label}
                </div>
              );
            }
            const notes = w.kind === 'incentive_cap' ? (w as IncentiveCapWarning).notes : (w as IncentiveOffsetWarning).notes;
            const source = w.kind === 'incentive_cap' ? (w as IncentiveCapWarning).source : (w as IncentiveOffsetWarning).source;
            return (
              <div key={i} className="flex flex-col gap-0.5">
                <span className="font-semibold capitalize text-muted-foreground">
                  {source}
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

  // Option E: input always shows the full effective value (not delta).
  // For wallet positions, the input value IS the effective position.
  // For non-wallet entries, it's the raw amount.
  const effectiveDisplay = sideData.amount;
  const hasValue = Boolean(effectiveDisplay.trim());

  // Derive effective USD to determine arrow color.
  const effectiveUsd = sideData.inputMode === 'usd'
    ? parseNumberInput(sideData.amount)
    : parseNumberInput(sideData.amount) * (tokenPriceInUsd ?? 0);
  const walletUsd = sideData.walletValue ?? 0;
  const isEffectiveAbove = hasWallet && effectiveUsd > walletUsd + DELTA_EPSILON;
  const isEffectiveBelow = hasWallet && effectiveUsd < walletUsd - DELTA_EPSILON;

  const deltaCommitRef = useRef({ initialHasValue: hasValue });
  if (deltaCommitRef.current.initialHasValue !== hasValue) {
    deltaCommitRef.current = { initialHasValue: hasValue };
  }

  // Option E: handleDeltaCommit receives the full effective value (not delta).
  // For wallet positions, delta is derived as effective - wallet.
  const handleDeltaCommit = useCallback((formattedValue: string) => {
    if (!formattedValue.trim()) {
      if (!deltaCommitRef.current.initialHasValue) return;
      if (!hasWallet) {
        actions.updateReserve(reserveId, side === 'supply' ? { supplyAmount: '' } : { borrowAmount: '' });
        return;
      }
      // Clear = empty input, delta = 0 (simulator uses walletValue as total).
      const clearPatch = side === 'supply'
        ? { supplyAmount: '' as const, supplyDeltaSign: 1 as DeltaSign, supplyDeltaRawUsd: null as number | null }
        : { borrowAmount: '' as const, borrowDeltaSign: 1 as DeltaSign, borrowDeltaRawUsd: null as number | null };
      actions.updateReserve(reserveId, clearPatch);
      return;
    }
    // Parse the effective value the user typed.
    const inputUsd = sideData.inputMode === 'token'
      ? parseNumberInput(formattedValue) * (tokenPriceInUsd ?? 0)
      : parseNumberInput(formattedValue);
    // Clamp to cap if present.
    const clampedUsd = capLimitUsd != null ? Math.min(inputUsd, capLimitUsd) : inputUsd;
    const wasClamped = capLimitUsd != null && inputUsd > capLimitUsd;
    // Format the (possibly clamped) amount for the store.
    const amountValue = wasClamped
      ? (sideData.inputMode === 'usd'
          ? formatNumberInput(formatConvertedAmount(clampedUsd))
          : (tokenPriceInUsd != null ? formatNumberInput(formatConvertedAmount(clampedUsd / tokenPriceInUsd)) : formatNumberInput(formatConvertedAmount(clampedUsd))))
      : formattedValue;
    const amountPatch = side === 'supply'
      ? { supplyAmount: amountValue }
      : { borrowAmount: amountValue };
    if (!hasWallet) {
      actions.updateReserve(reserveId, amountPatch);
      return;
    }
    // Derive sign and delta from effective vs wallet.
    const deltaUsd = clampedUsd - sideData.walletValue!;
    const sign: DeltaSign = deltaUsd >= 0 ? 1 : -1;
    const signPatch = side === 'supply'
      ? { supplyDeltaSign: sign }
      : { borrowDeltaSign: sign };
    const deltaRawUsdPatch = side === 'supply'
      ? { supplyDeltaRawUsd: deltaUsd as number | null }
      : { borrowDeltaRawUsd: deltaUsd as number | null };
    actions.updateReserve(reserveId, { ...signPatch, ...amountPatch, ...deltaRawUsdPatch });
  }, [hasWallet, actions, reserveId, side, sideData.walletValue, sideData.inputMode, tokenPriceInUsd, capLimitUsd]);

  // ClampFn: real-time cap clamping during input to prevent flicker.
  // Converts input to USD, clamps to capLimitUsd, converts back to input mode.
  const clampFn = useCallback((formattedValue: string): string => {
    if (capLimitUsd == null) return formattedValue;
    const numUsd = sideData.inputMode === 'token'
      ? parseNumberInput(formattedValue) * (tokenPriceInUsd ?? 0)
      : parseNumberInput(formattedValue);
    if (numUsd <= capLimitUsd) return formattedValue;
    const clampedAmount = sideData.inputMode === 'usd'
      ? formatNumberInput(formatConvertedAmount(capLimitUsd))
      : (tokenPriceInUsd != null ? formatNumberInput(formatConvertedAmount(capLimitUsd / tokenPriceInUsd)) : formatNumberInput(formatConvertedAmount(capLimitUsd)));
    return clampedAmount;
  }, [capLimitUsd, sideData.inputMode, tokenPriceInUsd]);

  const numberInput = useDebouncedInput({
    value: effectiveDisplay,
    onCommit: handleDeltaCommit,
    debounceMs: 0,
    clampFn,
  });

  const handleToggleInputMode = useCallback(() => {
    const newMode: PortfolioInputMode = sideData.inputMode === 'usd' ? 'token' : 'usd';
    const patch = side === 'supply'
      ? { supplyInputMode: newMode }
      : { borrowInputMode: newMode };
    actions.updateReserve(reserveId, patch, tokenPriceInUsd);
  }, [sideData.inputMode, actions, reserveId, side, tokenPriceInUsd]);

  // Wallet display — shown outside the input as non-editable context.
  // Uses 2 decimal places (standard USD precision) consistent with formatUsd.
  // This is separate from formatConvertedAmount (8 sig digits) which is used
  // for the input value itself — the wallet label is display-only, not for
  // editing, so standard financial precision (2 decimals) is correct.
  const walletDisplay = hasWallet
    ? (sideData.inputMode === 'usd'
        ? formatNumberInput(sideData.walletValue!.toFixed(2))
        : (tokenPriceInUsd != null
            ? formatNumberInput((sideData.walletValue! / tokenPriceInUsd).toFixed(4))
            : formatNumberInput(sideData.walletValue!.toFixed(2))))
    : '';

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

  // Full wallet value for input placeholder (when input is empty).
  // Same format as walletDisplay — consistent precision.
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

      {hasWallet && (
        <span className="shrink-0 ds-text-9 tabular-nums leading-none whitespace-nowrap">
          <span className="text-muted-foreground">{walletDisplay}</span>
          <span className={cn(
            'ml-0.5',
            isEffectiveAbove ? 'text-emerald-600 dark:text-emerald-400'
              : isEffectiveBelow ? 'text-red-500 dark:text-red-400'
              : 'text-muted-foreground',
          )}>→</span>
        </span>
      )}

      <div className="relative flex-1 min-w-0">
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
            hasValue ? 'pl-1.5 pr-4' : 'pl-1.5 pr-1.5',
            cnDsInputSurface(hasValue, inputVariant),
          )}
          aria-label={`${side} ${hasWallet ? 'effective' : 'amount'} for ${tokenSymbol}`}
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
      <table className={cn('w-full [&_tbody_td]:transition-colors', TABLE_TEXT)} style={{ tableLayout: 'auto' }}>
        <UnifiedColgroup />
        <thead>
          <tr className="text-muted-foreground border-b border-border/50">
            <th rowSpan={2} className={cn('pl-2 pr-0.5 py-1 text-left font-semibold', HEADER_BASE)}>Token</th>
            <th colSpan={2} className={cn('px-1 py-1 text-center font-semibold', GROUP_SEP, HEADER_BASE)}>Input</th>
            <th colSpan={2} className={cn('px-1 py-1 text-center font-semibold', GROUP_SEP, HEADER_BASE)}>Native</th>
            <th colSpan={2} className={cn('px-1 py-1 text-center font-semibold', GROUP_SEP, HEADER_BASE)}>Incentive</th>
            <th colSpan={2} className={cn('px-1 py-1 text-center font-semibold', GROUP_SEP, HEADER_BASE)}>Total</th>
            <th colSpan={3} className={cn('px-1 py-1 text-center font-semibold', GROUP_SEP, HEADER_BASE)}>Earn $/day</th>
          </tr>
          <tr className="text-muted-foreground border-b border-border/50">
            <th className={cn('px-0.5 py-0.5 text-right font-medium ds-text-11', HEADER_BASE, SUPPLY_COLOR)}><span className="hidden lg:inline">Supply</span><span className="lg:hidden">S</span></th>
            <th className={cn('px-0.5 py-0.5 text-right font-medium ds-text-11', SIDE_SEP, HEADER_BASE, BORROW_COLOR)}><span className="hidden lg:inline">Borrow</span><span className="lg:hidden">B</span></th>
            <th className={cn('px-0.5 py-0.5 text-right font-medium', GROUP_SEP, 'ds-text-11', HEADER_BASE, SUPPLY_COLOR)}><span className="hidden lg:inline">Supply</span><span className="lg:hidden">S</span></th>
            <th className={cn('px-0.5 py-0.5 text-right font-medium ds-text-11', SIDE_SEP, HEADER_BASE, BORROW_COLOR)}><span className="hidden lg:inline">Borrow</span><span className="lg:hidden">B</span></th>
            <th className={cn('px-0.5 py-0.5 text-right font-medium', GROUP_SEP, 'ds-text-11', HEADER_BASE, SUPPLY_COLOR)}><span className="hidden lg:inline">Supply</span><span className="lg:hidden">S</span></th>
            <th className={cn('px-0.5 py-0.5 text-right font-medium ds-text-11', SIDE_SEP, HEADER_BASE, BORROW_COLOR)}><span className="hidden lg:inline">Borrow</span><span className="lg:hidden">B</span></th>
            <th className={cn('px-0.5 py-0.5 text-right font-medium', GROUP_SEP, 'ds-text-11', HEADER_BASE, SUPPLY_COLOR)}><span className="hidden lg:inline">Supply</span><span className="lg:hidden">S</span></th>
            <th className={cn('px-0.5 py-0.5 text-right font-medium ds-text-11', SIDE_SEP, HEADER_BASE, BORROW_COLOR)}><span className="hidden lg:inline">Borrow</span><span className="lg:hidden">B</span></th>
            <th className={cn('px-0.5 py-0.5 text-right font-medium', GROUP_SEP, 'ds-text-11', HEADER_BASE, SUPPLY_COLOR)}><span className="hidden lg:inline">Supply</span><span className="lg:hidden">S</span></th>
            <th className={cn('px-0.5 py-0.5 text-right font-medium ds-text-11', SIDE_SEP, HEADER_BASE, BORROW_COLOR)}><span className="hidden lg:inline">Borrow</span><span className="lg:hidden">B</span></th>
            <th className={cn('px-0.5 py-0.5 pr-2 text-right font-semibold', GROUP_SEP, HEADER_BASE)}>Net</th>
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
                data-reserve-id={entry.reserveId}
                className={cn('group border-t border-border/30 hover:bg-muted/5', rowOpacity)}
                onClick={isHidden && !isRestricted ? () => actions.unhideReserve(entry.reserveId) : undefined}
              >
                {/* Token */}
                <td className={cn('pl-2 pr-0.5 py-1', isHidden && 'cursor-pointer')}>
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
                <td className={cn(INPUT_CELL, GROUP_SEP, SUPPLY_BAND, 'align-top')}>
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
                <td className={cn(INPUT_CELL, SIDE_SEP, BORROW_BAND, 'align-top')}>
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
                <td className={cn(VAL_CELL, GROUP_SEP, SUPPLY_BAND, SUPPLY_COLOR)}>
                  {supplyResult ? <MetricValue afterValue={supplyResult.nativePercent} metric={supplyResult.nativeMetric} formatFn={formatPercent} /> : '—'}
                </td>
                {/* Borrow Native */}
                <td className={cn(VAL_CELL, SIDE_SEP, BORROW_BAND, BORROW_COLOR)}>
                  {borrowResult ? <MetricValue afterValue={borrowResult.nativePercent} metric={borrowResult.nativeMetric} formatFn={formatPercent} /> : '—'}
                </td>

                {/* Supply Incentive */}
                <td className={cn(VAL_CELL, GROUP_SEP, SUPPLY_BAND, SUPPLY_COLOR)}>
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
                <td className={cn(VAL_CELL, SIDE_SEP, BORROW_BAND, BORROW_COLOR)}>
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
                <td className={cn(VAL_CELL, GROUP_SEP, 'font-bold', SUPPLY_BAND, SUPPLY_COLOR)}>
                  {supplyResult ? <MetricValue afterValue={supplyResult.totalPercent} metric={supplyResult.totalMetric} formatFn={formatPercent} /> : '—'}
                </td>
                {/* Borrow Total */}
                <td className={cn(VAL_CELL, SIDE_SEP, 'font-bold', BORROW_BAND, BORROW_COLOR)}>
                  {borrowResult ? <MetricValue afterValue={borrowResult.totalPercent} metric={borrowResult.totalMetric} formatFn={formatPercent} /> : '—'}
                </td>

                {/* Supply $/day */}
                <td className={cn(VAL_CELL, GROUP_SEP, SUPPLY_BAND, SUPPLY_COLOR)}>
                  {supplyResult ? formatUsdDayOrDash(supplyResult.usdPerDay) : '—'}
                </td>
                {/* Borrow $/day */}
                <td className={cn(VAL_CELL, SIDE_SEP, BORROW_BAND, BORROW_COLOR)}>
                  {borrowResult ? formatUsdDayOrDash(borrowResult.usdPerDay) : '—'}
                </td>
                {/* Net $/day */}
                <td className={cn(LAST_CELL, GROUP_SEP, 'font-bold', 'text-foreground', HEADER_BASE)}>
                  {(() => {
                    const s = supplyResult?.usdPerDay ?? 0;
                    const b = borrowResult?.usdPerDay ?? 0;
                    // borrow usdPerDay is already signed (negative = cost),
                    // so net = supply + borrow (not supply - borrow).
                    return formatUsdDayOrDash(s + b);
                  })()}
                </td>
              </tr>
            );
          })}
        </tbody>
        {summary && (
          <tfoot>
            <tr className="border-t-2 border-border/60 bg-muted/30">
              <td className="pl-2 pr-0.5 py-1.5 font-bold ds-text-11">Total</td>
              <td className={cn(VAL_CELL, GROUP_SEP, 'font-bold', SUPPLY_BAND, SUPPLY_COLOR)}>{formatUsdCompact(summary.totalSupplyUsd)}</td>
              <td className={cn(VAL_CELL, SIDE_SEP, 'font-bold', BORROW_BAND, BORROW_COLOR)}>{formatUsdCompact(summary.totalBorrowUsd)}</td>
              <td className={cn(VAL_CELL, GROUP_SEP, SUPPLY_BAND)} />
              <td className={cn(VAL_CELL, SIDE_SEP, BORROW_BAND)} />
              <td className={cn(VAL_CELL, GROUP_SEP, SUPPLY_BAND)} />
              <td className={cn(VAL_CELL, SIDE_SEP, BORROW_BAND)} />
              <td className={cn(VAL_CELL, GROUP_SEP, 'font-bold', SUPPLY_BAND, SUPPLY_COLOR)} title="Weighted average">
                {formatPercent(summary.supplyWeightedApy)}
              </td>
              <td className={cn(VAL_CELL, SIDE_SEP, 'font-bold', BORROW_BAND, BORROW_COLOR)} title="Weighted average">
                {formatPercent(summary.borrowWeightedApy)}
              </td>
              <td className={cn(VAL_CELL, GROUP_SEP, SUPPLY_BAND, SUPPLY_COLOR)}>{formatUsdDayOrDash(summary.supplyUsdPerDay)}</td>
              <td className={cn(VAL_CELL, SIDE_SEP, BORROW_BAND, BORROW_COLOR)}>{formatUsdDayOrDash(summary.borrowUsdPerDay)}</td>
              <td className={cn(LAST_CELL, GROUP_SEP, 'font-bold', 'text-foreground', HEADER_BASE)}>{formatUsdDayOrDash(summary.netUsdPerDay)}</td>
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
