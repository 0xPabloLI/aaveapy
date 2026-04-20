import { memo, useEffect, useState } from 'react';
import { ListCollapse, Plus, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { ReserveWithSpread } from '@/types/aave';
import {
  formatPercent,
  formatScenarioSize,
  formatSpread,
  getReserveMarketDisplayName,
  resolveVisibleIncentiveBadgeValue,
} from '@/lib/formatters';
import { getChainIconSrc } from '@/lib/chainIcons';
import { getReserveKey } from '@/lib/reserveKey';
import { TokenIcon } from '@/components/primitives/TokenIcon';
import { IncentiveIcon } from '@/components/IncentiveIcon';
import { fetchIconSymbolAndName } from '@/ui-config/reservePatches';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import SimulationSubRow from './SimulationSubRow';
import UtilizationIndicator from './UtilizationIndicator';
import CapProgressRing from './CapProgressRing';
import BorrowCapProgressRing from './BorrowCapProgressRing';
import AssetActionMenu from './AssetActionMenu';

import DeficitShieldIcon from './DeficitShieldIcon';
import {
  calculateDeficitShareRatio,
  formatReserveDeficitTokenCompact,
  getDeficitSeverity,
  getReserveDeficitUsdAmount,
  hasReserveDeficit,
} from '@/lib/deficit';
import type { RateSimulationResult } from '@/hooks/useRateSimulation';
import { getPoolLiquidityUsd, getScenarioSupplySizeUsd, getTotalBorrowedUsd, getValidTokenPrice } from '@/lib/scenarioSize';
import { buildPoolExplorerUrl } from '@/lib/poolExplorerLinks';
import { cn } from '@/lib/utils';
import {
  SupplyCapSheetContent,
  BorrowCapSheetContent,
  UtilizationSheetContent,
  DeficitSheetContent,
} from './MobileReserveSheetContent';

interface MobileReserveCardProps {
  reserve: ReserveWithSpread;
  isApy: boolean;
  /** Matches table / `getMerklBreakdownApr` Tydro USD rate. */
  tydroPointToUsdRate: number;
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
  /** Portfolio mode: show checkbox overlay. */
  isPortfolioMode?: boolean;
  /** Whether this reserve is already in the portfolio. */
  isInPortfolio?: boolean;
  /** Callback to add/remove from portfolio. */
  onPortfolioToggle?: (reserveId: string, reserve: ReserveWithSpread) => void;
  /** Callback from SimulationSubRow "Add to Portfolio" button. */
  onAddToPortfolio?: (reserve: ReserveWithSpread, side: 'supply' | 'borrow') => void;
}

interface MobileReserveAmountRowProps {
  activeTab: 'supply' | 'borrow';
  reserve: ReserveWithSpread;
  inputMode: 'usd' | 'token';
  displayTokenPrice?: number | null;
  displayReserveSizeUsd: number | null;
  totalBorrowedUsd: number;
  poolLiquidity: number;
  hasDeficit: boolean;
  deficitUsd: number | null;
  deficitShareRatio: number | null;
  deficitTextClass: string;
  isNeutralDeficit: boolean;
  onShowSupplyCap: () => void;
  onShowBorrowCap: () => void;
  onShowDeficit: () => void;
}

function MobileReserveAmountRow({
  activeTab,
  reserve,
  inputMode,
  displayTokenPrice,
  displayReserveSizeUsd,
  totalBorrowedUsd,
  poolLiquidity,
  hasDeficit,
  deficitUsd,
  deficitShareRatio,
  deficitTextClass,
  isNeutralDeficit,
  onShowSupplyCap,
  onShowBorrowCap,
  onShowDeficit,
}: MobileReserveAmountRowProps) {
  const tp = reserve.tokenPrice;
  const priceEl =
    tp != null && Number.isFinite(tp) ? (
      <span className="ds-text-10 text-muted-foreground/60 tabular-nums shrink-0 leading-none sm:ds-text-11">
        {`$${tp < 0.01 ? tp.toExponential(1) : tp < 100 ? tp.toFixed(2) : tp.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
      </span>
    ) : null;

  if (activeTab === 'supply') {
    const hasSupplyCap =
      reserve.supplyCapUsd != null && Number.isFinite(reserve.supplyCapUsd) && reserve.supplyCapUsd > 0;

    return (
      <div className="flex w-full min-w-0 flex-nowrap items-center gap-1.5 px-4">
        {priceEl}
        <div className="ml-auto flex min-w-0 items-center justify-end gap-1">
          {hasDeficit && deficitUsd != null ? (
            <button
              type="button"
              className={cn(
                'inline-flex items-center justify-center rounded-md p-0.5 transition-colors hover:bg-muted/50 active:scale-[0.97]',
                deficitTextClass,
              )}
              aria-label={`Show deficit details for ${reserve.tokenSymbol}`}
              onClick={onShowDeficit}
            >
              <DeficitShieldIcon ratio={deficitShareRatio} className={cn('h-3 w-3', isNeutralDeficit && 'opacity-70')} />
            </button>
          ) : null}
          {hasSupplyCap ? (
            <button
              type="button"
              className="flex min-w-0 items-center gap-1 rounded-md py-0 pl-1 pr-0 ds-text-emerald-500 transition-all hover:bg-muted/50 active:scale-[0.98] cursor-pointer"
              aria-label="Show supply cap details"
              onClick={onShowSupplyCap}
            >
              <span className="ds-text-13 font-medium tabular-nums leading-none truncate">
                {formatScenarioSize(displayReserveSizeUsd, {
                  inputMode,
                  tokenPrice: displayTokenPrice,
                  tokenSymbol: reserve.tokenSymbol,
                })}
              </span>
              <CapProgressRing
                size={displayReserveSizeUsd}
                cap={reserve.supplyCapUsd}
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
              {formatScenarioSize(displayReserveSizeUsd, {
                inputMode,
                tokenPrice: displayTokenPrice,
                tokenSymbol: reserve.tokenSymbol,
              })}
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
            onClick={onShowBorrowCap}
          >
            <span className="ds-text-13 font-medium tabular-nums leading-none truncate">
              {formatScenarioSize(totalBorrowedUsd, {
                inputMode,
                tokenPrice: displayTokenPrice,
                tokenSymbol: reserve.tokenSymbol,
              })}
            </span>
            <BorrowCapProgressRing
              borrowed={totalBorrowedUsd}
              cap={reserve.borrowCapUsd}
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
            {formatScenarioSize(totalBorrowedUsd, {
              inputMode,
              tokenPrice: displayTokenPrice,
              tokenSymbol: reserve.tokenSymbol,
            })}
          </span>
        )}
      </div>
    </div>
  );
}

interface MobileReserveHeroApyProps {
  activeTab: 'supply' | 'borrow';
  reserve: ReserveWithSpread;
  displaySupplyTotal: number | null;
  displaySupplyNative: number | null;
  visibleSupplyIncentive: number | null;
  displayBorrowTotal: number | null;
  displayBorrowNative: number | null;
  visibleBorrowIncentive: number | null;
  onIncentiveClick: (
    e: React.MouseEvent,
    reserve: ReserveWithSpread,
    type: 'supply' | 'borrow',
    apy: number | null
  ) => void;
}

function MobileReserveHeroApy({
  activeTab,
  reserve,
  displaySupplyTotal,
  displaySupplyNative,
  visibleSupplyIncentive,
  displayBorrowTotal,
  displayBorrowNative,
  visibleBorrowIncentive,
  onIncentiveClick,
}: MobileReserveHeroApyProps) {
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
                className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-px shrink-0 ring-1 active:scale-95 transition-all hover:ring-2 ${
                  isDisabled
                    ? 'text-secondary bg-secondary/10 ring-secondary/20 hover:bg-secondary/20 hover:ring-secondary/30'
                    : 'ds-text-emerald-500 bg-gradient-to-r from-[rgb(var(--ds-emerald-500-rgb)/0.08)] to-[rgb(var(--ds-emerald-500-rgb)/0.15)] hover:from-[rgb(var(--ds-emerald-500-rgb)/0.15)] hover:to-[rgb(var(--ds-emerald-500-rgb)/0.25)] ds-ring-emerald-500-15 hover:ring-[rgb(var(--ds-emerald-500-rgb)/0.35)]'
                }`}
              >
                <span>{formatPercent(visibleSupplyIncentive)}</span>
                <IncentiveIcon width={8} height={8} />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

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
              className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-px shrink-0 ring-1 active:scale-95 transition-all hover:ring-2 ${
                isDisabled
                  ? 'text-secondary bg-secondary/10 ring-secondary/20 hover:bg-secondary/20 hover:ring-secondary/30'
                  : 'ds-text-brand-cyan bg-gradient-to-r from-[rgb(var(--ds-brand-cyan-rgb)/0.08)] to-[rgb(var(--ds-brand-cyan-rgb)/0.15)] hover:from-[rgb(var(--ds-brand-cyan-rgb)/0.15)] hover:to-[rgb(var(--ds-brand-cyan-rgb)/0.25)] ds-ring-brand-cyan-15 hover:ring-[rgb(var(--ds-brand-cyan-rgb)/0.35)]'
              }`}
            >
              <span>{formatPercent(visibleBorrowIncentive)}</span>
              <IncentiveIcon width={8} height={8} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const MobileReserveCard = memo(({
  reserve,
  isApy,
  tydroPointToUsdRate,
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
  isPortfolioMode,
  isInPortfolio,
  onPortfolioToggle,
  onAddToPortfolio,
}: MobileReserveCardProps) => {
  const [capSheet, setCapSheet] = useState<'supply' | 'borrow' | 'utilization' | 'deficit' | null>(null);
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

  const visibleSupplyIncentive = resolveVisibleIncentiveBadgeValue(
    displaySupplyIncentive,
    reserve,
    'supply',
    isApy,
    tydroPointToUsdRate,
  );
  const visibleBorrowIncentive = resolveVisibleIncentiveBadgeValue(
    displayBorrowIncentive,
    reserve,
    'borrow',
    isApy,
    tydroPointToUsdRate,
  );

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
  const baseTotalBorrowedUsd = getTotalBorrowedUsd({
    reserveSizeUsd: reserve.reserveSizeUsd,
    utilizationPct: reserve.utilizationPct,
  });
  const totalBorrowedUsd = simulation?.marketMetrics.totalBorrowedUsdAfter ?? baseTotalBorrowedUsd;
  const basePoolLiquidity = getPoolLiquidityUsd({
    reserveSizeUsd: reserve.reserveSizeUsd,
    totalBorrowedUsd: baseTotalBorrowedUsd,
  });
  const poolLiquidity = simulation?.marketMetrics.availableLiquidityUsdAfter ?? basePoolLiquidity;
  const hasDeficit = hasReserveDeficit(reserve);
  const deficitUsd = getReserveDeficitUsdAmount(reserve, displayTokenPrice);
  const deficitTokenCompact = formatReserveDeficitTokenCompact(reserve);
  const deficitTokenLabel = deficitTokenCompact !== '-' ? deficitTokenCompact : undefined;
  const deficitShareRatio = calculateDeficitShareRatio({
    deficitUsd,
    totalSuppliedUsd: displayReserveSizeUsd,
  });
  const deficitSeverity = getDeficitSeverity(deficitShareRatio);
  const isNeutralDeficit = deficitSeverity === 'neutral';
  const deficitTextClass = deficitSeverity === 'critical'
    ? 'text-amber-600/90'
    : deficitSeverity === 'warning'
      ? 'text-amber-500/90'
      : 'text-muted-foreground/60';

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
          showAddToPortfolio={isPortfolioMode}
          onAddToPortfolio={onAddToPortfolio}
        />
      </div>
    );
  }

  const showUpperOnly = variant === 'upperOnly';

  /** RAY → display %; must match `interestRateCalculator` / desktop `simulation.utilization.optimal`. */
  const RAY_TO_PERCENT_DIVISOR = 1e25;
  const optimalPctFromReserve =
    reserve.optimalUsageRate != null && Number(reserve.optimalUsageRate) > 0
      ? Number(reserve.optimalUsageRate) / RAY_TO_PERCENT_DIVISOR
      : null;
  const optimalPct = simulation.utilization.optimal ?? optimalPctFromReserve;
  const reserveId = getReserveKey(reserve);

  /** Same rule as `ReservesTable.getDisplayUtilization` / desktop row: scenario uses after when shared inputs exist. */
  const displayUtilization = hasSharedScenario
    ? simulation.utilization.after ?? simulation.utilization.current
    : simulation.utilization.current;

  return (
    <div data-reserve-id={reserveId} className={isSimulationExpanded && !showUpperOnly ? 'shadow-sm rounded-xl border border-border/60 bg-card' : ''}>
      {/* Card upper part */}
      <div
        className={`bg-card py-3 transition-all duration-300 ${
          isSimulationExpanded && !showUpperOnly
            ? 'rounded-t-xl rounded-b-none'
            : connectedBelow
              ? 'border border-border/60 rounded-t-xl rounded-b-none border-b-transparent shadow-sm'
              : 'border border-border/60 rounded-xl shadow-sm'
        }`}
      >
        {/* Token header */}
        <div className="flex items-center gap-[var(--ds-space-2)] mb-1.5 min-h-[36px] px-3">
          {isPortfolioMode && onPortfolioToggle && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPortfolioToggle(reserveId, reserve);
              }}
              className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-all duration-150',
                isInPortfolio
                  ? 'bg-primary/15 border-primary/40 text-primary'
                  : 'border-border/60 text-muted-foreground/40',
              )}
              aria-label={isInPortfolio ? `Remove ${reserve.tokenSymbol} from portfolio` : `Add ${reserve.tokenSymbol} to portfolio`}
            >
              {isInPortfolio ? (
                <span className="ds-text-11 font-bold leading-none">✓</span>
              ) : (
                <Plus className="h-3 w-3" />
              )}
            </button>
          )}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <TokenIcon
              symbol={iconSymbol}
              size={28}
              loading="eager"
              className="shrink-0"
              logoURI={logoURI}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <p className="font-bold text-foreground ds-text-14 truncate">{reserve.tokenSymbol}</p>
                <AssetActionMenu
                  tokenSymbol={reserve.tokenSymbol}
                  tokenAddress={reserve.tokenAddress}
                  marketName={reserve.marketName}
                  aaveProReserveId={reserve.aaveProReserveId}
                  isMobile
                  triggerSize={13}
                  triggerClassName="shrink-0"
                />
              </div>
              <div className="flex items-center gap-1 ds-text-11 text-muted-foreground/80">
                {chainIconSrc && (
                  <img src={chainIconSrc} alt={reserve.chainName} className="w-3 h-3 opacity-80" />
                )}
                <span className="truncate">{getReserveMarketDisplayName(reserve)}</span>
              </div>
            </div>
          </div>
          {/* Utilization indicator - clickable (values match desktop Utilization column + UtilizationIndicator) */}
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
          <MobileReserveAmountRow
            activeTab={activeTab}
            reserve={reserve}
            inputMode={inputMode}
            displayTokenPrice={displayTokenPrice}
            displayReserveSizeUsd={displayReserveSizeUsd}
            totalBorrowedUsd={totalBorrowedUsd}
            poolLiquidity={poolLiquidity}
            hasDeficit={hasDeficit}
            deficitUsd={deficitUsd}
            deficitShareRatio={deficitShareRatio}
            deficitTextClass={deficitTextClass}
            isNeutralDeficit={isNeutralDeficit}
            onShowSupplyCap={() => setCapSheet('supply')}
            onShowBorrowCap={() => setCapSheet('borrow')}
            onShowDeficit={() => setCapSheet('deficit')}
          />
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
              className="mt-1"
            >
              <MobileReserveHeroApy
                activeTab={activeTab}
                reserve={reserve}
                displaySupplyTotal={displaySupplyTotal}
                displaySupplyNative={displaySupplyNative}
                visibleSupplyIncentive={visibleSupplyIncentive}
                displayBorrowTotal={displayBorrowTotal}
                displayBorrowNative={displayBorrowNative}
                visibleBorrowIncentive={visibleBorrowIncentive}
                onIncentiveClick={onIncentiveClick}
              />
            </motion.div>
          </AnimatePresence>

          {/* Simulation toggle — shows Spread inside */}
          <div className="mt-1.5 px-3">
            <button
              type="button"
              onClick={onToggleSimulation}
              aria-expanded={isSimulationExpanded}
              aria-label={isSimulationExpanded ? 'Collapse details panel' : 'Expand details panel'}
              className={`inline-flex w-full items-center justify-between gap-2 rounded-lg px-3 py-1.5 ds-text-12 text-muted-foreground transition-all duration-200 ${
                isSimulationExpanded
                  ? 'border border-foreground/25 bg-muted/60 shadow-sm dark:border-foreground/20 dark:bg-muted/40'
                  : 'border border-border/60 bg-background hover:bg-muted/40 hover:border-border/80 dark:bg-card/50 dark:hover:bg-muted/30'
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
        <AnimatePresence>
          {capSheet !== null && (
            <>
              <motion.div
                className="fixed inset-0 z-30 bg-background/40"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => setCapSheet(null)}
                aria-hidden="true"
              />
              <motion.div
                className="fixed bottom-0 left-0 right-0 z-40 rounded-t-2xl border border-border/60 bg-card ds-tooltip-shadow-up max-h-[80vh] overflow-y-auto"
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="cap-sheet-title"
              >
                <div className="sticky top-0 bg-card border-b border-border px-[var(--ds-space-4)] py-[var(--ds-space-3)] flex items-center justify-between z-10">
                  <h3 id="cap-sheet-title" className="ds-tooltip-title text-foreground">
                    {capSheet === 'supply'
                      ? 'Supply cap details'
                      : capSheet === 'borrow'
                        ? 'Borrow cap details'
                        : capSheet === 'deficit'
                          ? 'Deficit details'
                          : 'Utilization'}
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
                  {capSheet === 'deficit' && deficitUsd != null && (
                    <DeficitSheetContent
                      deficitUsd={deficitUsd}
                      totalSuppliedUsd={displayReserveSizeUsd}
                      deficitTokenLabel={deficitTokenLabel}
                      inputMode={inputMode}
                      tokenPrice={displayTokenPrice}
                      tokenSymbol={reserve.tokenSymbol}
                      poolExplorerUrl={buildPoolExplorerUrl(reserve.marketName)}
                    />
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Simulation panel — visually connected below the card */}
      {!showUpperOnly && (
        <div
          className="grid transition-[grid-template-rows] duration-300 ease-in-out"
          style={{ gridTemplateRows: isSimulationExpanded ? '1fr' : '0fr' }}
        >
          <div className="overflow-hidden">
            {hasSimulationMounted && (
              <div className="bg-card rounded-b-xl rounded-t-none pb-3 pt-0">
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
                    showAddToPortfolio={isPortfolioMode}
                    onAddToPortfolio={onAddToPortfolio}
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
