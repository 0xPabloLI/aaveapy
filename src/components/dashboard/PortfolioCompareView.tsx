/**
 * PortfolioCompareView — side-by-side comparison of two portfolio snapshots.
 */
import { memo } from 'react';
import { X, ArrowRightLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPercent } from '@/lib/formatters';
import { TokenIcon } from '@/components/primitives/TokenIcon';
import type { PortfolioSnapshot, PortfolioSummary } from '@/types/portfolio';

interface PortfolioCompareViewProps {
  snapshotA: PortfolioSnapshot;
  snapshotB: PortfolioSnapshot;
  onClose: () => void;
}

function formatUsd(value: number): string {
  if (value === 0) return '$0';
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
}

function formatUsdPerDay(value: number): string {
  const prefix = value > 0 ? '+' : '';
  return `${prefix}$${Math.abs(value).toFixed(2)}/day`;
}

function formatDelta(a: number, b: number, formatter: (v: number) => string): string {
  const delta = b - a;
  if (delta === 0) return '—';
  const sign = delta > 0 ? '+' : '';
  return `${sign}${formatter(Math.abs(delta))}`;
}

/** Single metric comparison row */
const CompareMetric = memo(function CompareMetric({
  label,
  valueA,
  valueB,
  delta,
  deltaClass,
}: {
  label: string;
  valueA: string;
  valueB: string;
  delta: string;
  deltaClass?: string;
}) {
  return (
    <div className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2 py-1.5 border-b border-border/30 last:border-0">
      <span className="ds-text-11 text-muted-foreground font-medium">{label}</span>
      <span className="ds-text-12 font-bold tabular-nums text-foreground text-right">{valueA}</span>
      <span className="ds-text-12 font-bold tabular-nums text-foreground text-right">{valueB}</span>
      <span className={cn('ds-text-11 font-semibold tabular-nums text-right min-w-[60px]', deltaClass ?? 'text-muted-foreground')}>
        {delta}
      </span>
    </div>
  );
});

/** Per-token comparison row */
const TokenCompareRow = memo(function TokenCompareRow({
  tokenSymbol,
  side,
  aprA,
  aprB,
  usdDayA,
  usdDayB,
}: {
  tokenSymbol: string;
  side: 'supply' | 'borrow';
  aprA: number | null;
  aprB: number | null;
  usdDayA: number | null;
  usdDayB: number | null;
}) {
  const isBorrow = side === 'borrow';
  return (
    <div className="grid grid-cols-[auto_1fr_1fr_1fr] items-center gap-2 py-1 border-b border-border/20 last:border-0">
      <div className="flex items-center gap-1">
        <TokenIcon symbol={tokenSymbol} size={14} />
        <span className="ds-text-10 font-semibold text-foreground">{tokenSymbol}</span>
        <span className={cn('ds-text-10 font-medium', isBorrow ? 'ds-text-brand-cyan' : 'ds-text-emerald-600')}>
          {isBorrow ? 'B' : 'S'}
        </span>
      </div>
      <span className="ds-text-11 tabular-nums text-foreground text-right">
        {aprA !== null ? formatPercent(aprA) : '—'}
      </span>
      <span className="ds-text-11 tabular-nums text-foreground text-right">
        {aprB !== null ? formatPercent(aprB) : '—'}
      </span>
      <span className={cn(
        'ds-text-10 tabular-nums font-medium text-right',
        usdDayA !== null && usdDayB !== null
          ? (usdDayB - (usdDayA ?? 0)) >= 0 ? 'ds-text-emerald-600' : 'text-destructive'
          : 'text-muted-foreground',
      )}>
        {usdDayA !== null && usdDayB !== null
          ? formatDelta(usdDayA, usdDayB, (v) => `$${v.toFixed(2)}`)
          : '—'}
      </span>
    </div>
  );
});

const PortfolioCompareView = memo(function PortfolioCompareView({
  snapshotA,
  snapshotB,
  onClose,
}: PortfolioCompareViewProps) {
  const sA = snapshotA.summary;
  const sB = snapshotB.summary;

  const netDeltaPositive = sB.netUsdPerDay - sA.netUsdPerDay >= 0;
  const deltaColor = (a: number, b: number) =>
    b - a > 0 ? 'ds-text-emerald-600' : b - a < 0 ? 'text-destructive' : 'text-muted-foreground';

  // Merge token lists from both snapshots
  const allTokenKeys = new Set<string>();
  const tokenMap = new Map<string, { symbol: string; side: 'supply' | 'borrow'; aprA: number | null; aprB: number | null; usdDayA: number | null; usdDayB: number | null }>();

  for (const r of snapshotA.positionResults) {
    const key = `${r.reserveId}-${r.side}`;
    allTokenKeys.add(key);
    const pos = snapshotA.entries.find(p => p.reserveId === r.reserveId);
    tokenMap.set(key, { symbol: pos?.tokenSymbol ?? '?', side: r.side, aprA: r.totalPercent, aprB: null, usdDayA: r.usdPerDay, usdDayB: null });
  }
  for (const r of snapshotB.positionResults) {
    const key = `${r.reserveId}-${r.side}`;
    allTokenKeys.add(key);
    const pos = snapshotB.entries.find(p => p.reserveId === r.reserveId);
    const existing = tokenMap.get(key);
    if (existing) {
      existing.aprB = r.totalPercent;
      existing.usdDayB = r.usdPerDay;
    } else {
      tokenMap.set(key, { symbol: pos?.tokenSymbol ?? '?', side: r.side, aprA: null, aprB: r.totalPercent, usdDayA: null, usdDayB: r.usdPerDay });
    }
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm px-4 py-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="size-4 ds-text-brand-cyan" aria-hidden />
          <span className="ds-text-14 font-semibold text-foreground">Compare Snapshots</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
          aria-label="Close comparison"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 pb-1 border-b border-border/50">
        <span className="ds-text-10 font-semibold text-muted-foreground uppercase tracking-wide">Metric</span>
        <span className="ds-text-10 font-semibold text-muted-foreground text-right truncate" title={snapshotA.label}>{snapshotA.label}</span>
        <span className="ds-text-10 font-semibold text-muted-foreground text-right truncate" title={snapshotB.label}>{snapshotB.label}</span>
        <span className="ds-text-10 font-semibold text-muted-foreground text-right min-w-[60px]">Delta</span>
      </div>

      {/* Summary metrics */}
      <CompareMetric
        label="Total Supply"
        valueA={formatUsd(sA.totalSupplyUsd)}
        valueB={formatUsd(sB.totalSupplyUsd)}
        delta={formatDelta(sA.totalSupplyUsd, sB.totalSupplyUsd, formatUsd)}
        deltaClass={deltaColor(sA.totalSupplyUsd, sB.totalSupplyUsd)}
      />
      <CompareMetric
        label="Total Borrow"
        valueA={formatUsd(sA.totalBorrowUsd)}
        valueB={formatUsd(sB.totalBorrowUsd)}
        delta={formatDelta(sA.totalBorrowUsd, sB.totalBorrowUsd, formatUsd)}
        deltaClass={deltaColor(sA.totalBorrowUsd, sB.totalBorrowUsd)}
      />
      <CompareMetric
        label="Net Daily"
        valueA={formatUsdPerDay(sA.netUsdPerDay)}
        valueB={formatUsdPerDay(sB.netUsdPerDay)}
        delta={formatDelta(sA.netUsdPerDay, sB.netUsdPerDay, (v) => `$${v.toFixed(2)}`)}
        deltaClass={netDeltaPositive ? 'ds-text-emerald-600' : 'text-destructive'}
      />
      <CompareMetric
        label="Net APY"
        valueA={formatPercent(sA.netEffectiveApy)}
        valueB={formatPercent(sB.netEffectiveApy)}
        delta={formatDelta(sA.netEffectiveApy, sB.netEffectiveApy, (v) => formatPercent(v))}
        deltaClass={deltaColor(sA.netEffectiveApy, sB.netEffectiveApy)}
      />

      {/* Per-token breakdown */}
      {tokenMap.size > 0 && (
        <div className="mt-2">
          <div className="grid grid-cols-[auto_1fr_1fr_1fr] gap-2 pb-1 border-b border-border/40">
            <span className="ds-text-10 font-semibold text-muted-foreground">Token</span>
            <span className="ds-text-10 font-semibold text-muted-foreground text-right truncate">{snapshotA.label}</span>
            <span className="ds-text-10 font-semibold text-muted-foreground text-right truncate">{snapshotB.label}</span>
            <span className="ds-text-10 font-semibold text-muted-foreground text-right">Δ USD/d</span>
          </div>
          {Array.from(tokenMap.values()).map((t, i) => (
            <TokenCompareRow key={i} tokenSymbol={t.symbol} side={t.side} aprA={t.aprA} aprB={t.aprB} usdDayA={t.usdDayA} usdDayB={t.usdDayB} />
          ))}
        </div>
      )}
    </div>
  );
});

export default PortfolioCompareView;
