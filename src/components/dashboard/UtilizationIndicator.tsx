import { memo, useId } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { formatPercent } from '@/lib/formatters';


/**
 * Visual fraction display for the utilization formula.
 *
 *       borrowed
 *   = ─────────────
 *      liquidity + borrowed
 *
 * Color-codes `borrowed` (brand cyan) and `liquidity` (purple) to match
 * the semantic tokens used elsewhere in the tooltip.
 */
function UtilizationFormula() {
  return (
    <div className="rounded-lg border border-border bg-muted/40 px-1.5 py-2">
      <div className="flex items-center justify-center gap-1 font-mono ds-text-11 text-foreground leading-[1.1]">
        <span className="shrink-0 text-muted-foreground">=</span>
        <div className="flex flex-col items-stretch text-center">
          <span className="px-1 pb-0.5">
            <span className="ds-text-brand-cyan font-semibold">borrowed</span>
          </span>
          <span className="h-px w-full bg-foreground/60" />
          <span className="flex flex-wrap items-center justify-center gap-x-0.5 gap-y-0 px-1 pt-0.5">
            <span className="ds-text-purple-600 font-semibold">liquidity</span>
            <span className="text-muted-foreground">+</span>
            <span className="ds-text-brand-cyan font-semibold">borrowed</span>
          </span>
        </div>
      </div>
    </div>
  );
}

interface UtilizationIndicatorProps {
  current: number | null;
  optimal: number | null;
  width?: number;
  height?: number;
}

function SortArrowButton({
  onClick,
  isActive,
  sortOrder,
  ariaLabel,
  className,
}: {
  onClick: () => void;
  isActive: boolean;
  sortOrder?: 'asc' | 'desc';
  ariaLabel: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`ml-1 inline-flex items-center transition-colors ${
        isActive ? (className ?? 'text-foreground') : 'text-muted-foreground/60 hover:text-foreground'
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

/** Shared utilization data display — reused by desktop tooltip and mobile bottom sheet. */
export function UtilizationContent({
  current,
  optimal,
  onSortUtilization,
  isSortUtilizationActive,
  utilizationSortOrder,
  onSortOptimal,
  isSortOptimalActive,
  optimalSortOrder,
}: {
  current: number;
  optimal: number;
  onSortUtilization?: () => void;
  isSortUtilizationActive?: boolean;
  utilizationSortOrder?: 'asc' | 'desc';
  onSortOptimal?: () => void;
  isSortOptimalActive?: boolean;
  optimalSortOrder?: 'asc' | 'desc';
}) {
  const isOverOptimal = current > optimal;

  const utilizationArrow = onSortUtilization
    ? <SortArrowButton onClick={onSortUtilization} isActive={!!isSortUtilizationActive} sortOrder={utilizationSortOrder} ariaLabel="Sort by utilization" className={isOverOptimal ? 'ds-text-amber-600' : 'text-foreground'} />
    : null;

  const optimalArrow = onSortOptimal
    ? <SortArrowButton onClick={onSortOptimal} isActive={!!isSortOptimalActive} sortOrder={optimalSortOrder} ariaLabel="Sort by optimal utilization" className="text-foreground" />
    : null;

  return (
    <div className="space-y-1 ds-text-12">
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">Optimal utilization</span>
        <span className="font-medium tabular-nums">
          {formatPercent(optimal)}
          {optimalArrow}
        </span>
      </div>
      <div className="flex justify-between gap-4 pt-2 border-t border-border/50">
        <span className="text-muted-foreground">Current utilization</span>
        <span className={`font-bold tabular-nums ${isOverOptimal ? 'text-amber-600' : 'text-muted-foreground'}`}>
          {formatPercent(current)}
          {utilizationArrow}
        </span>
      </div>
      <div className="pt-2 border-t border-border/50">
        <UtilizationFormula />
      </div>
    </div>
  );
}

/** Pure SVG utilization bar — callers wrap with Tooltip as needed. */
const UtilizationIndicator = memo(({
  current,
  optimal,
  width = 10,
  height = 24,
}: UtilizationIndicatorProps) => {
  const clipId = useId();

  if (current === null || optimal === null || !Number.isFinite(current) || !Number.isFinite(optimal)) {
    return null;
  }

  const clampedCurrent = Math.max(0, Math.min(100, current));
  const clampedOptimal = Math.max(0, Math.min(100, optimal));
  
  const optimalY = height - (clampedOptimal / 100) * height;
  const currentY = height - (clampedCurrent / 100) * height;
  
  const isOverOptimal = current > optimal;

  const dotRadius = 2.5;
  const trackWidth = 4;
  const trackX = (width - trackWidth) / 2;
  const trackRadius = trackWidth / 2;

  return (
    <div
      className="inline-flex items-center cursor-default"
      style={{ width, height }}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
      >
        <defs>
          <clipPath id={clipId}>
            <rect
              x={trackX}
              y={0}
              width={trackWidth}
              height={height}
              rx={trackRadius}
            />
          </clipPath>
        </defs>
        <rect
          x={trackX}
          y={0}
          width={trackWidth}
          height={height}
          rx={trackRadius}
          className="fill-secondary/40"
        />
        <rect
          x={trackX}
          y={optimalY}
          width={trackWidth}
          height={height - optimalY}
          clipPath={`url(#${clipId})`}
          className="fill-[rgb(var(--ds-brand-cyan-rgb)/0.32)]"
        />
        <rect
          x={trackX}
          y={0}
          width={trackWidth}
          height={optimalY}
          clipPath={`url(#${clipId})`}
          className="fill-[rgb(var(--ds-amber-600-rgb))]"
        />
        <circle
          cx={width / 2}
          cy={currentY}
          r={dotRadius}
          className={isOverOptimal ? 'fill-[rgb(var(--ds-amber-600-rgb))]' : 'fill-[rgb(var(--ds-brand-cyan-rgb))]'}
        />
      </svg>
    </div>
  );
});

UtilizationIndicator.displayName = 'UtilizationIndicator';

export default UtilizationIndicator;
