import { ExternalLink } from 'lucide-react';
import {
  formatPercent,
  formatScenarioSize,
} from '@/lib/formatters';
import {
  calculateDeficitShareRatio,
  getDeficitSeverity,
} from '@/lib/deficit';
import { getAvailableToBorrowUsd } from '@/lib/scenarioSize';

/** Same content as CapProgressRing tooltip; used in mobile bottom sheet. */
export function SupplyCapSheetContent({
  currentSize,
  cap,
  inputMode,
  tokenPrice,
  tokenSymbol,
}: {
  currentSize: number;
  cap: number;
  inputMode: 'usd' | 'token';
  tokenPrice?: number | null;
  tokenSymbol?: string | null;
}) {
  const percentage = Math.min((currentSize / cap) * 100, 100);
  const colorClass =
    percentage >= 95 ? 'text-amber-600' : percentage >= 80 ? 'text-amber-500' : 'ds-text-emerald-500';
  return (
    <div className="space-y-1 ds-text-12">
      <div className="flex justify-between gap-3">
        <span className="text-muted-foreground">Total supplied</span>
        <span className="font-medium tabular-nums ds-text-emerald-500">
          {formatScenarioSize(currentSize, { inputMode, tokenPrice, tokenSymbol })}
        </span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="text-muted-foreground">Supply cap</span>
        <span className="font-medium tabular-nums ds-text-emerald-500">
          {formatScenarioSize(cap, { inputMode, tokenPrice, tokenSymbol })}
        </span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="text-muted-foreground">Available to supply</span>
        <span className="font-medium tabular-nums ds-text-emerald-500">
          {formatScenarioSize(Math.max(0, cap - currentSize), { inputMode, tokenPrice, tokenSymbol })}
        </span>
      </div>
      <div className="flex justify-between gap-3 pt-1 border-t border-border/50">
        <span className="text-muted-foreground">% of cap</span>
        <span className={`font-bold tabular-nums ${colorClass}`}>{percentage.toFixed(1)}%</span>
      </div>
    </div>
  );
}

/** Same content as BorrowCapProgressRing tooltip; used in mobile bottom sheet. */
export function BorrowCapSheetContent({
  borrowed,
  cap,
  poolLiquidity,
  inputMode,
  tokenPrice,
  tokenSymbol,
}: {
  borrowed: number;
  cap: number;
  poolLiquidity: number;
  inputMode: 'usd' | 'token';
  tokenPrice?: number | null;
  tokenSymbol?: string | null;
}) {
  const percentage = Math.min((borrowed / cap) * 100, 100);
  const availableToBorrow = getAvailableToBorrowUsd({
    borrowedUsd: borrowed,
    borrowCapUsd: cap,
    poolLiquidityUsd: poolLiquidity,
  }) ?? 0;
  const colorClass =
    percentage >= 95 ? 'text-amber-600' : percentage >= 80 ? 'text-amber-500' : 'ds-text-brand-cyan';
  return (
    <div className="space-y-1 ds-text-12">
      <div className="flex justify-between gap-3">
        <span className="text-muted-foreground">Total borrowed</span>
        <span className="font-medium tabular-nums ds-text-brand-cyan">
          {formatScenarioSize(borrowed, { inputMode, tokenPrice, tokenSymbol })}
        </span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="text-muted-foreground">Borrow cap</span>
        <span className="font-medium tabular-nums ds-text-brand-cyan">
          {formatScenarioSize(cap, { inputMode, tokenPrice, tokenSymbol })}
        </span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="text-muted-foreground">Pool liquidity</span>
        <span className="font-medium tabular-nums ds-text-purple-600">
          {formatScenarioSize(poolLiquidity, { inputMode, tokenPrice, tokenSymbol })}
        </span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="text-muted-foreground">Available to borrow</span>
        <span className="font-medium tabular-nums ds-text-brand-cyan">
          {formatScenarioSize(availableToBorrow, { inputMode, tokenPrice, tokenSymbol })}
        </span>
      </div>
      <div className="flex justify-between gap-3 pt-1 border-t border-border/50">
        <span className="text-muted-foreground">% of cap</span>
        <span className={`font-bold tabular-nums ${colorClass}`}>{percentage.toFixed(1)}%</span>
      </div>
    </div>
  );
}

/** Utilization bottom sheet content */
export function UtilizationSheetContent({ current, optimal }: { current: number; optimal: number }) {
  const isOverOptimal = current > optimal;
  return (
    <div className="space-y-2 ds-text-12">
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">Optimal</span>
        <span className="font-medium tabular-nums">{formatPercent(optimal)}</span>
      </div>
      {isOverOptimal ? (
        <p className="text-amber-600 ds-text-11 pt-2 border-t border-border/50">
          ⚠️ Above optimal
        </p>
      ) : (
        <p className="ds-text-brand-cyan ds-text-11 pt-2 border-t border-border/50">
          Below optimal
        </p>
      )}
    </div>
  );
}

/** Deficit details bottom sheet content */
export function DeficitSheetContent({
  deficitUsd,
  totalSuppliedUsd,
  deficitTokenLabel,
  inputMode,
  tokenPrice,
  tokenSymbol,
  poolExplorerUrl,
}: {
  deficitUsd: number;
  totalSuppliedUsd: number | null | undefined;
  deficitTokenLabel?: string;
  inputMode: 'usd' | 'token';
  tokenPrice?: number | null;
  tokenSymbol?: string | null;
  poolExplorerUrl?: string | null;
}) {
  const ratio = calculateDeficitShareRatio({ deficitUsd, totalSuppliedUsd });
  const percentage = ratio != null ? Math.min(Math.max(ratio * 100, 0), 100) : null;
  const severity = getDeficitSeverity(ratio);
  const percentColorClass =
    severity === 'critical' ? 'text-amber-600' : severity === 'warning' ? 'text-amber-500' : 'text-muted-foreground/60';

  const deficitDisplay = inputMode === 'token' && deficitTokenLabel
    ? deficitTokenLabel
    : formatScenarioSize(deficitUsd, { inputMode: 'usd' });
  const totalDisplay = totalSuppliedUsd != null
    ? formatScenarioSize(totalSuppliedUsd, { inputMode, tokenPrice, tokenSymbol })
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
              aria-label="Verify on-chain"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </span>
        <span className="font-medium tabular-nums">{deficitDisplay}</span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="text-muted-foreground">Total supplied</span>
        <span className="font-medium tabular-nums">{totalDisplay}</span>
      </div>
      <div className="flex items-center justify-between gap-3 pt-1 border-t border-border/50">
        <span className="text-muted-foreground flex items-center gap-1">
          % of total (incl. deficit)
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
        <span className={`font-bold tabular-nums ${percentColorClass}`}>
          {percentage != null ? `${percentage.toFixed(2)}%` : '—'}
        </span>
      </div>
    </div>
  );
}
