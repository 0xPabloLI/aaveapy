import type { ReactNode } from 'react';
import { memo } from 'react';
import { ArrowDown, ArrowUp, ExternalLink } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipCalloutArrow } from '@/components/ui/tooltip';
import { formatScenarioSize } from '@/lib/formatters';
import { calculateDeficitShareRatio, getDeficitSeverity } from '@/lib/deficit';
import { cn } from '@/lib/utils';

function SortArrowButton({
  onClick,
  isActive,
  sortOrder,
  ariaLabel,
}: {
  onClick: () => void;
  isActive: boolean;
  sortOrder?: 'asc' | 'desc';
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`ml-1 inline-flex items-center transition-colors ${
        isActive ? 'text-foreground' : 'text-muted-foreground/60 hover:text-foreground'
      }`}
      aria-label={ariaLabel}
    >
      {isActive ? (
        sortOrder === 'desc' ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />
      ) : (
        <ArrowDown className="w-3 h-3 opacity-50" />
      )}
    </button>
  );
}

interface DeficitLiquidityRingProps {
  deficitUsd: number | null | undefined;
  totalSuppliedUsd: number | null | undefined;
  tokenDeficitLabel?: string;
  displayMode?: 'usd' | 'token';
  tokenPrice?: number | null;
  tokenSymbol?: string | null;
  ringSize?: number;
  strokeWidth?: number;
  disableTooltip?: boolean;
  label?: ReactNode;
  triggerClassName?: string;
  triggerAriaLabel?: string;
  poolExplorerUrl?: string | null;
  /** When provided, clicking the ring triggers this sort callback. */
  onSort?: () => void;
  /** When provided, clicking the label number sorts by that size. */
  onSortSize?: () => void;
  /** Sort state for percentage arrow in tooltip. */
  isSortActive?: boolean;
  sortOrder?: 'asc' | 'desc';
  /** Sort callbacks and state for deficit amount arrow in tooltip. */
  onSortDeficitAmount?: () => void;
  isSortDeficitAmountActive?: boolean;
  deficitAmountSortOrder?: 'asc' | 'desc';
}

/** Shared deficit data display — reused by desktop tooltip and mobile bottom sheet. */
export function DeficitProgressContent({
  deficitUsd,
  totalSuppliedUsd,
  tokenDeficitLabel,
  displayMode = 'usd',
  tokenPrice,
  tokenSymbol,
  poolExplorerUrl,
  onSortPercentage,
  isSortActive,
  sortOrder,
  onSortDeficitAmount,
  isSortDeficitAmountActive,
  deficitAmountSortOrder,
}: {
  deficitUsd: number;
  totalSuppliedUsd: number | null | undefined;
  tokenDeficitLabel?: string;
  displayMode?: 'usd' | 'token';
  tokenPrice?: number | null;
  tokenSymbol?: string | null;
  poolExplorerUrl?: string | null;
  onSortPercentage?: () => void;
  isSortActive?: boolean;
  sortOrder?: 'asc' | 'desc';
  onSortDeficitAmount?: () => void;
  isSortDeficitAmountActive?: boolean;
  deficitAmountSortOrder?: 'asc' | 'desc';
}) {
  const ratio = calculateDeficitShareRatio({ deficitUsd, totalSuppliedUsd });
  const percentage = ratio != null ? Math.min(Math.max(ratio * 100, 0), 100) : null;
  const severity = getDeficitSeverity(ratio);

  const getProgressColorClass = () => {
    if (severity === 'critical') return 'ds-text-amber-500';
    if (severity === 'warning') return 'ds-text-amber-600';
    return 'text-muted-foreground/60';
  };

  const sortArrow = onSortPercentage
    ? <SortArrowButton onClick={onSortPercentage} isActive={!!isSortActive} sortOrder={sortOrder} ariaLabel="Sort by deficit %" />
    : null;

  const deficitAmountArrow = onSortDeficitAmount
    ? <SortArrowButton onClick={onSortDeficitAmount} isActive={!!isSortDeficitAmountActive} sortOrder={deficitAmountSortOrder} ariaLabel="Sort by deficit amount" />
    : null;

  const deficitDisplayValue = displayMode === 'token'
    ? (tokenDeficitLabel ?? '—')
    : formatScenarioSize(deficitUsd, { inputMode: 'usd' });
  const totalSuppliedDisplayValue = totalSuppliedUsd != null
    ? formatScenarioSize(totalSuppliedUsd, { inputMode: displayMode, tokenPrice, tokenSymbol })
    : '—';

  return (
    <div className="space-y-1 ds-text-12">
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground flex items-center gap-1">
          Deficit
          {poolExplorerUrl && (
            <a
              href={poolExplorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground/60 hover:text-foreground transition-colors"
              onClick={(e) => e.stopPropagation()}
              aria-label="Verify on-chain"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </span>
        <span className={`font-medium tabular-nums ${getProgressColorClass()}`}>
          {deficitDisplayValue}
          {deficitAmountArrow}
        </span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="text-muted-foreground">Total supplied</span>
        <span className={`font-medium tabular-nums ${getProgressColorClass()}`}>
          {totalSuppliedDisplayValue}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/35">
        <span className="text-muted-foreground">% of total (incl. deficit)</span>
        <span className={`font-bold tabular-nums leading-none ${getProgressColorClass()}`}>
          {ratio != null ? `${percentage?.toFixed(2)}%` : '—'}
          {sortArrow}
        </span>
      </div>
    </div>
  );
}

const DeficitLiquidityRing = memo(({
  deficitUsd,
  totalSuppliedUsd,
  tokenDeficitLabel,
  displayMode = 'usd',
  tokenPrice,
  tokenSymbol,
  ringSize = 12,
  strokeWidth = 1.5,
  disableTooltip = false,
  label,
  triggerClassName,
  triggerAriaLabel,
  poolExplorerUrl,
  onSort,
  onSortSize,
  isSortActive,
  sortOrder,
  onSortDeficitAmount,
  isSortDeficitAmountActive,
  deficitAmountSortOrder,
}: DeficitLiquidityRingProps) => {
  const hasDeficit = deficitUsd != null && Number.isFinite(deficitUsd) && deficitUsd > 0;
  const hasTotalSupplied = totalSuppliedUsd != null && Number.isFinite(totalSuppliedUsd) && totalSuppliedUsd >= 0;
  if (!hasDeficit) return null;

  const ratio = calculateDeficitShareRatio({ deficitUsd, totalSuppliedUsd });
  const percentage = ratio != null ? Math.min(Math.max(ratio * 100, 0), 100) : 0;
  const severity = getDeficitSeverity(ratio);
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const getProgressColor = () => {
    if (severity === 'critical') return 'rgb(var(--ds-amber-500-rgb, 245 158 11))';
    if (severity === 'warning') return 'rgb(var(--ds-amber-600-rgb, 217 119 6))';
    return 'rgb(var(--ds-muted-foreground-rgb, 100 116 139) / 0.75)';
  };

  const tooltipContent = (
    <TooltipContent side="right" className="max-w-[240px]">
      <TooltipCalloutArrow />
      <DeficitProgressContent
        deficitUsd={deficitUsd}
        totalSuppliedUsd={totalSuppliedUsd}
        tokenDeficitLabel={tokenDeficitLabel}
        displayMode={displayMode}
        tokenPrice={tokenPrice}
        tokenSymbol={tokenSymbol}
        poolExplorerUrl={poolExplorerUrl}
        onSortPercentage={onSort}
        isSortActive={isSortActive}
        sortOrder={sortOrder}
        onSortDeficitAmount={onSortSize || onSortDeficitAmount}
        isSortDeficitAmountActive={isSortDeficitAmountActive}
        deficitAmountSortOrder={deficitAmountSortOrder}
      />
    </TooltipContent>
  );

  const ringNode = (
    <div
      className={cn(
        'inline-flex items-center p-0.5 -m-0.5 rounded-full transition-all duration-150 cursor-auto',
        severity === 'neutral'
          ? 'opacity-70 saturate-0 hover:bg-muted/40 hover:scale-100'
          : 'hover:bg-muted/70 hover:scale-[1.12]',
      )}
    >
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
                aria-label={`Sort by deficit amount`}
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

DeficitLiquidityRing.displayName = 'DeficitLiquidityRing';

export default DeficitLiquidityRing;
