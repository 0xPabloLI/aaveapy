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
import { FrozenStatusContent } from './FrozenStatusBadge';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface SheetRowProps {
  label: ReactNode;
  value: ReactNode;
  divider?: boolean;
  colorClass?: string;
  labelClassName?: string;
}

function SheetRow({ label, value, divider, colorClass, labelClassName }: SheetRowProps) {
  return (
    <div className={`flex justify-between gap-3${divider ? ' pt-1 border-t border-border/50' : ''}`}>
      <span className={cn('text-muted-foreground', labelClassName)}>{label}</span>
      <span className={cn('font-medium tabular-nums', divider && 'font-bold', colorClass)}>
        {value}
      </span>
    </div>
  );
}

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
    percentage >= 95 ? 'ds-text-amber-500' : percentage >= 80 ? 'ds-text-amber-600' : 'ds-text-emerald-500';
  return (
    <div className="space-y-1 ds-text-12">
      <SheetRow label="Total supplied" value={formatScenarioSize(currentSize, { inputMode, tokenPrice, tokenSymbol })} colorClass="ds-text-emerald-500" />
      <SheetRow label="Supply cap" value={formatScenarioSize(cap, { inputMode, tokenPrice, tokenSymbol })} colorClass="ds-text-emerald-500" />
      <SheetRow label="Available to supply" value={formatScenarioSize(Math.max(0, cap - currentSize), { inputMode, tokenPrice, tokenSymbol })} colorClass="ds-text-emerald-500" />
      <SheetRow divider label="% of cap" value={`${percentage.toFixed(1)}%`} colorClass={colorClass} />
    </div>
  );
}

/** Same content as BorrowCapProgressRing tooltip; used in mobile bottom sheet. */
export function BorrowCapSheetContent({
  borrowed,
  cap,
  availableLiquidityUsd,
  inputMode,
  tokenPrice,
  tokenSymbol,
  borrowDisabled,
}: {
  borrowed: number;
  cap: number;
  availableLiquidityUsd: number;
  inputMode: 'usd' | 'token';
  tokenPrice?: number | null;
  tokenSymbol?: string | null;
  borrowDisabled?: boolean;
}) {
  const percentage = Math.min((borrowed / cap) * 100, 100);
  const availableToBorrow = borrowDisabled
    ? 0
    : getAvailableToBorrowUsd({
        borrowedUsd: borrowed,
        borrowCapUsd: cap,
        availableLiquidityUsd,
      }) ?? 0;
  const colorClass =
    percentage >= 95 ? 'ds-text-amber-500' : percentage >= 80 ? 'ds-text-amber-600' : 'ds-text-brand-cyan';
  return (
    <div className="space-y-1 ds-text-12">
      <SheetRow label="Total borrowed" value={formatScenarioSize(borrowed, { inputMode, tokenPrice, tokenSymbol })} colorClass="ds-text-brand-cyan" />
      <SheetRow label="Borrow cap" value={formatScenarioSize(cap, { inputMode, tokenPrice, tokenSymbol })} colorClass="ds-text-brand-cyan" />
      <SheetRow
        label="Available liquidity"
        value={formatScenarioSize(availableLiquidityUsd, { inputMode, tokenPrice, tokenSymbol })}
        colorClass={availableLiquidityUsd < 10000 ? 'ds-text-amber-600' : 'ds-text-purple-600'}
      />
      <SheetRow label="Available to borrow" value={formatScenarioSize(availableToBorrow, { inputMode, tokenPrice, tokenSymbol })} colorClass="ds-text-brand-cyan" />
      <SheetRow divider label="% of cap" value={`${percentage.toFixed(1)}%`} colorClass={colorClass} />
    </div>
  );
}

/** Utilization bottom sheet content */
export function UtilizationSheetContent({ current, optimal }: { current: number; optimal: number }) {
  const isOverOptimal = current > optimal;
  return (
    <div className="space-y-1 ds-text-12">
      <SheetRow label="Optimal" value={formatPercent(optimal)} />
      <SheetRow divider label="Current utilization" value={formatPercent(current)} colorClass={isOverOptimal ? 'text-amber-600' : 'text-muted-foreground'} />
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
    severity === 'critical' ? 'ds-text-amber-500' : severity === 'warning' ? 'ds-text-amber-600' : 'text-muted-foreground/60';

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
        <span className={`font-medium tabular-nums ${percentColorClass}`}>{deficitDisplay}</span>
      </div>
      <SheetRow label="Total supplied" value={totalDisplay} colorClass={percentColorClass} />
      <SheetRow divider label="% of total (incl. deficit)" value={percentage != null ? `${percentage.toFixed(2)}%` : '—'} colorClass={percentColorClass} />
    </div>
  );
}

/** Frozen/paused status bottom sheet content */
export function FrozenSheetContent({ isFrozen, isPaused }: { isFrozen?: boolean; isPaused?: boolean }) {
  return <FrozenStatusContent isFrozen={isFrozen} isPaused={isPaused} />;
}
