/**
 * MobilePortfolioCard — mobile layout for Portfolio simulation mode.
 *
 * Replaces PortfolioUnifiedTable on mobile (<768px). Each reserve entry
 * renders as a card with pill tabs (Supply/Borrow), CompactInput, equal-weight
 * metric bar (Total/Native/Incentive), and an expandable detail section.
 *
 * Props are identical to PortfolioUnifiedTable — PortfolioPanel switches
 * between the two based on `isMobile`.
 *
 * Design decisions (see docs/design/mobile-portfolio-simulation.md):
 * - Equal-weight metric bar (not hero-metric) — matches desktop table philosophy
 * - Inline expand (not bottom sheet) — user needs to see input + results together
 * - Net $/day only in Summary (not per-card) — cross-side aggregate
 * - CSS responsive touch targets via PortfolioTablePrimitives
 */
import { memo, useState } from 'react';
import { Minus, EyeOff, Snowflake, PauseCircle, Ban, ListCollapse } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { formatPercent } from '@/lib/formatters';
import { TokenIcon } from '@/components/primitives/TokenIcon';
import { getChainIconSrc } from '@/lib/chainIcons';
import { getMarketChipLabel, isV4Market, getHubChipClass } from '@/lib/marketLabels';
import { PORTFOLIO_THEME } from './portfolioTheme';
import type {
  PortfolioReserveEntry,
  PortfolioPositionResult,
  PortfolioSummary,
} from '@/types/portfolio';
import type { PortfolioSimulationActions } from '@/hooks/usePortfolioSimulation';
import type { ReserveWithSpread } from '@/types/aave';
import type { PortfolioCapWarning } from '@/lib/portfolioCapWarnings';
import { isSupplyDisabled, isBorrowDisabled } from '@/lib/reserveStatus';
import {
  CompactInput,
  MetricValue,
  WarningMarker,
  formatUsdCompact,
  formatUsdDayOrDash,
} from './PortfolioTablePrimitives';

interface MobilePortfolioCardProps {
  entries: PortfolioReserveEntry[];
  actions: PortfolioSimulationActions;
  reserves: ReserveWithSpread[];
  positionResults?: PortfolioPositionResult[];
  summary?: PortfolioSummary;
  capWarningsMap?: Map<string, { supply?: PortfolioCapWarning[]; borrow?: PortfolioCapWarning[] }>;
}

/* ── Single card ────────────────────────────────────────────────── */

interface MobileCardProps {
  entry: PortfolioReserveEntry;
  actions: PortfolioSimulationActions;
  reserve: ReserveWithSpread | undefined;
  tokenPriceInUsd: number | undefined;
  supplyResult?: PortfolioPositionResult;
  borrowResult?: PortfolioPositionResult;
  supplyWarnings: PortfolioCapWarning[];
  borrowWarnings: PortfolioCapWarning[];
  supplyCapLimitUsd?: number;
  borrowCapLimitUsd?: number;
}

function MobileCard({
  entry,
  actions,
  reserve,
  tokenPriceInUsd,
  supplyResult,
  borrowResult,
  supplyWarnings,
  borrowWarnings,
  supplyCapLimitUsd,
  borrowCapLimitUsd,
}: MobileCardProps) {
  const [activeTab, setActiveTab] = useState<'supply' | 'borrow'>('supply');
  const [isExpanded, setIsExpanded] = useState(false);

  const isHidden = entry.hidden;
  const isRestricted = entry.restrictedStatus != null;
  const chainSrc = getChainIconSrc(entry.chainId);
  const marketLabel = getMarketChipLabel(entry.marketName, entry.chainName);
  const showV4 = isV4Market(entry.marketName);
  const hubChipClass = getHubChipClass(showV4);

  const disabledNotice = reserve ? {
    supply: reserve.isPaused ? 'Paused' : isSupplyDisabled(reserve) ? 'Supply unavailable' : null,
    borrow: reserve.isPaused ? 'Paused' : isBorrowDisabled(reserve) ? 'Borrow unavailable' : null,
  } : { supply: 'Reserve unavailable', borrow: 'Reserve unavailable' };

  const supplyInputWarns = supplyWarnings.filter(w => w.kind === 'protocol_cap');
  const supplyIncentWarns = supplyWarnings.filter(w => w.kind === 'incentive_cap' || w.kind === 'incentive_offset');
  const borrowInputWarns = borrowWarnings.filter(w => w.kind === 'protocol_cap');
  const borrowIncentWarns = borrowWarnings.filter(w => w.kind === 'incentive_cap' || w.kind === 'incentive_offset');

  const hasWallet = entry.supply.walletValue !== null || entry.borrow.walletValue !== null;

  const handleMinusClick = () => {
    if (isHidden) actions.unhideReserve(entry.reserveId);
    else if (hasWallet) actions.hideReserve(entry.reserveId);
    else actions.removeReserve(entry.reserveId);
  };

  const restrictedIcon = (() => {
    switch (entry.restrictedStatus) {
      case 'frozen': return <Snowflake className="size-3 text-sky-500" aria-hidden />;
      case 'paused': return <PauseCircle className="size-3 ds-text-paused" aria-hidden />;
      case 'inactive': return <Ban className="size-3 ds-text-paused" aria-hidden />;
      default: return null;
    }
  })();

  const rowOpacity = isHidden ? 'opacity-40' : entry.isOrphan ? 'opacity-60' : '';

  const activeResult = activeTab === 'supply' ? supplyResult : borrowResult;
  const activeInputWarns = activeTab === 'supply' ? supplyInputWarns : borrowInputWarns;
  const activeIncentWarns = activeTab === 'supply' ? supplyIncentWarns : borrowIncentWarns;
  const activeCapLimit = activeTab === 'supply' ? supplyCapLimitUsd : borrowCapLimitUsd;
  const activeDisabled = activeTab === 'supply' ? !!disabledNotice.supply : !!disabledNotice.borrow;
  const activeDisabledNotice = activeTab === 'supply' ? disabledNotice.supply : disabledNotice.borrow;

  const SUPPLY_COLOR = 'ds-text-emerald-600';
  const BORROW_COLOR = 'ds-text-brand-cyan';
  const activeColor = activeTab === 'supply' ? SUPPLY_COLOR : BORROW_COLOR;

  return (
    <div
      data-reserve-id={entry.reserveId}
      className={cn(
        'rounded-lg border border-border/50 bg-card/50 overflow-hidden',
        rowOpacity,
      )}
    >
      {/* Token header */}
      <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-1.5">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); if (!isRestricted) handleMinusClick(); }}
          className={cn(
            'shrink-0 rounded p-2 -my-1 text-muted-foreground/60 transition-colors flex items-center justify-center',
            !isRestricted && PORTFOLIO_THEME.trashHoverBg,
            !isRestricted && PORTFOLIO_THEME.trashHoverText,
          )}
          aria-label={isRestricted ? `${entry.tokenSymbol} is restricted` : isHidden ? `Restore ${entry.tokenSymbol}` : `Remove ${entry.tokenSymbol}`}
        >
          {isRestricted ? restrictedIcon : isHidden ? <EyeOff className="size-3.5" strokeWidth={2.5} aria-hidden /> : <Minus className="size-3.5" strokeWidth={2.5} aria-hidden />}
        </button>
        <TokenIcon symbol={entry.tokenSymbol} size={16} />
        <div className="flex flex-col min-w-0 leading-tight">
          <span className={cn('ds-text-13 font-semibold truncate', isHidden ? 'text-muted-foreground line-through' : 'text-foreground')}>
            {entry.tokenSymbol}
          </span>
          <span className="ds-text-10 text-muted-foreground inline-flex items-center gap-0.5 min-w-0">
            {chainSrc && <img src={chainSrc} alt={entry.chainName} className="size-2.5 shrink-0 opacity-70" />}
            <span className="truncate">{marketLabel}</span>
            {entry.hubName && (
              <span className={cn('shrink-0 max-w-full', hubChipClass)} title={`Hub: ${entry.hubName}`}>
                <span className="truncate">{entry.hubName}</span>
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Pill tabs */}
      <div className="mx-3 mb-1.5 flex gap-[var(--ds-space-1)] rounded-lg bg-muted/40 p-0.5">
        <button
          type="button"
          onClick={() => setActiveTab('supply')}
          className={cn(
            'flex-1 ds-text-12 font-medium py-2 rounded-md transition-all duration-200',
            activeTab === 'supply'
              ? 'ds-bg-emerald-500-10 ds-text-emerald-500 shadow-sm ring-1 ds-ring-emerald-500-15'
              : 'text-muted-foreground active:text-foreground/70',
          )}
        >
          Supply
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('borrow')}
          className={cn(
            'flex-1 ds-text-12 font-medium py-2 rounded-md transition-all duration-200',
            activeTab === 'borrow'
              ? 'ds-bg-brand-cyan-10 ds-text-brand-cyan shadow-sm ring-1 ds-ring-brand-cyan-15'
              : 'text-muted-foreground active:text-foreground/70',
          )}
        >
          Borrow
        </button>
      </div>

      {/* CompactInput */}
      <div className="px-3 pb-1.5">
        <div className="flex items-center gap-1">
          <div className="flex-1 min-w-0">
            <CompactInput
              sideData={activeTab === 'supply' ? entry.supply : entry.borrow}
              side={activeTab}
              tokenSymbol={entry.tokenSymbol}
              tokenPriceInUsd={tokenPriceInUsd}
              reserveId={entry.reserveId}
              actions={actions}
              disabled={activeDisabled}
              disabledNotice={activeDisabledNotice}
              capLimitUsd={activeCapLimit}
            />
          </div>
          {activeInputWarns.length > 0 && <WarningMarker warnings={activeInputWarns} />}
        </div>
      </div>

      {/* Equal-weight metric bar */}
      <div className="px-3 pb-1.5">
        <div className="flex items-baseline gap-3 ds-text-13 tabular-nums">
          <span className={cn('font-semibold', activeColor)}>
            {activeResult ? <MetricValue afterValue={activeResult.totalPercent} metric={activeResult.totalMetric} formatFn={formatPercent} /> : '—'}
          </span>
          <span className="text-muted-foreground">
            {activeResult ? <MetricValue afterValue={activeResult.nativePercent} metric={activeResult.nativeMetric} formatFn={formatPercent} /> : '—'}
          </span>
          <span className="inline-flex items-center gap-0.5 text-muted-foreground">
            {activeResult ? (
              <>
                <MetricValue afterValue={activeResult.incentivePercent} metric={activeResult.incentiveMetric} formatFn={formatPercent} />
                {activeResult.forecastUnavailableCampaignCount != null && activeResult.forecastUnavailableCampaignCount > 0 && (
                  <span className="ds-text-9 text-muted-foreground" title="No forecast">*</span>
                )}
              </>
            ) : '—'}
            {activeIncentWarns.length > 0 && <WarningMarker warnings={activeIncentWarns} />}
          </span>
        </div>
        <div className="flex items-baseline gap-3 ds-text-10 text-muted-foreground/70">
          <span>Total</span>
          <span>Native</span>
          <span>Incentive</span>
        </div>
      </div>

      {/* Details expand button */}
      <div className="px-3 pb-2">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? 'Hide details' : 'Show details'}
          className={cn(
            'flex w-full items-center justify-between rounded-lg px-2 py-2 ds-text-12 text-muted-foreground transition-all duration-200 active:scale-[0.995]',
            isExpanded
              ? 'border border-foreground/25 bg-muted/60 shadow-sm dark:border-foreground/20 dark:bg-muted/40'
              : 'border border-border/60 bg-background active:bg-muted/40 active:border-border/80 dark:bg-card/50 dark:active:bg-muted/30',
          )}
        >
          <span className="flex items-center gap-1">
            <span className="ds-text-10 text-muted-foreground/70">$/day</span>
            <span className={cn('ds-text-10 font-medium tabular-nums', activeColor)}>
              {activeResult ? formatUsdDayOrDash(activeResult.usdPerDay) : '—'}
            </span>
          </span>
          <ListCollapse className={cn('h-3.5 w-3.5 shrink-0 transition-transform duration-300 ease-in-out', isExpanded && 'rotate-180')} />
        </button>
      </div>

      {/* Detail expand section */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden border-t border-border/40"
          >
            <div className="px-3 py-2 pl-6 space-y-1">
              {/* Native */}
              <div className="flex items-center justify-between ds-text-12">
                <span className="text-muted-foreground">Native</span>
                <span className={cn('tabular-nums', activeColor)}>
                  {activeResult ? <MetricValue afterValue={activeResult.nativePercent} metric={activeResult.nativeMetric} formatFn={formatPercent} /> : '—'}
                </span>
              </div>
              {/* Incentive */}
              <div className="flex items-center justify-between ds-text-12">
                <span className="text-muted-foreground">Incentive</span>
                <span className="inline-flex items-center gap-0.5">
                  <span className={cn('tabular-nums', activeColor)}>
                    {activeResult ? <MetricValue afterValue={activeResult.incentivePercent} metric={activeResult.incentiveMetric} formatFn={formatPercent} /> : '—'}
                  </span>
                  {activeIncentWarns.length > 0 && <WarningMarker warnings={activeIncentWarns} />}
                </span>
              </div>
              {/* Total */}
              <div className="flex items-center justify-between ds-text-12">
                <span className="text-muted-foreground font-medium">Total</span>
                <span className={cn('tabular-nums font-semibold', activeColor)}>
                  {activeResult ? <MetricValue afterValue={activeResult.totalPercent} metric={activeResult.totalMetric} formatFn={formatPercent} /> : '—'}
                </span>
              </div>
              {/* $/day */}
              <div className="flex items-center justify-between ds-text-12">
                <span className="text-muted-foreground">$/day</span>
                <span className={cn('tabular-nums', activeColor)}>
                  {activeResult ? formatUsdDayOrDash(activeResult.usdPerDay) : '—'}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────── */

const MobilePortfolioCard = memo(function MobilePortfolioCard({
  entries,
  actions,
  reserves,
  positionResults,
  summary,
  capWarningsMap,
}: MobilePortfolioCardProps) {
  if (entries.length === 0) return null;

  const reserveIdToReserve = new Map(reserves.map(r => [r.reserveId, r]));

  const resultMap = new Map<string, { supply?: PortfolioPositionResult; borrow?: PortfolioPositionResult }>();
  if (positionResults) {
    for (const r of positionResults) {
      const existing = resultMap.get(r.reserveId) ?? {};
      if (r.side === 'supply') existing.supply = r;
      else existing.borrow = r;
      resultMap.set(r.reserveId, existing);
    }
  }

  const SUPPLY_COLOR = 'ds-text-emerald-600';
  const BORROW_COLOR = 'ds-text-brand-cyan';

  return (
    <div className="space-y-2">
      {entries.map((entry) => {
        const reserve = reserveIdToReserve.get(entry.reserveId);
        const tokenPriceInUsd = reserve?.tokenPrice;
        const results = resultMap.get(entry.reserveId);

        const supplyWarnings = capWarningsMap?.get(entry.reserveId)?.supply ?? [];
        const borrowWarnings = capWarningsMap?.get(entry.reserveId)?.borrow ?? [];
        const supplyCapLimitUsd = capWarningsMap?.get(entry.reserveId)?.supply?.find(w => w.kind === 'protocol_cap')?.adjustToUsd;
        const borrowCapLimitUsd = capWarningsMap?.get(entry.reserveId)?.borrow?.find(w => w.kind === 'protocol_cap')?.adjustToUsd;

        return (
          <MobileCard
            key={entry.reserveId}
            entry={entry}
            actions={actions}
            reserve={reserve}
            tokenPriceInUsd={tokenPriceInUsd}
            supplyResult={results?.supply}
            borrowResult={results?.borrow}
            supplyWarnings={supplyWarnings}
            borrowWarnings={borrowWarnings}
            supplyCapLimitUsd={supplyCapLimitUsd}
            borrowCapLimitUsd={borrowCapLimitUsd}
          />
        );
      })}

      {/* Summary div — mirrors desktop tfoot */}
      {summary && (
        <div className="border-t-2 border-border/60 bg-muted/30 rounded-b-lg px-3 py-2.5 space-y-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className={cn('ds-text-10 font-medium', SUPPLY_COLOR)}>Supply</div>
              <div className={cn('ds-text-13 font-bold tabular-nums', SUPPLY_COLOR)}>
                {formatUsdCompact(summary.totalSupplyUsd)}
              </div>
              <div className={cn('ds-text-10 tabular-nums', SUPPLY_COLOR)} title="Weighted average">
                {formatPercent(summary.supplyWeightedApy)}
              </div>
            </div>
            <div>
              <div className={cn('ds-text-10 font-medium', BORROW_COLOR)}>Borrow</div>
              <div className={cn('ds-text-13 font-bold tabular-nums', BORROW_COLOR)}>
                {formatUsdCompact(summary.totalBorrowUsd)}
              </div>
              <div className={cn('ds-text-10 tabular-nums', BORROW_COLOR)} title="Weighted average">
                {formatPercent(summary.borrowWeightedApy)}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-border/30 pt-2">
            <span className="ds-text-11 font-semibold text-foreground">Net $/day</span>
            <span className="ds-text-12 font-bold tabular-nums text-foreground">
              {formatUsdDayOrDash(summary.netUsdPerDay)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
});

export default MobilePortfolioCard;
