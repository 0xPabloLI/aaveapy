/**
 * PortfolioTablePrimitives — shared UI sub-components used by both
 * PortfolioUnifiedTable (desktop) and MobilePortfolioCard (mobile).
 *
 * Extracted from PortfolioUnifiedTable to avoid duplicating input logic,
 * metric tooltip behavior, and warning marker rendering across the two
 * layouts. CSS responsive (Tailwind mobile-first + `md:` override) is used
 * for touch-target sizing — desktop behavior is unchanged.
 *
 * Components:
 * - CompactInput — per-side amount input with wallet display, $/T toggle,
 *   cap clamping, CJK normalization, and cursor management.
 * - MetricValue — displays a metric with dotted underline + tooltip
 *   when simulation changed the value (current → after + delta).
 * - WarningMarker — small colored dot with tooltip for cap warnings.
 *   Amber = binding cap, muted = informational.
 */
import { useCallback, useRef } from 'react';
import { Eraser } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatNumberInput, parseNumberInput } from '@/lib/numberFormat';
import { formatConvertedAmount } from '@/lib/portfolioCalculator';
import { cnDsInputSurface } from '@/lib/dsInputSurface';
import { formatPercent, formatUsd, formatSpread, formatReserveSizeUsd, formatSignedReserveSizeUsd } from '@/lib/formatters';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useDebouncedInput } from '@/hooks/useDebouncedInput';
import { PORTFOLIO_THEME } from './portfolioTheme';
import type {
  PortfolioSideData,
  PortfolioInputMode,
  DeltaSign,
} from '@/types/portfolio';
import type { PortfolioSimulationActions } from '@/hooks/usePortfolioSimulation';
import {
  formatProtocolCapText,
  type IncentiveCapWarning,
  type IncentiveOffsetWarning,
  type PortfolioCapWarning,
} from '@/lib/portfolioCapWarnings';

/* ── Constants ───────────────────────────────────────────────────── */

export const DELTA_EPSILON = 0.005;

/* ── Metric value with simulation tooltip ───────────────────────── */

/**
 * Metric shape: current / after / delta triple.
 * Reused from PortfolioSimulationMetric but kept structural to avoid
 * importing the full type (keeps the primitive standalone).
 */
export interface MetricShape {
  current: number | null;
  after: number | null;
  delta: number | null;
}

/**
 * Displays a metric value. When the simulation changed it (current → after),
 * the value gets a dotted underline and a hover tooltip showing the change.
 * This gives users the current/after context that was missing when we removed
 * the delta column.
 */
export function MetricValue({
  afterValue,
  metric,
  formatFn,
}: {
  afterValue: number;
  metric?: MetricShape;
  formatFn: (v: number) => string;
}) {
  const hasChange = metric?.current != null && metric.after != null
    && Math.abs(metric.current - metric.after) >= 0.005;

  if (!hasChange) {
    return <>{formatFn(afterValue)}</>;
  }

  const delta = metric!.delta ?? (metric!.after! - metric!.current!);
  const deltaStr = formatSpread(delta);
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

/* ── Inline warning marker (tooltip-only) ────────────────────────── */

/**
 * Small colored dot with tooltip — shows full warning text on hover.
 * Less visually aggressive than ⚠ triangle; standard in financial UIs
 * for inline annotations. Amber = binding cap, muted = informational.
 */
export function WarningMarker({ warnings }: { warnings: PortfolioCapWarning[] }) {
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
            'inline-flex shrink-0 cursor-auto align-middle items-center justify-center min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 -my-2 md:my-0',
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

export interface CompactInputProps {
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

export function CompactInput({
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
        : (tokenPriceInUsd != null && tokenPriceInUsd > 0
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
    <div className="flex items-center gap-1 md:gap-0.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            disabled={tokenPriceInUsd === undefined}
            onClick={handleToggleInputMode}
            className={cn(
              'shrink-0 rounded border border-border/40 bg-muted/60 ds-text-9 font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground flex items-center justify-center leading-none',
              'h-11 w-11 px-1 md:h-5 md:w-auto md:px-1',
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
            'h-11 md:h-5 w-full min-w-[2rem] rounded ds-text-11 tabular-nums placeholder:text-muted-foreground/40 placeholder:italic',
            hasValue ? 'pl-1.5 pr-4' : 'pl-1.5 pr-1.5',
            cnDsInputSurface(hasValue, inputVariant),
          )}
          aria-label={`${side} ${hasWallet ? 'effective' : 'amount'} for ${tokenSymbol}`}
        />
        {hasValue && (
          <button
            type="button"
            onClick={() => handleDeltaCommit('')}
            className="absolute right-0 top-1/2 -translate-y-1/2 rounded p-2 md:p-0.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors flex items-center justify-center"
            aria-label={`Clear ${tokenSymbol} ${side}`}
          >
            <Eraser className="size-4 md:size-2.5" aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}
