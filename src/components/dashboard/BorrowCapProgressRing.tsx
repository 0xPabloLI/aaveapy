import type { ReactNode } from 'react';
import { memo } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipCalloutArrow } from '@/components/ui/tooltip';
import { formatScenarioSize } from '@/lib/formatters';
import { getAvailableToBorrowUsd } from '@/lib/scenarioSize';
import { cn } from '@/lib/utils';

interface BorrowCapProgressRingProps {
  borrowed: number | null | undefined;
  cap: number | null | undefined;
  availableLiquidityUsd: number | null | undefined;
  disabled?: boolean;
  displayMode?: 'usd' | 'token';
  tokenPrice?: number | null;
  tokenSymbol?: string | null;
  ringSize?: number;
  strokeWidth?: number;
  /** When true, only the ring SVG is rendered (no tooltip). Use with parent Popover for click-to-open. */
  disableTooltip?: boolean;
  /** When set with a valid cap, the tooltip trigger spans this node plus the ring (desktop Size column). */
  label?: ReactNode;
  triggerClassName?: string;
  triggerAriaLabel?: string;
  /** When provided, clicking the ring triggers this sort callback. */
  onSort?: () => void;
  /** When provided, clicking the label number sorts by that size. */
  onSortSize?: () => void;
  /** Sort state for percentage arrow in tooltip. */
  isSortActive?: boolean;
  sortOrder?: 'asc' | 'desc';
}

/** Shared borrow cap progress data display — reused by desktop tooltip and mobile bottom sheet. */
export function BorrowCapProgressContent({
  borrowed,
  cap,
  availableLiquidityUsd,
  disabled = false,
  displayMode = 'usd',
  tokenPrice,
  tokenSymbol,
  onSortPercentage,
  isSortActive,
  sortOrder,
}: {
  borrowed: number;
  cap: number;
  availableLiquidityUsd: number;
  disabled?: boolean;
  displayMode?: 'usd' | 'token';
  tokenPrice?: number | null;
  tokenSymbol?: string | null;
  onSortPercentage?: () => void;
  isSortActive?: boolean;
  sortOrder?: 'asc' | 'desc';
}) {
  const percentage = Math.min((borrowed / cap) * 100, 100);
  const availableToBorrow = disabled
    ? 0
    : getAvailableToBorrowUsd({
        borrowedUsd: borrowed,
        borrowCapUsd: cap,
        availableLiquidityUsd,
      }) ?? 0;
  const colorClass =
    percentage >= 95 ? 'ds-text-amber-500' : percentage >= 80 ? 'ds-text-amber-600' : 'ds-text-brand-cyan';

  const sortArrow = onSortPercentage
    ? (isSortActive ? (sortOrder === 'desc' ? '↓' : '↑') : '↕')
    : null;

  return (
    <div className="space-y-1 ds-text-12">
      <div className="flex justify-between gap-3">
        <span className="text-muted-foreground">Total borrowed</span>
        <span className="font-medium tabular-nums ds-text-brand-cyan">
          {formatScenarioSize(borrowed, { inputMode: displayMode, tokenPrice, tokenSymbol })}
        </span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="text-muted-foreground">Borrow cap</span>
        <span className="font-medium tabular-nums ds-text-brand-cyan">
          {formatScenarioSize(cap, { inputMode: displayMode, tokenPrice, tokenSymbol })}
        </span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="text-muted-foreground">Available liquidity</span>
        <span className={`font-medium tabular-nums ${availableLiquidityUsd < 10000 ? 'ds-text-amber-600' : 'ds-text-purple-600'}`}>
          {formatScenarioSize(availableLiquidityUsd, { inputMode: displayMode, tokenPrice, tokenSymbol })}
        </span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="text-muted-foreground">Available to borrow</span>
        <span className="font-medium tabular-nums ds-text-brand-cyan">
          {formatScenarioSize(availableToBorrow, { inputMode: displayMode, tokenPrice, tokenSymbol })}
        </span>
      </div>
      <div className="flex justify-between gap-3 pt-1 border-t border-border/50">
        <span className="text-muted-foreground">% of cap</span>
        <span className={`font-bold tabular-nums ${colorClass}`}>
          {percentage.toFixed(1)}%
          {sortArrow && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onSortPercentage!(); }}
              className={`ml-1 inline-flex items-center transition-colors ${
                isSortActive ? 'text-foreground' : 'text-muted-foreground/60 hover:text-foreground'
              }`}
              aria-label={`Sort by borrow cap %`}
            >
              {sortArrow}
            </button>
          )}
        </span>
      </div>
    </div>
  );
}

const BorrowCapProgressRing = memo(({
  borrowed,
  cap,
  availableLiquidityUsd,
  disabled = false,
  displayMode = 'usd',
  tokenPrice,
  tokenSymbol,
  ringSize = 12,
  strokeWidth = 1.5,
  disableTooltip = false,
  label,
  triggerClassName,
  triggerAriaLabel,
  onSort,
  onSortSize,
  isSortActive,
  sortOrder,
}: BorrowCapProgressRingProps) => {
  if (cap == null || !Number.isFinite(cap) || cap <= 0) {
    return null;
  }

  const currentBorrowed = borrowed ?? 0;
  const percentage = Math.min((currentBorrowed / cap) * 100, 100);
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const liquidityRemaining = availableLiquidityUsd ?? 0;

  const getProgressColor = () => {
    if (percentage >= 95) return 'rgb(var(--ds-amber-500-rgb, 245 158 11))';
    if (percentage >= 80) return 'rgb(var(--ds-amber-600-rgb, 217 119 6))';
    return 'rgb(var(--ds-brand-cyan-rgb, 34 211 238))';
  };

  const tooltipContent = (
    <TooltipContent side="right" className="max-w-[var(--ds-ring-tooltip-max-w)]">
      <TooltipCalloutArrow />
      <BorrowCapProgressContent
        borrowed={currentBorrowed}
        cap={cap}
        availableLiquidityUsd={liquidityRemaining}
        disabled={disabled}
        displayMode={displayMode}
        tokenPrice={tokenPrice}
        tokenSymbol={tokenSymbol}
        onSortPercentage={onSort}
        isSortActive={isSortActive}
        sortOrder={sortOrder}
      />
    </TooltipContent>
  );

  const ringNode = (
    <div className="inline-flex items-center p-0.5 -m-0.5 rounded-full transition-all duration-150 hover:bg-muted/70 hover:scale-[1.12] cursor-auto">
      <svg
            width={ringSize}
            height={ringSize}
            viewBox={`0 0 ${ringSize} ${ringSize}`}
            className="transform -rotate-90"
          >
            <circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              className="text-muted-foreground/15"
            />
            <circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={radius}
              fill="none"
              stroke={getProgressColor()}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-300"
            />
          </svg>
        </div>
  );

  if (disableTooltip) {
    if (label != null) {
      return (
        <span className={cn('inline-flex items-center justify-center gap-[var(--ds-space-1-5)]', triggerClassName)}>
          {label}
          {ringNode}
        </span>
      );
    }
    return ringNode;
  }

  if (label != null) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex items-center justify-center gap-[var(--ds-space-1-5)] cursor-default text-left',
              'rounded-md py-0.5 pl-1 pr-0.5 -my-0.5 transition-colors hover:bg-muted/50',
              triggerClassName,
            )}
            aria-label={triggerAriaLabel}
          >
            {onSortSize ? (
              <span
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); onSortSize(); }}
                className="cursor-pointer"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onSortSize(); } }}
                aria-label={`Sort by borrow size`}
              >
                {label}
              </span>
            ) : label}
            {ringNode}
          </button>
        </TooltipTrigger>
        {tooltipContent}
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {ringNode}
      </TooltipTrigger>
      {tooltipContent}
    </Tooltip>
  );
});

BorrowCapProgressRing.displayName = 'BorrowCapProgressRing';

export default BorrowCapProgressRing;
