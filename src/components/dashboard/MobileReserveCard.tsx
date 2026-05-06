import { memo, useEffect, useState } from 'react';
import { ListCollapse, PauseCircle, Plus, Snowflake, X } from 'lucide-react';
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
import { RateSimulationResult } from '@/hooks/useRateSimulation';

import { getDisplayAvailableLiquidityUsd, getDisplayTotalBorrowedUsd, nativeToUsd, getScenarioSupplySizeUsd } from '@/lib/scenarioSize';
import { buildPoolExplorerUrl } from '@/lib/poolExplorerLinks';
import { buildAaveProHubUrl } from '@/lib/aaveLinks';
import { getProtocolVersion } from '@/lib/protocolVersion';
import { cn } from '@/lib/utils';
import {
  SupplyCapSheetContent,
  BorrowCapSheetContent,
  UtilizationSheetContent,
  DeficitSheetContent,
  FrozenSheetContent,
} from './MobileReserveSheetContent';
import { BATCH_RESERVE_ADD_BUTTON_CLASSES } from './batchTheme';

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
  onPortfolioToggle?: (reserveId: string, reserve: ReserveWithSpread, side?: 'supply' | 'borrow') => void;
  /** Callback when hub pill is clicked for filtering. */
  onSelectHub?: (hubName: string) => void;
  onHubChipClick?: (reserveId: string) => void;
}

interface MobileReserveAmountRowProps {
  activeTab: 'supply' | 'borrow';
  reserve: ReserveWithSpread;
  inputMode: 'usd' | 'token';
  displayTokenPrice?: number | null;
  displayReserveSizeUsd: number | null;
  totalBorrowedUsd: number;
  availableLiquidityUsd: number;
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
  availableLiquidityUsd,
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
    const computedSupplyCapUsd = nativeToUsd(reserve.supplyCap, reserve.decimals, reserve.tokenPrice);
    const hasSupplyCap =
      computedSupplyCapUsd != null && Number.isFinite(computedSupplyCapUsd) && computedSupplyCapUsd > 0;

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
                cap={computedSupplyCapUsd}
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

  const computedBorrowCapUsd = nativeToUsd(reserve.borrowCap, reserve.decimals, reserve.tokenPrice);
  const hasBorrowCap = computedBorrowCapUsd != null && Number.isFinite(computedBorrowCapUsd) && computedBorrowCapUsd > 0;

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
              cap={computedBorrowCapUsd}
              availableLiquidityUsd={availableLiquidityUsd}
              disabled={reserve.borrowDisabled}
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
  isApy: boolean;
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
  isApy,
  reserve,
  displaySupplyTotal,
  displaySupplyNative,
  visibleSupplyIncentive,
  displayBorrowTotal,
  displayBorrowNative,
  visibleBorrowIncentive,
  onIncentiveClick,
}: MobileReserveHeroApyProps) {
  const rateUnitLabel = isApy ? 'APY' : 'APR';
  const noIncentivePlaceholder = (
    <span className="ds-text-10 font-medium leading-none text-muted-foreground/55">
      {`Base ${rateUnitLabel} only`}
    </span>
  );

  if (activeTab === 'supply') {
    const heroValue = displaySupplyTotal;
    const isDisabled = reserve.supplyDisabled;
    const heroColorClass = heroValue === null || isDisabled ? 'text-secondary' : 'ds-text-emerald-500';

    return (
      <div className="flex flex-col items-center gap-0.5">
        {isDisabled ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <p className={`ds-text-22 font-bold tabular-nums ${heroColorClass} cursor-auto`}>
                {formatPercent(heroValue)}
              </p>
            </TooltipTrigger>
            <TooltipContent>Supply unavailable</TooltipContent>
          </Tooltip>
        ) : (
          <p className={`ds-text-22 font-bold tabular-nums ${heroColorClass}`}>
            {formatPercent(heroValue)}
          </p>
        )}
        <div className="flex min-h-[1rem] items-center justify-center">
          {visibleSupplyIncentive !== null ? (
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
          ) : !isDisabled ? noIncentivePlaceholder : null}
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
            <p className={`ds-text-22 font-bold tabular-nums ${heroColorClass} cursor-auto`}>
              {formatPercent(heroValue)}
            </p>
          </TooltipTrigger>
          <TooltipContent>Borrow disabled</TooltipContent>
        </Tooltip>
      ) : (
        <p className={`ds-text-22 font-bold tabular-nums ${heroColorClass}`}>
          {formatPercent(heroValue)}
        </p>
      )}
      <div className="flex min-h-[1rem] items-center justify-center">
        {visibleBorrowIncentive !== null ? (
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
        ) : !isDisabled ? noIncentivePlaceholder : null}
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
  onSelectHub,
  onHubChipClick,
}: MobileReserveCardProps) => {
  const [capSheet, setCapSheet] = useState<'supply' | 'borrow' | 'utilization' | 'deficit' | 'frozen' | null>(null);
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

  // Frozen/paused/disabled gating: keep parity with desktop SimulationSubRow.
  // See docs/design/frontend-interaction-guardrails.md "Reserve simulation gating".
  const isReserveLocked = Boolean(reserve.isFrozen || reserve.isPaused);
  const supplyLocked = isReserveLocked || Boolean(reserve.supplyDisabled);
  const borrowLocked = isReserveLocked || Boolean(reserve.borrowDisabled);
  const useSupplyAfter = hasSharedScenario && !supplyLocked;
  const useBorrowAfter = hasSharedScenario && !borrowLocked;
  const useSpreadAfter = hasSharedScenario && !supplyLocked && !borrowLocked;

  const displaySupplyTotal = useSupplyAfter
    ? simulation.supply.afterTotal ?? simulation.supply.currentTotal
    : simulation.supply.currentTotal;
  const displayBorrowTotal = useBorrowAfter
    ? simulation.borrow.afterTotal ?? simulation.borrow.currentTotal
    : simulation.borrow.currentTotal;
  const displaySupplyNative = useSupplyAfter
    ? simulation.supply.afterNative ?? simulation.supply.currentNative
    : simulation.supply.currentNative;
  const displayBorrowNative = useBorrowAfter
    ? simulation.borrow.afterNative ?? simulation.borrow.currentNative
    : simulation.borrow.currentNative;
  const displaySupplyIncentive = useSupplyAfter
    ? simulation.supply.afterIncentive ?? simulation.supply.currentIncentive
    : simulation.supply.currentIncentive;
  const displayBorrowIncentive = useBorrowAfter
    ? simulation.borrow.afterIncentive ?? simulation.borrow.currentIncentive
    : simulation.borrow.currentIncentive;
  const displaySpread = useSpreadAfter
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

  // Token price from reserve directly (must be positive finite number)
  const displayTokenPrice =
    reserve.tokenPrice != null && Number.isFinite(reserve.tokenPrice) && reserve.tokenPrice > 0
      ? reserve.tokenPrice
      : null;
  const protocolVersion = getProtocolVersion(reserve.marketName);
  const displayReserveSizeUsd = (() => {
    const usd = nativeToUsd(reserve.reserveSize, reserve.decimals, reserve.tokenPrice);
    if (usd == null || !Number.isFinite(usd)) return usd ?? null;
    return getScenarioSupplySizeUsd({
      reserveSizeUsd: usd,
      supplyCapUsd: nativeToUsd(reserve.supplyCap, reserve.decimals, reserve.tokenPrice),
      rawSupplyInput: useSupplyAfter ? supplyInput : '',
      inputMode,
      tokenPrice: displayTokenPrice,
    });
  })();
  const baseTotalBorrowedUsd = simulation?.marketMetrics.totalBorrowedUsd ?? getDisplayTotalBorrowedUsd(reserve, protocolVersion);
  const totalBorrowedUsd = useBorrowAfter
    ? simulation?.marketMetrics.totalBorrowedUsdAfter ?? baseTotalBorrowedUsd
    : baseTotalBorrowedUsd;
  const baseAvailableLiquidityUsd = simulation?.marketMetrics.availableLiquidityUsd ?? getDisplayAvailableLiquidityUsd(reserve, protocolVersion);
  const availableLiquidityUsd = useBorrowAfter
    ? simulation?.marketMetrics.availableLiquidityUsdAfter ?? baseAvailableLiquidityUsd
    : baseAvailableLiquidityUsd;
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
    ? 'ds-text-amber-500'
    : deficitSeverity === 'warning'
      ? 'ds-text-amber-600'
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
        />
      </div>
    );
  }

  const showUpperOnly = variant === 'upperOnly';

  /** reserve.optimalUsageRate 是 percent number（如 45 = 45%），直接显示，无需 RAY 转换。 */
  const optimalPct =
    reserve.optimalUsageRate != null && Number(reserve.optimalUsageRate) > 0
      ? Number(reserve.optimalUsageRate)
      : null;
  const reserveId = getReserveKey(reserve);

  /** Same rule as `ReservesTable.getDisplayUtilization` / desktop row: scenario uses after when shared inputs exist. */
  const baseUtilization = reserve.utilizationPct ?? simulation.utilization.current ?? null;
  const displayUtilization = useSpreadAfter
    ? simulation.utilization.after ?? baseUtilization
    : baseUtilization;

  return (
    <div data-reserve-id={reserveId} className={isSimulationExpanded && !showUpperOnly ? 'shadow-sm rounded-xl border border-border/60 bg-card' : ''}>
      {/* Card upper part */}
      <div
        className={`bg-card py-3 transition-all duration-300 ${reserve.isPaused ? 'ds-bg-paused ' : reserve.isFrozen ? 'ds-bg-sky-500-8 ' : ''}${
          isSimulationExpanded && !showUpperOnly
            ? 'rounded-t-xl rounded-b-none'
            : connectedBelow
              ? 'border border-border/60 rounded-t-xl rounded-b-none border-b-transparent shadow-sm'
              : 'border border-border/60 rounded-xl shadow-sm'
        }`}
      >
        {/* Token header */}
        <div className="flex items-start gap-[var(--ds-space-2)] mb-1.5 min-h-[36px] px-3">
          <div className="flex items-start gap-1 min-w-0 flex-1">
            {reserve.isFrozen || reserve.isPaused ? (
              <div className="relative shrink-0">
                <TokenIcon
                  symbol={iconSymbol}
                  size={28}
                  loading="eager"
                  logoURI={logoURI}
                />
                <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        data-testid="mobile-reserve-status-badge"
                        data-status={reserve.isPaused ? (reserve.isFrozen ? 'paused-frozen' : 'paused') : 'frozen'}
                        onClick={() => setCapSheet('frozen')}
                        aria-label={reserve.isPaused ? 'Show paused details' : 'Show frozen details'}
                        className="absolute -top-2 -left-2 z-10 grid place-items-center w-7 h-7 rounded-full bg-transparent"
                      >
                        <span
                          className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-white ${reserve.isPaused ? 'bg-[rgb(var(--ds-paused-rgb))]' : 'bg-sky-500'}`}
                        >
                          {reserve.isPaused ? <PauseCircle className="w-2 h-2" /> : <Snowflake className="w-2 h-2" />}
                        </span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{reserve.isPaused && reserve.isFrozen ? 'Paused & frozen' : reserve.isPaused ? 'Paused' : 'Frozen'}</TooltipContent>
                  </Tooltip>
              </div>
            ) : (
              <TokenIcon
                symbol={iconSymbol}
                size={28}
                loading="eager"
                className="shrink-0"
                logoURI={logoURI}
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-1.5">
                <div className="flex min-w-0 flex-1 items-start gap-0.5">
                  <p className="min-w-0 truncate whitespace-nowrap font-bold text-foreground ds-text-13 leading-tight">
                    {reserve.tokenSymbol}
                  </p>
                  <AssetActionMenu
                    tokenSymbol={reserve.tokenSymbol}
                    tokenAddress={reserve.tokenAddress}
                    marketName={reserve.marketName}
                    aaveProReserveId={reserve.aaveProReserveId}
                    chainName={reserve.chainName}
                    hubAddress={reserve.hubAddress}
                    isMobile
                    triggerSize={13}
                    triggerClassName="shrink-0"
                  />
                </div>
              </div>

              <div className="mt-0 flex min-w-0 items-center gap-1 ds-text-11 text-muted-foreground/80">
                {chainIconSrc && (
                  <img src={chainIconSrc} alt={reserve.chainName} className="w-3 h-3 shrink-0 opacity-80" />
                )}
                <span className="min-w-0 flex-1 truncate">{getReserveMarketDisplayName(reserve)}</span>
                {reserve.hubName && (() => {
                  const aaveProHubUrl = buildAaveProHubUrl(reserve);
                  const isV4 = protocolVersion === 'v4';
                  const hubClass = cn(
                    "inline-flex items-center rounded-full text-[9px] font-normal leading-none",
                    isV4
                      ? "text-[rgb(var(--ds-brand-magenta-rgb))] bg-[rgb(var(--ds-brand-magenta-rgb))]/10"
                      : "text-muted-foreground/70 bg-muted/40"
                  );

                  return (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectHub?.(reserve.hubName!);
                      }}
                      className={cn("inline-flex max-w-full shrink-0 items-center px-1.5 py-0.5 cursor-pointer transition-all duration-150 hover:opacity-80 active:scale-[0.98]", hubClass)}
                      aria-label={`Filter by ${reserve.hubName} hub`}
                      title={`Filter by ${reserve.hubName}`}
                    >
                      <span className="truncate">{reserve.hubName}</span>
                    </button>
                  );
                })()}
              </div>
            </div>
          </div>
          </div>

        {/* Liquidity — primary metric */}
        {availableLiquidityUsd != null && (
          <button
            type="button"
            onClick={() => setCapSheet('utilization')}
            className="w-full px-3 pb-1 text-left transition-colors hover:bg-muted/30 active:bg-muted/50"
            aria-label="Show utilization details"
          >
            <div className="flex items-center justify-between">
              <span className={`ds-text-14 font-bold tabular-nums ${
                (availableLiquidityUsd < 10000)
                  ? 'text-amber-600'
                  : 'ds-text-purple-600'
              }`}>
                {formatScenarioSize(availableLiquidityUsd, { inputMode, tokenPrice: displayTokenPrice, tokenSymbol: reserve.tokenSymbol })}
              </span>
              {displayUtilization != null && optimalPct != null && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className={`ds-text-11 tabular-nums cursor-default ${
                        displayUtilization > optimalPct ? 'text-amber-600' : 'text-muted-foreground'
                      }`}>
                        {displayUtilization.toFixed(0)}%
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p className="ds-text-12">Utilization = borrowed / (available + borrowed)</p>
                    </TooltipContent>
                  </Tooltip>
                  <UtilizationIndicator
                    current={displayUtilization}
                    optimal={optimalPct}
                    width={44}
                    height={14}
                  />
                </div>
              )}
            </div>
          </button>
        )}

        {/* Pill tabs */}
        <div className="mx-3 mb-1 flex gap-[var(--ds-space-1)] rounded-lg bg-muted/40 p-0.5">
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
            availableLiquidityUsd={availableLiquidityUsd}
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
              className="mt-0.5"
            >
              <MobileReserveHeroApy
                activeTab={activeTab}
                isApy={isApy}
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

          {/* Simulation toggle — horizontal single-line: Spread text on left, expand icon on right */}
          <div className="mt-1.5 px-3">
            <button
              type="button"
              onClick={onToggleSimulation}
              aria-expanded={isSimulationExpanded}
              aria-label={isSimulationExpanded ? 'Collapse details panel' : 'Expand details panel'}
              className={`flex w-full items-center justify-between rounded-lg px-2 py-1 ds-text-12 text-muted-foreground transition-all duration-200 active:scale-[0.995] ${
                isSimulationExpanded
                  ? 'border border-foreground/25 bg-muted/60 shadow-sm dark:border-foreground/20 dark:bg-muted/40'
                  : 'border border-border/60 bg-background hover:bg-muted/40 hover:border-border/80 dark:bg-card/50 dark:hover:bg-muted/30'
              }`}
            >
              {/* Spread text on left */}
              <span className="flex items-center gap-1">
                <span className="ds-text-10 text-muted-foreground/70">Spread</span>
                <span className={`ds-text-10 font-medium tabular-nums ${displaySpread !== null ? 'text-purple-500' : 'text-muted-foreground/70'}`}>
                  {formatSpread(displaySpread)}
                </span>
              </span>
              {/* Expand icon on the right */}
              <ListCollapse className={`h-3.5 w-3.5 shrink-0 transition-transform duration-300 ease-in-out ${isSimulationExpanded ? 'rotate-180' : ''}`} />
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
                  : capSheet === 'frozen'
                    ? `Status: ${[reserve.isFrozen && 'Frozen', reserve.isPaused && 'Paused'].filter(Boolean).join(' & ') || 'Frozen'}`
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
                      cap={nativeToUsd(reserve.supplyCap, reserve.decimals, reserve.tokenPrice) ?? 0}
                      inputMode={inputMode}
                      tokenPrice={displayTokenPrice}
                      tokenSymbol={reserve.tokenSymbol}
                    />
                  )}
                  {capSheet === 'borrow' && (
                    <BorrowCapSheetContent
                      borrowed={totalBorrowedUsd ?? 0}
                      cap={nativeToUsd(reserve.borrowCap, reserve.decimals, reserve.tokenPrice) ?? 0}
                      availableLiquidityUsd={availableLiquidityUsd ?? 0}
                      inputMode={inputMode}
                      tokenPrice={displayTokenPrice}
                      tokenSymbol={reserve.tokenSymbol}
                      borrowDisabled={reserve.borrowDisabled}
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
                  {capSheet === 'frozen' && (
                    <FrozenSheetContent isFrozen={reserve.isFrozen} isPaused={reserve.isPaused} />
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
