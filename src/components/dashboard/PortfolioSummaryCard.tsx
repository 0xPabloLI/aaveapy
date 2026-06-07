import { useIsMobile } from '@/hooks/use-mobile';

/** Aggregated portfolio metrics passed from the parent panel. */
export interface PortfolioSummary {
  totalSupplyUsd: number;
  totalBorrowUsd: number;
  netApy: number;
  dailyEarningsUsd: number;
}

interface PortfolioSummaryCardProps {
  summary: PortfolioSummary | null;
}

function formatUsdCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

const PortfolioSummaryCard = ({ summary }: PortfolioSummaryCardProps) => {
  const isMobile = useIsMobile();

  if (!summary) return null;

  return (
    <div className="rounded-xl border border-border/50 bg-card p-4">
      {/* 4-cell metric grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <div className="min-w-0">
          <p className="ds-text-11 text-muted-foreground">Total Supply</p>
          <p className="ds-text-14 font-semibold tabular-nums">{formatUsdCompact(summary.totalSupplyUsd)}</p>
        </div>
        <div className="min-w-0">
          <p className="ds-text-11 text-muted-foreground">Total Borrow</p>
          <p className="ds-text-14 font-semibold tabular-nums">{formatUsdCompact(summary.totalBorrowUsd)}</p>
        </div>
        <div className="min-w-0">
          <p className="ds-text-11 text-muted-foreground">Net APY</p>
          <p className="ds-text-14 font-semibold tabular-nums">{formatPercent(summary.netApy)}</p>
        </div>
        <div className="min-w-0">
          <p className="ds-text-11 text-muted-foreground">Daily Earnings</p>
          <p className="ds-text-14 font-semibold tabular-nums">{formatUsdCompact(summary.dailyEarningsUsd)}</p>
        </div>
      </div>

      {/* Simulation disclaimer — flush against card bottom border (no mt) */}
      <p className="ds-text-10 text-muted-foreground/70 italic">
        {isMobile
          ? 'Simulation only; final result is on-chain.'
          : 'Simulation is for reference only. Final result depends on on-chain execution.'}
      </p>
    </div>
  );
};

export default PortfolioSummaryCard;
