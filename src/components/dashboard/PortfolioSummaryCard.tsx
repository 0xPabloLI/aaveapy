/**
 * PortfolioSummaryCard — displays aggregated portfolio metrics:
 * Total Supply, Total Borrow, Net Daily Earn, Supply/Borrow Weighted APY.
 * When delta metrics are available, inline delta is shown after the value.
 */
import { memo } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Percent } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPercent } from '@/lib/formatters';
import { useIsMobile } from '@/hooks/use-mobile';
import type { PortfolioSummary, PortfolioSimulationMetric } from '@/types/portfolio';

interface PortfolioSummaryCardProps {
  summary: PortfolioSummary;
}

function formatUsd(value: number): string {
  if (value === 0) return '$0';
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `$${(value / 1_000).toFixed(2)}K`;
  }
  return `$${value.toFixed(2)}`;
}

function formatUsdPerDay(value: number): string {
  const prefix = value > 0 ? '+' : '';
  return `${prefix}$${Math.abs(value).toFixed(2)}/day`;
}

const formatDeltaUsd = (value: number | null | undefined): string | null => {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  if (Math.abs(value) < 0.005) return null;
  const prefix = value > 0 ? '+' : '';
  return `${prefix}$${Math.abs(value).toFixed(2)}`;
};

const MetricCell = memo(function MetricCell({
  label,
  value,
  delta,
  icon,
  valueClass,
  deltaClass,
}: {
  label: string;
  value: string;
  delta?: string | null;
  icon: React.ReactNode;
  valueClass?: string;
  deltaClass?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="ds-text-10 text-muted-foreground font-medium flex items-center gap-1">
        {icon}
        {label}
      </span>
      <span
        className={cn(
          'ds-text-14 font-bold tabular-nums',
          valueClass ?? 'text-foreground',
        )}
      >
        {value}
        {delta && (
          <span className={cn('ds-text-11 font-semibold tabular-nums ml-1.5', deltaClass ?? valueClass ?? 'text-foreground')}>
            {delta}
          </span>
        )}
      </span>
    </div>
  );
});

const PortfolioSummaryCard = memo(function PortfolioSummaryCard({
  summary,
}: PortfolioSummaryCardProps) {
  const netPositive = summary.netUsdPerDay >= 0;
  const netColor = netPositive ? 'ds-text-emerald-600' : 'text-destructive';
  const isMobile = useIsMobile();

  const supplyDelta = summary.totalSupplyUsdMetric
    ? formatDeltaUsd(summary.totalSupplyUsdMetric.delta)
    : null;
  const borrowDelta = summary.totalBorrowUsdMetric
    ? formatDeltaUsd(summary.totalBorrowUsdMetric.delta)
    : null;
  const netDailyDelta = summary.netUsdPerDayMetric
    ? formatDeltaUsd(summary.netUsdPerDayMetric.delta)
    : null;

  return (
    <div className="grid grid-cols-2 gap-3 rounded-lg border border-border/50 bg-muted/30 px-3 py-2.5 sm:grid-cols-4">
      <MetricCell
        label="Total Supply"
        value={formatUsd(summary.totalSupplyUsd)}
        delta={supplyDelta}
        icon={<TrendingUp className="size-3 ds-text-emerald-600" aria-hidden />}
        valueClass="ds-text-emerald-600"
      />
      <MetricCell
        label="Total Borrow"
        value={formatUsd(summary.totalBorrowUsd)}
        delta={borrowDelta}
        icon={<TrendingDown className="size-3 ds-text-brand-cyan" aria-hidden />}
        valueClass="ds-text-brand-cyan"
      />
      <MetricCell
        label="Net Daily Earn"
        value={formatUsdPerDay(summary.netUsdPerDay)}
        delta={netDailyDelta}
        icon={<DollarSign className="size-3" aria-hidden />}
        valueClass={netColor}
      />
      <div className="flex flex-col gap-0.5">
        <span className="ds-text-10 text-muted-foreground font-medium flex items-center gap-1">
          <Percent className="size-3" aria-hidden />
          Supply / Borrow APY
        </span>
        <span className="ds-text-14 font-bold tabular-nums">
          <span className="ds-text-emerald-600">{formatPercent(summary.supplyWeightedApy)}</span>
          <span className="text-muted-foreground"> / </span>
          <span className="ds-text-brand-cyan">{formatPercent(summary.borrowWeightedApy)}</span>
        </span>
      </div>
    </div>
  );
});

export default PortfolioSummaryCard;
