import { memo, useEffect, useState } from 'react';
import { ExternalLink, ListCollapse, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { ReserveWithSpread, ETHEREUM_MARKET_NAMES } from '@/types/aave';
import { formatPercent, formatSpread } from '@/lib/formatters';
import { getChainIconSrc } from '@/lib/chainIcons';
import { buildAaveReserveUrl } from '@/lib/aaveLinks';
import { externalLinkTabProps } from '@/lib/externalNavigation';
import { TokenIcon } from '@/components/primitives/TokenIcon';
import { fetchIconSymbolAndName } from '@/ui-config/reservePatches';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import SimulationSubRow from './SimulationSubRow';
import UtilizationIndicator from './UtilizationIndicator';
import CapProgressRing from './CapProgressRing';
import BorrowCapProgressRing from './BorrowCapProgressRing';
import { formatScenarioSize } from '@/lib/formatters';
import type { RateSimulationResult } from '@/hooks/useRateSimulation';
import { getAvailableToBorrowUsd, getPoolLiquidityUsd, getScenarioSupplySizeUsd, getTotalBorrowedUsd, getValidTokenPrice } from '@/lib/scenarioSize';

/** Same content as CapProgressRing tooltip; used in mobile bottom sheet. */
function SupplyCapSheetContent({
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
function BorrowCapSheetContent({
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
function UtilizationSheetContent({ current, optimal }: { current: number; optimal: number }) {
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

interface MobileReserveCardProps {
  reserve: ReserveWithSpread;
  isApy: boolean;
  onIncentiveClick: (
    e: React.MouseEvent,
    reserve: ReserveWithSpread,
    type: 'supply' | 'borrow',
    apy: number | null
  ) => void;
  isSimulationExpanded: boolean;
  onToggleSimulation: () => void;
  simulation: RateSimulationResult;
  supplyInput: string;
  borrowInput: string;
  hasSharedScenario: boolean;
  inputMode?: 'usd' | 'token';
  onCorrectSupplyInput?: (correctedValue: string) => void;
  onCorrectBorrowInput?: (correctedValue: string) => void;
  /** When 'upperOnly' only the card upper part is shown; when 'simulationOnly' only the simulation block. */
  variant?: 'full' | 'upperOnly' | 'simulationOnly';
  /** When true, card gets rounded-b-none + border-b-transparent to connect to panel below. */
  connectedBelow?: boolean;
  /** Override the default active tab from parent (e.g. based on sort column). */
  defaultTab?: 'supply' | 'borrow';
}

const MobileReserveCard = memo(({
  reserve,
  isApy,
  onIncentiveClick,
  isSimulationExpanded,
  onToggleSimulation,
  simulation,
  supplyInput,
  borrowInput,
  hasSharedScenario,
  inputMode = 'usd',
  onCorrectSupplyInput,
  onCorrectBorrowInput,
  variant = 'full',
  connectedBelow = false,
  defaultTab,
}: MobileReserveCardProps) => {
  const [capSheet, setCapSheet] = useState<'supply' | 'borrow' | 'utilization' | null>(null);
  const [hasSimulationMounted, setHasSimulationMounted] = useState(isSimulationExpanded);
  const [activeTab, setActiveTab] = useState<'supply' | 'borrow'>(defaultTab ?? 'supply');

  // Sync with parent's defaultTab (e.g. when sort column changes). When parent clears
  // defaultTab (e.g. leaving borrow sort), reset to supply so cards don't stay on borrow.
  useEffect(() => {
    setActiveTab(defaultTab ?? 'supply');
  }, [defaultTab]);

  useEffect(() => {
    if (isSimulationExpanded) {
      setHasSimulationMounted(true);
    }
  }, [isSimulationExpanded]);

  const getMarketDisplayName = () => {
    if (reserve.chainName === 'Ethereum' && ETHEREUM_MARKET_NAMES[reserve.marketName]) {
      return ETHEREUM_MARKET_NAMES[reserve.marketName];
    }
    return reserve.chainName;
  };

  const displaySupplyTotal = hasSharedScenario
    ? simulation.supply.afterTotal ?? simulation.supply.currentTotal
    : simulation.supply.currentTotal;
  const displayBorrowTotal = hasSharedScenario
    ? simulation.borrow.afterTotal ?? simulation.borrow.currentTotal
    : simulation.borrow.currentTotal;
  const displaySupplyNative = hasSharedScenario
    ? simulation.supply.afterNative ?? simulation.supply.currentNative
    : simulation.supply.currentNative;
  const displayBorrowNative = hasSharedScenario
    ? simulation.borrow.afterNative ?? simulation.borrow.currentNative
    : simulation.borrow.currentNative;
  const displaySupplyIncentive = hasSharedScenario
    ? simulation.supply.afterIncentive ?? simulation.supply.currentIncentive
    : simulation.supply.currentIncentive;
  const displayBorrowIncentive = hasSharedScenario
    ? simulation.borrow.afterIncentive ?? simulation.borrow.currentIncentive
    : simulation.borrow.currentIncentive;
  const displaySpread = hasSharedScenario
    ? simulation.spread.after ?? simulation.spread.current
    : simulation.spread.current;

  const visibleSupplyIncentive =
    displaySupplyIncentive === null || Number.isNaN(displaySupplyIncentive) || displaySupplyIncentive < 0.01
      ? null
      : displaySupplyIncentive;
  const visibleBorrowIncentive =
    displayBorrowIncentive === null || Number.isNaN(displayBorrowIncentive) || displayBorrowIncentive < 0.01
      ? null
      : displayBorrowIncentive;

  const chainIconSrc = getChainIconSrc(reserve.chainName);
  const { iconSymbol, logoURI } = fetchIconSymbolAndName({
    underlyingAsset: reserve.tokenAddress,
    symbol: reserve.tokenSymbol,
    name: reserve.tokenName,
  });

  const displayTokenPrice = getValidTokenPrice(simulation.tokenPrice, reserve.tokenPrice);
  const displayReserveSizeUsd = getScenarioSupplySizeUsd({
    reserveSizeUsd: reserve.reserveSizeUsd,
    supplyCapUsd: reserve.supplyCapUsd,
    rawSupplyInput: hasSharedScenario ? supplyInput : '',
    inputMode,
    tokenPrice: displayTokenPrice,
  });
  const totalBorrowedUsd = getTotalBorrowedUsd({
    reserveSizeUsd: reserve.reserveSizeUsd,
    utilizationPct: reserve.utilizationPct,
  });
  const poolLiquidity = getPoolLiquidityUsd({
    reserveSizeUsd: reserve.reserveSizeUsd,
    totalBorrowedUsd,
  });

  if (variant === 'simulationOnly') {
    return (
      <div>
        <SimulationSubRow
          reserve={reserve}
          simulation={simulation}
          isApy={isApy}
          supplyInput={supplyInput}
          borrowInput={borrowInput}
          inputMode={inputMode}
          compact
          embeddedFromTop
          onCorrectSupplyInput={onCorrectSupplyInput}
          onCorrectBorrowInput={onCorrectBorrowInput}
        />
      </div>
    );
  }

  const showUpperOnly = variant === 'upperOnly';

  /**
   * Single compact row: optional @ price, then amount (+ cap ring) — no "Size" label; ring stays 12px for tap targets.
   */
  const renderAmountRow = () => {
    const tp = reserve.tokenPrice;
    const priceEl =
      tp != null && Number.isFinite(tp) ? (
        <span className="ds-text-10 text-muted-foreground/60 tabular-nums shrink-0 leading-none sm:ds-text-11">
          {`$${tp < 0.01 ? tp.toExponential(1) : tp < 100 ? tp.toFixed(2) : tp.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
        </span>
      ) : null;

    if (activeTab === 'supply') {
      const hasSupplyCap = reserve.supplyCapUsd != null && Number.isFinite(reserve.supplyCapUsd) && reserve.supplyCapUsd > 0;
      return (
        <div className="flex w-full min-w-0 flex-nowrap items-center gap-1.5 px-4">
          {priceEl}
          <div className="ml-auto flex min-w-0 items-center justify-end gap-1">
            {hasSupplyCap ? (
              <button
                type="button"
                className="flex min-w-0 items-center gap-1 rounded-md py-0 pl-1 pr-0 ds-text-emerald-500 transition-all hover:bg-muted/50 active:scale-[0.98] cursor-pointer"
                aria-label="Show supply cap details"
                onClick={() => setCapSheet('supply')}
              >
                <span className="ds-text-13 font-medium tabular-nums leading-none truncate">
                  {formatScenarioSize(displayReserveSizeUsd, { inputMode, tokenPrice: displayTokenPrice, tokenSymbol: reserve.tokenSymbol })}
                </span>
                <CapProgressRing
                  size={displayReserveSizeUsd}
                  cap={reserve.supplyCapUsd!}
                  displayMode={inputMode}
                  tokenPrice={displayTokenPrice}
                  tokenSymbol={reserve.tokenSymbol}
                  ringSize={12}
                  strokeWidth={1.2}
                  disableTooltip
                />
              </button>
            ) : (
              <span className="ds-text-13 font-medium tabular-nums leading-none ds-text-emerald-500 truncate">
                {formatScenarioSize(displayReserveSizeUsd, { inputMode, tokenPrice: displayTokenPrice, tokenSymbol: reserve.tokenSymbol })}
              </span>
            )}
          </div>
        </div>
      );
    }
    const hasBorrowCap = reserve.borrowCapUsd != null && Number.isFinite(reserve.borrowCapUsd) && reserve.borrowCapUsd > 0;
    return (
      <div className="flex w-full min-w-0 flex-nowrap items-center gap-1.5 px-4">
        {priceEl}
        <div className="ml-auto flex min-w-0 items-center justify-end gap-1">
          {hasBorrowCap ? (
            <button
              type="button"
              className="flex min-w-0 items-center gap-1 rounded-md py-0 pl-1 pr-0 ds-text-brand-cyan transition-all hover:bg-muted/50 active:scale-[0.98] cursor-pointer"
              aria-label="Show borrow cap details"
              onClick={() => setCapSheet('borrow')}
            >
              <span className="ds-text-13 font-medium tabular-nums leading-none truncate">
                {formatScenarioSize(totalBorrowedUsd, { inputMode, tokenPrice: displayTokenPrice, tokenSymbol: reserve.tokenSymbol })}
              </span>
              <BorrowCapProgressRing
                borrowed={totalBorrowedUsd}
                cap={reserve.borrowCapUsd!}
                poolLiquidity={poolLiquidity}
                displayMode={inputMode}
                tokenPrice={displayTokenPrice}
                tokenSymbol={reserve.tokenSymbol}
                ringSize={12}
                strokeWidth={1.2}
                disableTooltip
              />
            </button>
          ) : (
            <span className="ds-text-13 font-medium tabular-nums leading-none ds-text-brand-cyan truncate">
              {formatScenarioSize(totalBorrowedUsd, { inputMode, tokenPrice: displayTokenPrice, tokenSymbol: reserve.tokenSymbol })}
            </span>
          )}
        </div>
      </div>
    );
  };

  /** Render the hero APY section — no label, just the number */
  const renderHeroApy = () => {
    if (activeTab === 'supply') {
      const heroValue = displaySupplyTotal;
      const isDisabled = reserve.supplyDisabled;
      const heroColorClass = heroValue === null || isDisabled ? 'text-secondary' : 'ds-text-emerald-500';
      return (
        <div className="flex flex-col items-center gap-0.5">
          {isDisabled ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <p className={`ds-text-24 font-bold tabular-nums ${heroColorClass} cursor-auto`}>
                  {formatPercent(heroValue)}
                </p>
              </TooltipTrigger>
              <TooltipContent>Supply unavailable</TooltipContent>
            </Tooltip>
          ) : (
            <p className={`ds-text-24 font-bold tabular-nums ${heroColorClass}`}>
              {formatPercent(heroValue)}
            </p>
          )}
          {/* APY breakdown: native + incentive */}
          <div className="min-h-[1rem]">
            {visibleSupplyIncentive !== null && (
              <div className="flex items-center gap-[var(--ds-space-1)] ds-text-11">
                <span className={isDisabled ? 'text-secondary' : 'ds-text-emerald-500-70 font-medium'}>
                  {formatPercent(displaySupplyNative)}
                </span>
                <span className="text-muted-foreground/70">+</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onIncentiveClick(e, reserve, 'supply', visibleSupplyIncentive);
                  }}
                  className={`inline-flex items-center rounded-full px-[var(--ds-space-1)] shrink-0 ring-1 active:scale-95 transition-all hover:ring-2 ${
                    isDisabled
                      ? 'text-secondary bg-secondary/10 ring-secondary/20 hover:bg-secondary/20 hover:ring-secondary/30'
                      : 'ds-text-emerald-500 ds-bg-emerald-500-10 hover:bg-[rgb(var(--ds-emerald-500-rgb)/0.25)] ds-ring-emerald-500-15 hover:ring-[rgb(var(--ds-emerald-500-rgb)/0.35)]'
                  }`}
                >
                  <span>{formatPercent(visibleSupplyIncentive)}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      );
    }

    // Borrow tab
    const heroValue = displayBorrowTotal;
    const isDisabled = reserve.borrowDisabled;
    const heroColorClass = heroValue === null || isDisabled ? 'text-secondary' : 'ds-text-brand-cyan';
    return (
        <div className="flex flex-col items-center gap-0.5">
        {isDisabled ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <p className={`ds-text-24 font-bold tabular-nums ${heroColorClass} cursor-auto`}>
                {formatPercent(heroValue)}
              </p>
            </TooltipTrigger>
            <TooltipContent>Borrow disabled</TooltipContent>
          </Tooltip>
        ) : (
          <p className={`ds-text-24 font-bold tabular-nums ${heroColorClass}`}>
            {formatPercent(heroValue)}
          </p>
        )}
        {/* Invisible spacer to match supply breakdown height and prevent jitter */}
        <div className="min-h-[1rem]">
          {visibleBorrowIncentive !== null && (
            <div className="flex items-center gap-[var(--ds-space-1)] ds-text-11">
              <span className={isDisabled ? 'text-secondary' : 'ds-text-brand-cyan-70 font-medium'}>
                {formatPercent(displayBorrowNative)}
              </span>
              <span className="text-muted-foreground/70">-</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onIncentiveClick(e, reserve, 'borrow', visibleBorrowIncentive);
                }}
                className={`inline-flex items-center rounded-full px-[var(--ds-space-1)] shrink-0 ring-1 active:scale-95 transition-all hover:ring-2 ${
                  isDisabled
                    ? 'text-secondary bg-secondary/10 ring-secondary/20 hover:bg-secondary/20 hover:ring-secondary/30'
                    : 'ds-text-brand-cyan ds-bg-brand-cyan-10 hover:bg-[rgb(var(--ds-brand-cyan-rgb)/0.25)] ds-ring-brand-cyan-15 hover:ring-[rgb(var(--ds-brand-cyan-rgb)/0.35)]'
                }`}
              >
                <span>{formatPercent(visibleBorrowIncentive)}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  /** RAY → display %; must match `interestRateCalculator` / desktop `simulation.utilization.optimal`. */
  const RAY_TO_PERCENT_DIVISOR = 1e25;
  const optimalPctFromReserve =
    reserve.optimalUsageRate != null && Number(reserve.optimalUsageRate) > 0
      ? Number(reserve.optimalUsageRate) / RAY_TO_PERCENT_DIVISOR
      : null;
  const optimalPct = simulation.utilization.optimal ?? optimalPctFromReserve;

  /** Same rule as `ReservesTable.getDisplayUtilization` / desktop row: scenario uses after when shared inputs exist. */
  const displayUtilization = hasSharedScenario
    ? simulation.utilization.after ?? simulation.utilization.current
    : simulation.utilization.current;

  return (
    <div data-reserve-id={`${reserve.marketName}-${reserve.tokenAddress}`} className={isSimulationExpanded && !showUpperOnly ? 'shadow-sm rounded-xl' : ''}>
      {/* Card upper part */}
      <div
        className={`bg-card border border-border/60 py-3 transition-all duration-300 ${
          connectedBelow || (isSimulationExpanded && !showUpperOnly) ? 'rounded-t-xl rounded-b-none border-b-0' : 'rounded-xl shadow-sm'
        }`}
      >
        {/* Token header */}
        <div className="flex items-center gap-[var(--ds-space-2)] mb-2 min-h-[36px] px-3">
          <a
            href={buildAaveReserveUrl({ marketName: reserve.marketName, tokenAddress: reserve.tokenAddress }) || '#'}
            {...externalLinkTabProps(true)}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-[var(--ds-space-2)] min-w-0 flex-1 active:opacity-70 transition-opacity"
            aria-label={`Open ${reserve.tokenSymbol} on Aave`}
          >
            <TokenIcon
              symbol={iconSymbol}
              size={28}
              loading="eager"
              className="shrink-0"
              logoURI={logoURI}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-[var(--ds-space-1)]">
                <p className="font-bold text-foreground ds-text-14 truncate">{reserve.tokenSymbol}</p>
                <ExternalLink className="w-3 h-3 text-muted-foreground/50 shrink-0" />
              </div>
              <div className="flex items-center gap-[var(--ds-space-1)] ds-text-11 text-muted-foreground">
                {chainIconSrc && (
                  <img src={chainIconSrc} alt={reserve.chainName} className="w-3.5 h-3.5" />
                )}
                <span className="truncate">{getMarketDisplayName()}</span>
              </div>
            </div>
          </a>
          {/* Utilization indicator - clickable (values match desktop Util. column + UtilizationIndicator) */}
          {displayUtilization != null && optimalPct != null && (
            <button
              type="button"
              onClick={() => setCapSheet('utilization')}
              className="shrink-0 flex items-center gap-0.5 rounded-md px-1 py-0.5 transition-all hover:bg-muted/50 active:scale-[0.97]"
              aria-label="Show utilization details"
            >
              <span className={`ds-text-11 font-medium tabular-nums leading-none ${
                displayUtilization > optimalPct ? 'text-amber-600' : 'text-foreground'
              }`}>
                {displayUtilization.toFixed(0)}%
              </span>
              <UtilizationIndicator
                current={displayUtilization}
                optimal={optimalPct}
                width={8}
                height={16}
              />
            </button>
          )}
        </div>

        {/* Pill tabs */}
        <div className="mx-3 mb-1.5 flex gap-[var(--ds-space-1)] rounded-lg bg-muted/40 p-0.5">
          <button
            type="button"
            onClick={() => setActiveTab('supply')}
            className={`flex-1 ds-text-12 font-medium py-1 rounded-md transition-all duration-200 ${
              activeTab === 'supply'
                ? 'ds-bg-emerald-500-10 ds-text-emerald-500 shadow-sm ring-1 ds-ring-emerald-500-15'
                : 'text-muted-foreground hover:text-foreground/70'
            }`}
          >
            Supply
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('borrow')}
            className={`flex-1 ds-text-12 font-medium py-1 rounded-md transition-all duration-200 ${
              activeTab === 'borrow'
                ? 'ds-bg-brand-cyan-10 ds-text-brand-cyan shadow-sm ring-1 ds-ring-brand-cyan-15'
                : 'text-muted-foreground hover:text-foreground/70'
            }`}
          >
            Borrow
          </button>
        </div>

        {/* Tab content */}
        <div className="flex w-full flex-col">
          {renderAmountRow()}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
              className="mt-1"
            >
              {renderHeroApy()}
            </motion.div>
          </AnimatePresence>

          {/* Simulation toggle — shows Spread inside */}
          <div className="mt-2 px-3">
            <button
              type="button"
              onClick={onToggleSimulation}
              aria-expanded={isSimulationExpanded}
              aria-label={isSimulationExpanded ? 'Collapse reserve details' : 'Expand reserve details'}
              className={`inline-flex w-full items-center justify-between gap-2 rounded-lg px-3 py-1.5 ds-text-12 text-muted-foreground transition-colors duration-300 ${
                isSimulationExpanded
                  ? 'border-2 border-foreground/40 bg-muted/50'
                  : 'border border-border/70 bg-background hover:bg-muted/40'
              }`}
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="ds-text-11 text-muted-foreground/70 shrink-0">Spread</span>
                <span className={`ds-text-11 font-medium tabular-nums ${displaySpread !== null ? 'text-purple-500' : 'text-muted-foreground/70'}`}>
                  {formatSpread(displaySpread)}
                </span>
              </span>
              <ListCollapse className={`h-3.5 w-3.5 shrink-0 transition-transform duration-300 ${isSimulationExpanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {/* Mobile bottom sheet for cap / utilization details */}
        {capSheet !== null && (
          <>
            <div
              className="fixed inset-0 z-30 bg-background/20"
              onClick={() => setCapSheet(null)}
              aria-hidden="true"
            />
            <div
              className="fixed bottom-0 left-0 right-0 z-40 rounded-t-2xl border border-border/60 bg-card ds-tooltip-shadow-up max-h-[80vh] overflow-y-auto"
              role="dialog"
              aria-modal="true"
              aria-labelledby="cap-sheet-title"
            >
              <div className="sticky top-0 bg-card border-b border-border px-[var(--ds-space-4)] py-[var(--ds-space-3)] flex items-center justify-between z-10">
                <h3 id="cap-sheet-title" className="ds-tooltip-title text-foreground">
                  {capSheet === 'supply' ? 'Supply cap details' : capSheet === 'borrow' ? 'Borrow cap details' : 'Utilization'}
                </h3>
                <button
                  type="button"
                  onClick={() => setCapSheet(null)}
                  className="p-[var(--ds-space-1-5)] rounded-full hover:bg-muted transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
              <div className="px-[var(--ds-space-4)] pt-[var(--ds-space-3)] pb-[var(--ds-space-3)]">
                {capSheet === 'supply' && (
                  <SupplyCapSheetContent
                    currentSize={displayReserveSizeUsd ?? 0}
                    cap={reserve.supplyCapUsd!}
                    inputMode={inputMode}
                    tokenPrice={displayTokenPrice}
                    tokenSymbol={reserve.tokenSymbol}
                  />
                )}
                {capSheet === 'borrow' && (
                  <BorrowCapSheetContent
                    borrowed={totalBorrowedUsd ?? 0}
                    cap={reserve.borrowCapUsd!}
                    poolLiquidity={poolLiquidity ?? 0}
                    inputMode={inputMode}
                    tokenPrice={displayTokenPrice}
                    tokenSymbol={reserve.tokenSymbol}
                  />
                )}
                {capSheet === 'utilization' && optimalPct != null && displayUtilization != null && (
                  <UtilizationSheetContent
                    current={displayUtilization}
                    optimal={optimalPct}
                  />
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Simulation panel — visually connected below the card */}
      {!showUpperOnly && (
        <div
          className="grid transition-[grid-template-rows] duration-300 ease-in-out"
          style={{ gridTemplateRows: isSimulationExpanded ? '1fr' : '0fr' }}
        >
          <div className="overflow-hidden">
            {hasSimulationMounted && (
              <div className="-mt-px bg-card border border-border/60 border-t-0 rounded-b-xl rounded-t-none pb-3 pt-0">
                <div className="px-3">
                  <SimulationSubRow
                    reserve={reserve}
                    simulation={simulation}
                    isApy={isApy}
                    supplyInput={supplyInput}
                    borrowInput={borrowInput}
                    inputMode={inputMode}
                    compact
                    embeddedFromTop
                    onCorrectSupplyInput={onCorrectSupplyInput}
                    onCorrectBorrowInput={onCorrectBorrowInput}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
MobileReserveCard.displayName = 'MobileReserveCard';

export default MobileReserveCard;
