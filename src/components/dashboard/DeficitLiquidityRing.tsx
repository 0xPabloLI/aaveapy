import type { ReactNode } from 'react';
import { memo } from 'react';
import { ExternalLink } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipCalloutArrow } from '@/components/ui/tooltip';
import { formatScenarioSize } from '@/lib/formatters';
import { calculateDeficitShareRatio, getDeficitSeverity } from '@/lib/deficit';
import { cn } from '@/lib/utils';

export interface DeficitTooltipBodyProps {
  deficitUsd: number;
  totalSuppliedUsd: number | null | undefined;
  deficitTokenLabel?: string;
  displayMode?: 'usd' | 'token';
  tokenPrice?: number | null;
  tokenSymbol?: string | null;
  poolExplorerUrl?: string | null;
}

export function DeficitTooltipBody({
  deficitUsd,
  totalSuppliedUsd,
  deficitTokenLabel,
  displayMode = 'usd',
  tokenPrice,
  tokenSymbol,
  poolExplorerUrl,
}: DeficitTooltipBodyProps) {
  const ratio = calculateDeficitShareRatio({ deficitUsd, totalSuppliedUsd });
  const percentage = ratio != null ? Math.min(Math.max(ratio * 100, 0), 100) : 0;
  const severity = getDeficitSeverity(ratio);
  const colorClass =
    severity === 'critical' ? 'ds-text-amber-500' : severity === 'warning' ? 'ds-text-amber-600' : 'text-muted-foreground/60';
  const hasTotalSupplied = totalSuppliedUsd != null && Number.isFinite(totalSuppliedUsd) && totalSuppliedUsd >= 0;

  const deficitDisplay =
    displayMode === 'token' && deficitTokenLabel
      ? deficitTokenLabel
      : formatScenarioSize(deficitUsd, { inputMode: 'usd' });
  const totalDisplay = formatScenarioSize(totalSuppliedUsd, {
    inputMode: displayMode,
    tokenPrice,
    tokenSymbol,
  });

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
        <span className={`font-medium tabular-nums ${colorClass}`}>
          {deficitDisplay}
        </span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="text-muted-foreground">Total supplied</span>
        <span className={`font-medium tabular-nums ${colorClass}`}>
          {hasTotalSupplied ? totalDisplay : '—'}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/35">
        <span className="text-muted-foreground">% of total (incl. deficit)</span>
        <span className={`font-bold tabular-nums leading-none ${colorClass}`}>
          {ratio != null ? `${percentage.toFixed(2)}%` : '—'}
        </span>
      </div>
    </div>
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
}: DeficitLiquidityRingProps) => {
  const hasDeficit = deficitUsd != null && Number.isFinite(deficitUsd) && deficitUsd > 0;
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
      <DeficitTooltipBody
        deficitUsd={deficitUsd}
        totalSuppliedUsd={totalSuppliedUsd}
        deficitTokenLabel={tokenDeficitLabel}
        displayMode={displayMode}
        tokenPrice={tokenPrice}
        tokenSymbol={tokenSymbol}
        poolExplorerUrl={poolExplorerUrl}
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
            onClick={(event) => event.stopPropagation()}
          >
            {label}
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
