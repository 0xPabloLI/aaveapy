import { memo } from 'react';
import { cn } from '@/lib/utils';
import { formatPercent } from '@/lib/formatters';
import { getChainIconSrc } from '@/lib/chainIcons';
import { TokenIcon } from '@/components/primitives/TokenIcon';
import type { PortfolioPositionResult, PortfolioReserveEntry } from '@/types/portfolio';
import {
  PortfolioColgroup,
  PORTFOLIO_COL_COUNT,
  PF_VALUE_CELL,
  PF_DELTA_CELL,
} from './portfolioColumns';

interface PortfolioResultsTableProps {
  entries: PortfolioReserveEntry[];
  results: PortfolioPositionResult[];
}

function formatUsdCompact(value: number): string {
  if (value === 0) return '$0';
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

function formatUsdDay(value: number): string {
  if (value < 0) return `-$${Math.abs(value).toFixed(2)}`;
  if (value > 0) return `+$${value.toFixed(2)}`;
  return '$0.00';
}

const formatDeltaPercent = (value: number | null | undefined): string | null => {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  if (Math.abs(value) < 0.005) return null;
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(2)}%`;
};

// Local aliases for the shared padding tokens (kept for backward compat inside this file).
const VALUE_CELL = PF_VALUE_CELL;
const DELTA_CELL = PF_DELTA_CELL;

const DeltaCell = memo(function DeltaCell({
  value,
  accentClass,
  bandClass,
}: {
  value: string | null;
  accentClass?: string;
  bandClass?: string;
}) {
  return (
    <td
      className={cn(
        DELTA_CELL,
        bandClass,
        value ? (accentClass ?? 'text-foreground/70') : 'text-gray-300 dark:text-muted-foreground/40',
      )}
    >
      {value ?? '—'}
    </td>
  );
});

const COL_COUNT = PORTFOLIO_COL_COUNT;

const NATIVE_HEADER_BAND = 'bg-emerald-500/8 dark:bg-emerald-500/10';
const INCENTIVE_HEADER_BAND = 'bg-cyan-500/8 dark:bg-cyan-500/10';
const TOTAL_HEADER_BAND = 'bg-emerald-500/8 dark:bg-emerald-500/10';

// Muted fallback for the non-cluster header cells (Token, Amount, USD/day).
const HEADER_BASE = 'bg-muted/40';

const PortfolioResultsTable = memo(function PortfolioResultsTable({
  entries,
  results,
}: PortfolioResultsTableProps) {
  if (results.length === 0) return null;

  const entryMap = new Map(entries.map(e => [e.reserveId, e]));
  const rows: ResultRowData[] = results.map((r) => {
    const entry = entryMap.get(r.reserveId);
    return { ...r, tokenSymbol: entry?.tokenSymbol ?? '?', chainName: entry?.chainName ?? '', chainId: entry?.chainId ?? -1, marketName: entry?.marketName ?? '' };
  });

  const supplyRows = rows.filter((r) => r.side === 'supply');
  const borrowRows = rows.filter((r) => r.side === 'borrow');

  const hasForecastUnavailable = rows.some((r) => (r.forecastUnavailableCampaignCount ?? 0) > 0);

  return (
    <div className="rounded-lg border border-border/50 overflow-x-auto">
      <table className="w-full ds-text-11 [&_tbody_td]:transition-colors" style={{ tableLayout: 'fixed' }}>
        <PortfolioColgroup />
        <thead>
          <tr className="text-muted-foreground border-b border-border/50">
            <th className={cn('pl-2.5 pr-1 py-1 text-left font-semibold', HEADER_BASE)}>Token</th>
            <th className={cn('pl-0 pr-2 py-1 text-left font-semibold', HEADER_BASE)}>Amount</th>
            <th className={cn(VALUE_CELL, NATIVE_HEADER_BAND, 'font-semibold')}>Native</th>
            <th className={cn(DELTA_CELL, NATIVE_HEADER_BAND, 'font-normal text-muted-foreground/70')}>
              <abbr title="Delta" aria-label="Delta" className="no-underline">Δ</abbr>
            </th>
            <th className={cn(VALUE_CELL, INCENTIVE_HEADER_BAND, 'font-semibold')}>Incentive</th>
            <th className={cn(DELTA_CELL, INCENTIVE_HEADER_BAND, 'font-normal text-muted-foreground/70')}>
              <abbr title="Delta" aria-label="Delta" className="no-underline">Δ</abbr>
            </th>
            <th className={cn(VALUE_CELL, TOTAL_HEADER_BAND, 'font-semibold')}>Total</th>
            <th className={cn(DELTA_CELL, TOTAL_HEADER_BAND, 'font-normal text-muted-foreground/70')}>
              <abbr title="Delta" aria-label="Delta" className="no-underline">Δ</abbr>
            </th>
            <th className={cn(VALUE_CELL, HEADER_BASE, 'font-semibold')}>USD/day</th>
          </tr>
        </thead>
        <tbody>
          {supplyRows.length > 0 && (
            <>
              <SectionHeader label="Supply" tone="supply" />
              {supplyRows.map((r, i) => (
                <ResultRow key={`${r.reserveId}-supply-${i}`} row={r} />
              ))}
            </>
          )}
          {borrowRows.length > 0 && (
            <>
              <SectionHeader label="Borrow" tone="borrow" />
              {borrowRows.map((r, i) => (
                <ResultRow key={`${r.reserveId}-borrow-${i}`} row={r} />
              ))}
            </>
          )}
        </tbody>
      </table>
      {hasForecastUnavailable && (
        <p className="ds-text-10 text-muted-foreground px-2.5 py-1.5 border-t border-border/30">
          * No forecast data — using current APR.
        </p>
      )}
    </div>
  );
});

function SectionHeader({ label, tone }: { label: string; tone: 'supply' | 'borrow' }) {
  const bg = tone === 'supply' ? 'bg-emerald-500/12 dark:bg-emerald-500/15' : 'bg-cyan-500/12 dark:bg-cyan-500/15';
  const text = tone === 'supply' ? 'ds-text-emerald-600' : 'ds-text-brand-cyan';
  return (
    <tr>
      <td
        colSpan={COL_COUNT}
        className={cn(
          'px-2.5 py-1 ds-text-10 font-semibold uppercase tracking-wide border-t border-border/40',
          bg,
          text,
        )}
      >
        {label}
      </td>
    </tr>
  );
}

interface ResultRowData extends PortfolioPositionResult {
  tokenSymbol: string;
  chainName: string;
  chainId: number;
  marketName: string;
}

const SUPPLY_ACCENT = 'ds-text-emerald-600';
const BORROW_ACCENT = 'ds-text-brand-cyan';
// Band tints applied to the three APY clusters so header ↔ body reads as one column group.
// Strengthened to match header tint intensity for stronger visual grouping.
const SUPPLY_BAND = 'bg-emerald-500/10 dark:bg-emerald-500/12 group-hover:bg-emerald-500/16';
const BORROW_BAND = 'bg-cyan-500/10 dark:bg-cyan-500/12 group-hover:bg-cyan-500/16';

const ResultRow = memo(function ResultRow({
  row,
}: {
  row: ResultRowData;
}) {
  const accentClass = row.side === 'supply' ? SUPPLY_ACCENT : BORROW_ACCENT;
  const bandClass = row.side === 'supply' ? SUPPLY_BAND : BORROW_BAND;
  const nativeDelta = formatDeltaPercent(row.nativeMetric?.delta ?? null);
  const incentiveDelta = formatDeltaPercent(row.incentiveMetric?.delta ?? null);
  const totalDelta = formatDeltaPercent(row.totalMetric?.delta ?? null);

  return (
    <tr className="group border-t border-border/30 hover:bg-muted/10">
      <td className={cn('pl-2.5 pr-1 py-1', bandClass)}>
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <TokenIcon symbol={row.tokenSymbol} size={16} />
            {row.chainId > 0 && getChainIconSrc(row.chainId) && (
              <img
                src={getChainIconSrc(row.chainId)}
                alt=""
                className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full"
              />
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <span className={cn('font-semibold truncate', accentClass)}>{row.tokenSymbol}</span>
            <span className="ds-text-10 text-muted-foreground truncate">{row.chainName}</span>
          </div>
        </div>
      </td>
      <td className={cn('pl-0 pr-2 py-1 text-left tabular-nums font-medium', bandClass, accentClass)}>
        {formatUsdCompact(row.amountUsd)}
      </td>
      <td className={cn(VALUE_CELL, bandClass, accentClass)}>
        {formatPercent(row.nativePercent)}
      </td>
      <DeltaCell value={nativeDelta} accentClass={accentClass} bandClass={bandClass} />
      <td className={cn(VALUE_CELL, bandClass, accentClass)}>
        {formatPercent(row.incentivePercent)}
        {row.forecastUnavailableCampaignCount != null && row.forecastUnavailableCampaignCount > 0 && (
          <span className="ds-text-9 text-muted-foreground ml-0.5" title="No forecast data — using current APR">*</span>
        )}
      </td>
      <DeltaCell value={incentiveDelta} accentClass={accentClass} bandClass={bandClass} />
      <td className={cn(VALUE_CELL, 'font-bold', bandClass, accentClass)}>
        {formatPercent(row.totalPercent)}
      </td>
      <DeltaCell value={totalDelta} accentClass={accentClass} bandClass={bandClass} />
      <td className={cn('px-2 py-1 text-right tabular-nums font-semibold whitespace-nowrap', bandClass, accentClass)}>
        {formatUsdDay(row.usdPerDay)}
      </td>
    </tr>
  );
});

export default PortfolioResultsTable;
