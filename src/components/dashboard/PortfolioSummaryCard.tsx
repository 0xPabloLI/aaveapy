/**
 * PortfolioSummaryCard — displays aggregated portfolio metrics:
 * Total Supply, Total Borrow, Net Daily Earn, Supply/Borrow Weighted APY.
 *
 * Total Supply / Total Borrow 是绝对总量（含 manual + wallet + delta 的合并 amount），
 * 不显示 delta——delta 是"当前 amount vs 钱包快照"的差，只对单个 wallet position 行有语义。
 * 在包含 manual 仓位的聚合总量上叠加 delta 会误导用户（manual 部分没有 wallet 基线）。
 */
import { memo } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Percent } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPercent } from '@/lib/formatters';
import { useIsMobile } from '@/hooks/use-mobile';
import type { PortfolioSummary } from '@/types/portfolio';

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
  if (value < 0) return `-$${Math.abs(value).toFixed(2)}/day`;
  if (value > 0) return `+$${value.toFixed(2)}/day`;
  return '$0.00/day';
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
  const netColor = 'text-foreground';
  const isMobile = useIsMobile();

  return (
    <div className="grid grid-cols-2 gap-3 rounded-lg border border-border/50 bg-muted/30 px-3 py-2.5 sm:grid-cols-4">
      <MetricCell
        label="Total Supply"
        value={formatUsd(summary.totalSupplyUsd)}
        icon={<TrendingUp className="size-3 ds-text-emerald-600" aria-hidden />}
        valueClass="ds-text-emerald-600"
      />
      <MetricCell
        label="Total Borrow"
        value={formatUsd(summary.totalBorrowUsd)}
        icon={<TrendingDown className="size-3 ds-text-brand-cyan" aria-hidden />}
        valueClass="ds-text-brand-cyan"
      />
      <MetricCell
        label="Net Daily Earn"
        value={formatUsdPerDay(summary.netUsdPerDay)}
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
