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
import { Minus, EyeOff, Snowflake, PauseCircle, Ban, ChevronDown } from 'lucide-react';
import { AnimatePresence, motion, MotionConfig } from 'framer-motion';
import { cn } from '@/lib/utils';
import { formatPercent, formatUsd , formatReserveSizeUsd, formatSignedReserveSizeUsd, formatSpread } from '@/lib/formatters';
import { TokenIcon } from '@/components/primitives/TokenIcon';
import { getChainIconSrc } from '@/lib/chainIcons';
import { getMarketChipLabel } from '@/lib/marketLabels';
import type {
  PortfolioReserveEntry,
  PortfolioPositionResult,
  PortfolioSummary,
} from '@/types/portfolio';
import type { PortfolioSimulationActions } from '@/hooks/usePortfolioSimulation';
import type { ReserveWithSpread } from '@/types/aave';
import { isSupplyDisabled, isBorrowDisabled } from '@/lib/reserveStatus';
import {
  CompactInput,
  MetricValue,
  WarningMarker,
  type MetricShape,
} from './PortfolioTablePrimitives';
import {
  formatProtocolCapText,
  type PortfolioCapWarning,
  type IncentiveCapWarning,
  type IncentiveOffsetWarning,
} from '@/lib/portfolioCapWarnings';

/* ── Delta helpers ──────────────────────────────────────────────── */

/** Check if a metric has a meaningful current→after change (≥0.005 pp). */
function hasMetricDelta(metric?: MetricShape): boolean {
  return metric?.current != null && metric.after != null
    && Math.abs(metric.current - metric.after) >= 0.005;
}

/**
 * DeltaRow — shows current → after + delta for a single metric.
 * Only renders when there's a meaningful change (hasMetricDelta).
 * This is the explicit version of what MetricValue hides in a tooltip.
 */
function DeltaRow({
  label,
  metric,
  formatFn,
  isCurrency = false,
}: {
  label: string;
  metric?: MetricShape;
  formatFn: (v: number) => string;
  isCurrency?: boolean;
}) {
  if (!hasMetricDelta(metric)) return null;

  const delta = metric!.delta ?? (metric!.after! - metric!.current!);
  const deltaStr = isCurrency
    ? formatSignedReserveSizeUsd(delta)
    : formatSpread(delta);
  const deltaColor = delta >= 0
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-red-500 dark:text-red-400';

  return (
    <div className="flex items-center justify-between ds-text-11 py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1 tabular-nums">
        <span data-testid="delta-current" className="text-muted-foreground/70">{formatFn(metric!.current!)}</span>
        <span className="text-muted-foreground/40">→</span>
        <span data-testid="delta-after" className="font-medium text-foreground">{formatFn(metric!.after!)}</span>
        <span data-testid="delta-value" className={cn('font-medium', deltaColor)}>{deltaStr}</span>
      </span>
    </div>
  );
}

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
  const supplyHasContent = entry.supply.walletValue !== null || entry.supply.amount !== '';
  const borrowHasContent = entry.borrow.walletValue !== null || entry.borrow.amount !== '';
  const [activeTab, setActiveTab] = useState<'supply' | 'borrow'>(
    !supplyHasContent && borrowHasContent ? 'borrow' : 'supply',
  );
  const [isExpanded, setIsExpanded] = useState(false);

  const isHidden = entry.hidden;
  const isRestricted = entry.restrictedStatus != null;
  const chainSrc = getChainIconSrc(entry.chainId);
  const marketLabel = getMarketChipLabel(entry.marketName, entry.chainName);

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

  const SUPPLY_COLOR = 'ds-text-emerald-600';
  const BORROW_COLOR = 'ds-text-brand-cyan';

  // Mobile-safe hover tokens: active: for touch, md:hover: for desktop guard.
  // PORTFOLIO_THEME.trashHover* uses bare hover: which is unreachable on mobile.
  const trashHoverBgMobile = 'active:ds-bg-blue-500-10 md:hover:ds-bg-blue-500-10';
  const trashHoverTextMobile = 'active:ds-text-blue-500 md:hover:ds-text-blue-500';

  const activeResult = activeTab === 'supply' ? supplyResult : borrowResult;
  const activeInputWarns = activeTab === 'supply' ? supplyInputWarns : borrowInputWarns;
  const activeIncentWarns = activeTab === 'supply' ? supplyIncentWarns : borrowIncentWarns;
  const activeCapLimit = activeTab === 'supply' ? supplyCapLimitUsd : borrowCapLimitUsd;
  const activeDisabled = activeTab === 'supply' ? !!disabledNotice.supply : !!disabledNotice.borrow;
  const activeDisabledNotice = activeTab === 'supply' ? disabledNotice.supply : disabledNotice.borrow;
  const activeColor = activeTab === 'supply' ? SUPPLY_COLOR : BORROW_COLOR;
  // Secondary tier: semantic color at 70% opacity for Native/Incentive (DESIGN-SYSTEM-REFERENCE §3).
  // Creates hierarchy: Total (full) > Native/Incentive (70%) without neutral gray.
  const activeColorSecondary = activeTab === 'supply' ? 'ds-text-emerald-600-70' : 'ds-text-brand-cyan-70';

  // Expand content flags — only show sections with meaningful data
  const hasDelta = !!activeResult && [
    activeResult.totalMetric, activeResult.nativeMetric,
    activeResult.incentiveMetric, activeResult.usdPerDayMetric,
  ].some(hasMetricDelta);
  const hasCapDetails = activeInputWarns.length > 0 || activeIncentWarns.length > 0;
  const hasWalletDiff = !!activeResult?.walletUsd && activeResult.amountUsd !== activeResult.walletUsd;
  const hasExpandContent = hasDelta || hasCapDetails || hasWalletDiff;

  const incentiveHasValue = activeResult != null && activeResult.incentivePercent != null && activeResult.incentivePercent !== 0;

  return (
    <div
      data-reserve-id={entry.reserveId}
      className={cn(
        'group/card relative rounded-2xl border border-border/60 bg-gradient-to-b from-card to-card/60 overflow-hidden ring-1 ring-border/20 transition-colors',
        rowOpacity,
      )}
    >
      {/* Token header — compact single row */}
      <div className="flex items-center gap-2 px-2.5 pt-1.5 pb-1">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); if (!isRestricted) handleMinusClick(); }}
          className={cn(
            'shrink-0 -ml-1 rounded-md p-1.5 text-muted-foreground/60 transition-colors flex items-center justify-center min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 -my-2.5 md:my-0',
            !isRestricted && trashHoverBgMobile,
            !isRestricted && trashHoverTextMobile,
          )}
          aria-label={isRestricted ? `${entry.tokenSymbol} is restricted` : isHidden ? `Restore ${entry.tokenSymbol}` : `Remove ${entry.tokenSymbol}`}
        >
          {isRestricted ? restrictedIcon : isHidden ? <EyeOff className="size-3.5" strokeWidth={2.5} aria-hidden /> : <Minus className="size-3.5" strokeWidth={2.5} aria-hidden />}
        </button>
        <TokenIcon symbol={entry.tokenSymbol} size={22} />
        <span className={cn('ds-text-15 font-semibold tracking-tight break-words min-w-0', isHidden ? 'text-muted-foreground line-through' : 'text-foreground')}>
          {entry.tokenSymbol}
        </span>
        <span className="ds-text-10 text-muted-foreground/80 inline-flex items-center gap-1 min-w-0 ml-auto rounded-full border border-border/50 bg-muted/40 px-2 py-0.5">
          {chainSrc && <img src={chainSrc} alt={entry.chainName} className="size-3 shrink-0 opacity-90" />}
          <span className="truncate font-medium">{marketLabel}</span>
        </span>
      </div>

      {/* Pill tabs — segmented control */}
      <div role="tablist" aria-label="Supply or Borrow" className="mx-2.5 mb-1.5 flex gap-1 rounded-lg bg-muted/60 p-0.5 ring-1 ring-border/30">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'supply'}
          onClick={() => setActiveTab('supply')}
          className={cn(
            'flex-1 ds-text-12 font-semibold py-1 rounded-md transition-all duration-200 min-h-[44px] flex items-center justify-center',
            activeTab === 'supply'
              ? 'bg-card ds-text-emerald-600 ring-1 ds-ring-emerald-500-15 shadow-sm'
              : 'text-muted-foreground active:text-foreground/70',
          )}
        >
          Supply
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'borrow'}
          onClick={() => setActiveTab('borrow')}
          className={cn(
            'flex-1 ds-text-12 font-semibold py-1 rounded-md transition-all duration-200 min-h-[44px] flex items-center justify-center',
            activeTab === 'borrow'
              ? 'bg-card ds-text-brand-cyan ring-1 ds-ring-brand-cyan-15 shadow-sm'
              : 'text-muted-foreground active:text-foreground/70',
          )}
        >
          Borrow
        </button>
      </div>

      {/* Content area — role=tabpanel for tablist semantics */}
      <div role="tabpanel" aria-label="Portfolio simulation" className="contents">
      {/* CompactInput */}
      <div className="px-2.5 pb-1.5">
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

      {/* Metrics strip — 3-col grid; Total gets accent surface */}
      <div className="mx-2.5 mb-1.5 grid grid-cols-3 rounded-xl overflow-hidden ring-1 ring-border/50 bg-muted/20">
        <div className={cn(
          'px-2 py-1.5 flex flex-col items-start border-r border-border/30',
          activeTab === 'supply' ? 'ds-bg-emerald-500-10' : 'ds-bg-brand-cyan-10',
        )}>
          <span className="ds-text-9 uppercase tracking-[0.08em] text-muted-foreground/80 font-semibold">Total</span>
          <span data-cell={`${activeTab}-total`} className={cn('ds-text-16 font-bold tabular-nums leading-none mt-1', activeColor)}>
            {activeResult ? <MetricValue afterValue={activeResult.totalPercent} metric={activeResult.totalMetric} formatFn={formatPercent} skipTooltip /> : <span className="text-muted-foreground/40">–</span>}
          </span>
        </div>
        <div className="px-2 py-1.5 flex flex-col items-start border-r border-border/30">
          <span className="ds-text-9 uppercase tracking-[0.08em] text-muted-foreground/70 font-semibold">Native</span>
          <span data-cell={`${activeTab}-native`} className={cn('ds-text-13 font-medium tabular-nums leading-none mt-1', activeColorSecondary)}>
            {activeResult ? <MetricValue afterValue={activeResult.nativePercent} metric={activeResult.nativeMetric} formatFn={formatPercent} skipTooltip /> : <span className="text-muted-foreground/40">–</span>}
          </span>
        </div>
        <div className="px-2 py-1.5 flex flex-col items-start">
          <span className="ds-text-9 uppercase tracking-[0.08em] text-muted-foreground/70 font-semibold">Incentive</span>
          <span
            data-cell={`${activeTab}-incentive`}
            className={cn(
              'ds-text-13 font-semibold tabular-nums leading-none mt-1 inline-flex items-center gap-0.5',
              incentiveHasValue
                ? activeColorSecondary
                : 'text-foreground/50',
            )}
          >
            {activeResult ? (
              <>
                <MetricValue afterValue={activeResult.incentivePercent} metric={activeResult.incentiveMetric} formatFn={formatPercent} skipTooltip />
                {activeResult.forecastUnavailableCampaignCount != null && activeResult.forecastUnavailableCampaignCount > 0 && (
                  <span className="ds-text-9 text-muted-foreground" title="No forecast">*</span>
                )}
              </>
            ) : <span className="text-muted-foreground/40">–</span>}
            {activeIncentWarns.length > 0 && <WarningMarker warnings={activeIncentWarns} />}
          </span>
        </div>
      </div>

      {/* Daily earnings row — doubles as expand toggle */}
      <div className="px-2.5 pb-2.5">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? 'Hide details' : 'Show details'}
          className={cn(
            'flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 transition-all min-h-[44px] border',
            isExpanded
              ? 'bg-muted/60 border-border/50'
              : 'bg-muted/25 border-border/30 active:bg-muted/50',
          )}
        >
          <span className="ds-text-11 text-muted-foreground font-medium uppercase tracking-wider">Daily earnings</span>
          <span className="inline-flex items-baseline gap-1">
            <span data-cell={`${activeTab}-usd-per-day`} className={cn('ds-text-14 font-bold tabular-nums', activeColor)}>
              {activeResult ? (activeResult.usdPerDay === 0 ? '$0.00' : formatSignedReserveSizeUsd(activeResult.usdPerDay)) : '–'}
            </span>
            <span className="ds-text-10 text-muted-foreground/60">/day</span>
            <ChevronDown className={cn('h-3 w-3 ml-1.5 shrink-0 self-center text-muted-foreground/70 transition-transform duration-300 ease-out', isExpanded && 'rotate-180')} />
          </span>
        </button>
      </div>


      {/* Detail expand section — simulation delta, cap details, wallet vs effective */}
      <MotionConfig reducedMotion="user">
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden border-t border-border/40"
          >
            <div className="px-3 py-2 space-y-2">
              {activeResult && hasExpandContent ? (<>
                {/* Rate Impact — explicit current→after+delta (replaces hidden tooltip) */}
                {hasDelta && (
                  <div className="space-y-0.5">
                    <div className={cn('ds-text-10 font-medium mb-0.5', activeColor)}>Rate Impact</div>
                    <DeltaRow label="Total" metric={activeResult.totalMetric} formatFn={formatPercent} />
                    <DeltaRow label="Native" metric={activeResult.nativeMetric} formatFn={formatPercent} />
                    <DeltaRow label="Incentive" metric={activeResult.incentiveMetric} formatFn={formatPercent} />
                    <DeltaRow label="$/day" metric={activeResult.usdPerDayMetric} formatFn={(v) => v === 0 ? '—' : formatSignedReserveSizeUsd(v)} isCurrency />
                  </div>
                )}

                {/* Cap Details — full text (replaces dot-only indicator) */}
                {hasCapDetails && (
                  <div className="space-y-1 border-t border-border/30 pt-2">
                    <div className="ds-text-10 font-medium text-amber-500">Cap Details</div>
                    {activeInputWarns.map((w, i) => {
                      if (w.kind === 'protocol_cap') {
                        return (
                          <div key={`pc-${i}`} className="ds-text-11 text-amber-600 dark:text-amber-400">
                            {formatProtocolCapText({
                              side: w.side,
                              availableFormatted: formatUsd(w.adjustToUsd),
                              limitedByLiquidity: w.limitedByLiquidity,
                            })}
                          </div>
                        );
                      }
                      return null;
                    })}
                    {activeIncentWarns.flatMap((w, i) => {
                      const notes = w.kind === 'incentive_cap'
                        ? (w as IncentiveCapWarning).notes
                        : (w as IncentiveOffsetWarning).notes;
                      const source = w.kind === 'incentive_cap'
                        ? (w as IncentiveCapWarning).source
                        : (w as IncentiveOffsetWarning).source;
                      return [
                        <div key={`ic-src-${i}`} className="ds-text-10 font-medium capitalize text-muted-foreground">
                          {source}
                        </div>,
                        ...(notes?.map((note, ni) => (
                          <div key={`ic-${i}-${ni}`} className={cn(
                            'ds-text-11',
                            note.color === 'amber' ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground',
                          )}>
                            {note.text}
                          </div>
                        )) ?? []),
                      ];
                    })}
                  </div>
                )}

                {/* Wallet vs Effective — when position differs from on-chain wallet */}
                {hasWalletDiff && (
                  <div className="space-y-1 border-t border-border/30 pt-2">
                    <div className="flex justify-between ds-text-11">
                      <span className="text-muted-foreground">Wallet</span>
                      <span className="tabular-nums text-muted-foreground">{formatReserveSizeUsd(activeResult.walletUsd!)}</span>
                    </div>
                    <div className="flex justify-between ds-text-11">
                      <span className="text-muted-foreground">Effective</span>
                      <span className={cn('tabular-nums font-medium', activeColor)}>
                        {formatReserveSizeUsd(activeResult.amountUsd)}
                      </span>
                    </div>
                  </div>
                )}
              </>) : (
                /* Fallback: no meaningful changes to show */
                <div className="ds-text-11 text-muted-foreground/60 text-center py-1">
                  {activeResult ? 'No simulation changes' : 'No simulation data'}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </MotionConfig>
      </div>
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

      {/* Summary card — mirrors desktop tfoot with brand polish */}
      {summary && (
        <div className="mt-1 rounded-2xl border border-border/60 bg-gradient-to-b from-muted/40 to-muted/10 ring-1 ring-border/20 px-2.5 py-2 space-y-1.5">
          {/* Supply/Borrow blocks are capped so they don't feel over-wide on small screens.
              Numeric values are right-aligned so the two columns stay visually aligned. */}
          <div className="flex justify-center gap-2">
            <div className="flex-1 min-w-[8.5rem] max-w-[10rem] rounded-lg ds-bg-emerald-500-10 px-2 py-1.5 ring-1 ds-ring-emerald-500-15">
              <div className="flex items-baseline justify-between gap-1">
                <span className={cn('ds-text-9 font-semibold uppercase tracking-[0.06em]', SUPPLY_COLOR)}>Supply</span>
                <span className={cn('ds-text-10 tabular-nums font-medium opacity-90 text-right', SUPPLY_COLOR)} title="Weighted average">
                  {formatPercent(summary.supplyWeightedApy)}
                </span>
              </div>
              <div className={cn('ds-text-13 font-bold tabular-nums leading-tight mt-0.5 text-right', SUPPLY_COLOR)}>
                {formatReserveSizeUsd(summary.totalSupplyUsd)}
              </div>
              <div className={cn('ds-text-10 tabular-nums opacity-75 leading-tight text-right', SUPPLY_COLOR)} title="Earn per day">
                {summary.supplyUsdPerDay === 0 ? '—' : `${formatSignedReserveSizeUsd(summary.supplyUsdPerDay)}/d`}
              </div>
            </div>
            <div className="flex-1 min-w-[8.5rem] max-w-[10rem] rounded-lg ds-bg-brand-cyan-10 px-2 py-1.5 ring-1 ds-ring-brand-cyan-15">
              <div className="flex items-baseline justify-between gap-1">
                <span className={cn('ds-text-9 font-semibold uppercase tracking-[0.06em]', BORROW_COLOR)}>Borrow</span>
                <span className={cn('ds-text-10 tabular-nums font-medium opacity-90 text-right', BORROW_COLOR)} title="Weighted average">
                  {formatPercent(summary.borrowWeightedApy)}
                </span>
              </div>
              <div className={cn('ds-text-13 font-bold tabular-nums leading-tight mt-0.5 text-right', BORROW_COLOR)}>
                {formatReserveSizeUsd(summary.totalBorrowUsd)}
              </div>
              <div className={cn('ds-text-10 tabular-nums opacity-75 leading-tight text-right', BORROW_COLOR)} title="Cost per day">
                {summary.borrowUsdPerDay === 0 ? '—' : `${formatSignedReserveSizeUsd(summary.borrowUsdPerDay)}/d`}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-card/70 border border-border/50 px-2.5 py-1.5">
            <span className="ds-text-10 font-semibold uppercase tracking-wider text-muted-foreground">Net / day</span>
            <span className={cn(
              'ds-text-13 font-bold tabular-nums',
              summary.netUsdPerDay > 0 ? 'text-emerald-600 dark:text-emerald-400'
                : summary.netUsdPerDay < 0 ? 'text-red-500 dark:text-red-400'
                : 'text-foreground',
            )}>
              {summary.netUsdPerDay === 0 ? '—' : formatSignedReserveSizeUsd(summary.netUsdPerDay)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
});

export default MobilePortfolioCard;
