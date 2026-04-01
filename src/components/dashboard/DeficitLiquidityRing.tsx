import type { ReactNode } from 'react';
import { memo } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatScenarioSize } from '@/lib/formatters';
import { calculateDeficitShareRatio, getDeficitSeverity } from '@/lib/deficit';
import { cn } from '@/lib/utils';

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
    if (severity === 'critical') return 'rgb(var(--ds-amber-600-rgb, 217 119 6))';
    if (severity === 'warning') return 'rgb(var(--ds-amber-500-rgb, 245 158 11))';
    return 'rgb(var(--ds-muted-foreground-rgb, 100 116 139) / 0.75)';
  };

  const getProgressColorClass = () => {
    if (severity === 'critical') return 'text-amber-600';
    if (severity === 'warning') return 'text-amber-500';
    return 'text-muted-foreground/60';
  };

  const deficitDisplayValue = displayMode === 'token'
    ? (tokenDeficitLabel ?? '—')
    : formatScenarioSize(deficitUsd, { inputMode: 'usd' });
  const totalSuppliedDisplayValue = formatScenarioSize(totalSuppliedUsd, {
    inputMode: displayMode,
    tokenPrice,
    tokenSymbol,
  });

  const tooltipContent = (
    <TooltipContent side="top" className="max-w-[240px]">
      <div className="space-y-1 ds-text-12">
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">Deficit</span>
          <span className="font-medium tabular-nums">
            {deficitDisplayValue}
          </span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">Total supplied</span>
          <span className="font-medium tabular-nums">
            {hasTotalSupplied ? totalSuppliedDisplayValue : '—'}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/35">
          <span className="text-muted-foreground">% of total (incl. deficit)</span>
          <span className={`self-center font-bold tabular-nums leading-none ${getProgressColorClass()}`}>
            {ratio != null ? `${percentage.toFixed(2)}%` : '—'}
          </span>
        </div>
      </div>
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
