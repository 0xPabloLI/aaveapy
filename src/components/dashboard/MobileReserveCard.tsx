import { memo, useEffect, useState } from 'react';
import { ListCollapse, PauseCircle, Plus, Snowflake, X, Ban } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { ReserveWithSpread } from '@/types/aave';
import {
  formatPercent,
  formatScenarioSize,
  formatSpread,
  formatUsd,
  getReserveMarketDisplayName,
  resolveVisibleIncentiveBadgeValue,
} from '@/lib/formatters';
import { getChainIconSrc } from '@/lib/chainIcons';
import { getReserveKey } from '@/lib/reserveKey';
import { TokenIcon } from '@/components/primitives/TokenIcon';
import { IncentiveIcon } from '@/components/IncentiveIcon';
import { fetchIconSymbolAndName } from '@/ui-config/reservePatches';
import SimulationSubRow from './SimulationSubRow';
import UtilizationIndicator, { UtilizationContent } from './UtilizationIndicator';
import CapProgressRing, { CapProgressContent } from './CapProgressRing';
import BorrowCapProgressRing, { BorrowCapProgressContent } from './BorrowCapProgressRing';
import AssetActionMenu from './AssetActionMenu';

import DeficitShieldIcon from './DeficitShieldIcon';
import DeficitLiquidityRing, { DeficitProgressContent } from './DeficitLiquidityRing';
import {
  computeDeficitDisplay,
  type DeficitDisplay,
} from '@/lib/deficit';
import { isSupplyDisabled, isBorrowDisabled } from '@/lib/reserveStatus';
import { RateSimulationResult } from '@/hooks/useRateSimulation';

import { getDisplayAvailableLiquidityUsd, getDisplayTotalBorrowedUsd, nativeToUsd, getScenarioSupplySizeUsd } from '@/lib/scenarioSize';
import { buildPoolExplorerUrl } from '@/lib/poolExplorerLinks';
import { buildAaveProHubUrl } from '@/lib/aaveLinks';
import { getProtocolVersion } from '@/lib/protocolVersion';
import { cn } from '@/lib/utils';
import { FrozenStatusContent } from './ReserveStatusBadge';
import { BATCH_RESERVE_ADD_BUTTON_CLASSES } from './batchTheme';

interface MobileCapSheetProps {
  capSheet: 'supply' | 'borrow' | 'utilization' | 'deficit' | 'frozen' | null;
  onClose: () => void;
  reserve: ReserveWithSpread;
  displayReserveSizeUsd: number | null;
  displayUtilization: number | null;
  optimalPct: number | null;
  hasDeficit: boolean;
  deficitUsd: number | null | undefined;
  deficitTokenLabel: string | undefined;
  inputMode: 'usd' | 'token';
  displayTokenPrice: number | null;
  totalBorrowedUsd: number | null;
  availableLiquidityUsd: number | null;
}

function MobileCapSheet({
  capSheet,
  onClose,
  reserve,
  displayReserveSizeUsd,
  displayUtilization,
  optimalPct,
  hasDeficit,
  deficitUsd,
  deficitTokenLabel,
  inputMode,
  displayTokenPrice,
  totalBorrowedUsd,
  availableLiquidityUsd,
}: MobileCapSheetProps) {
  if (capSheet === null) return null;

  const CAP_SHEET_TITLE: Record<string, string> = {
    supply: 'Supply cap details',
    borrow: 'Borrow cap details',
    deficit: 'Deficit details',
    utilization: 'Utilization',
  };
  const title = capSheet === 'frozen'
    ? `Status: ${[reserve.isFrozen && 'Frozen', reserve.isPaused && 'Paused', reserve.isActive === false && 'Inactive'].filter(Boolean).join(' & ') || 'Frozen'}`
    : CAP_SHEET_TITLE[capSheet] ?? '';

  const CAP_SHEET_CONTENT: Record<string, React.ReactNode> = {
    supply: (
      <CapProgressContent
        currentSize={displayReserveSizeUsd ?? 0}
        cap={nativeToUsd(reserve.supplyCap, reserve.decimals, reserve.tokenPrice) ?? 0}
        displayMode={inputMode}
        tokenPrice={displayTokenPrice}
        tokenSymbol={reserve.tokenSymbol}
      />
    ),
    borrow: (
      <BorrowCapProgressContent
        borrowed={totalBorrowedUsd ?? 0}
        cap={nativeToUsd(reserve.borrowCap, reserve.decimals, reserve.tokenPrice) ?? 0}
        availableLiquidityUsd={availableLiquidityUsd ?? 0}
        displayMode={inputMode}
        tokenPrice={displayTokenPrice}
        tokenSymbol={reserve.tokenSymbol}
        disabled={isBorrowDisabled(reserve)}
      />
    ),
    utilization: optimalPct != null && displayUtilization != null ? (
      <UtilizationContent current={displayUtilization} optimal={optimalPct} />
    ) : null,
    deficit: hasDeficit ? (
      <DeficitProgressContent
        deficitUsd={deficitUsd!}
        totalSuppliedUsd={displayReserveSizeUsd}
        tokenDeficitLabel={deficitTokenLabel}
        displayMode={inputMode}
        tokenPrice={displayTokenPrice}
        tokenSymbol={reserve.tokenSymbol}
        poolExplorerUrl={buildPoolExplorerUrl(reserve.marketName)}
      />
    ) : null,
    frozen: (
      <FrozenStatusContent reserve={reserve} />
    ),
  };

  return (
    <>
      <motion.div
        className="fixed inset-0 z-30 bg-background/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
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
        <div className="sticky top-0 bg-card border-b border-border px-[var(--ds-space-2)] py-[var(--ds-space-1-5)] flex items-center justify-between z-10">
          <h3 id="cap-sheet-title" className="ds-tooltip-title text-foreground">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-[var(--ds-space-1-5)] rounded-full active:bg-muted transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
        <div className="px-[var(--ds-space-3)] pt-[var(--ds-space-2)] pb-[var(--ds-space-2)]">
          {CAP_SHEET_CONTENT[capSheet]}
        </div>
      </motion.div>
    </>
  );
}

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
  onSelectHub?: (hubId: string) => void;
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
  spread: number | null;
  onShowSupplyCap: () => void;
  onShowBorrowCap: () => void;
}

function MobileReserveAmountRow({
  activeTab,
  reserve,
  inputMode,
  displayTokenPrice,
  displayReserveSizeUsd,
  totalBorrowedUsd,
  availableLiquidityUsd,
  spread,
  onShowSupplyCap,
  onShowBorrowCap,
}: MobileReserveAmountRowProps) {
  const tp = reserve.tokenPrice;
  const priceEl =
    tp != null && Number.isFinite(tp) ? (
      <span className="ds-text-11 text-muted-foreground/60 tabular-nums shrink-0 leading-none">
                {formatUsd(tp)}
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
          {hasSupplyCap ? (
            <button
              type="button"
              className="flex min-w-0 items-center gap-1 rounded-md py-0 pl-1 pr-0 ds-text-emerald-500 transition-all active:bg-muted/50 active:scale-[0.98] cursor-pointer"
              aria-label="Show supply cap details"
              onClick={onShowSupplyCap}
            >
              <span className="ds-text-13 font-medium tabular-nums leading-none overflow-hidden whitespace-nowrap">
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
            <span className="ds-text-13 font-medium tabular-nums leading-none ds-text-emerald-500 overflow-hidden whitespace-nowrap">
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
      <span className={`ds-text-11 tabular-nums shrink-0 leading-none ${spread !== null ? 'ds-text-purple-600' : 'text-muted-foreground/60'}`}>
        {formatSpread(spread)}
      </span>
      <div className="ml-auto flex min-w-0 items-center justify-end gap-1">
        {hasBorrowCap ? (
          <button
            type="button"
            className="flex min-w-0 items-center gap-1 rounded-md py-0 pl-1 pr-0 ds-text-brand-cyan transition-all active:bg-muted/50 active:scale-[0.98] cursor-pointer"
            aria-label="Show borrow cap details"
            onClick={onShowBorrowCap}
          >
            <span className="ds-text-13 font-medium tabular-nums leading-none overflow-hidden whitespace-nowrap">
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
              disabled={isBorrowDisabled(reserve)}
              displayMode={inputMode}
              tokenPrice={displayTokenPrice}
              tokenSymbol={reserve.tokenSymbol}
              ringSize={12}
              strokeWidth={1.2}
              disableTooltip
            />
          </button>
        ) : (
          <span className="ds-text-13 font-medium tabular-nums leading-none ds-text-brand-cyan overflow-hidden whitespace-nowrap">
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
    <span className="ds-text-11 font-medium leading-none text-muted-foreground/55">
      {`Base ${rateUnitLabel} only`}
    </span>
  );

  if (activeTab === 'supply') {
    const heroValue = displaySupplyTotal;
    const isDisabled = isSupplyDisabled(reserve);
    const heroColorClass = heroValue === null || isDisabled ? 'text-emerald-500/50' : 'ds-text-emerald-500';

    return (
      <div className="flex flex-col items-center gap-0.5">
        {isDisabled ? (
          <p className={`ds-text-22 font-bold tabular-nums ${heroColorClass} cursor-auto`}>
            {formatPercent(heroValue)}
          </p>
        ) : (
          <p className={`ds-text-22 font-bold tabular-nums ${heroColorClass}`}>
            {formatPercent(heroValue)}
          </p>
        )}
        <div className="flex min-h-[1rem] items-center justify-center">
          {visibleSupplyIncentive !== null ? (
            <div className="flex items-center gap-[var(--ds-space-1)] ds-text-11">
              <span className={isDisabled ? 'text-emerald-500/40' : 'ds-text-emerald-500-70 font-medium'}>
                {formatPercent(displaySupplyNative)}
              </span>
              <span className="text-muted-foreground/70">+</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onIncentiveClick(e, reserve, 'supply', visibleSupplyIncentive);
                }}
                className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-px shrink-0 ring-1 active:scale-95 transition-all active:ring-2 ${
                  isDisabled
                    ? 'text-emerald-500/50 bg-emerald-500/10 ring-emerald-500/20 active:bg-emerald-500/20 active:ring-emerald-500/30'
                    : 'ds-text-emerald-500-70 ds-bg-emerald-500-10 active:bg-[rgb(var(--ds-emerald-500-rgb)/0.25)] ds-ring-emerald-500-15 active:ring-[rgb(var(--ds-emerald-500-rgb)/0.3)]'
                }`}
              >
                <span>{formatPercent(visibleSupplyIncentive)}</span>
                <IncentiveIcon width={8} height={8} />
              </button>
            </div>
          ) : isDisabled ? (
            <span className="ds-text-10 font-medium leading-none text-muted-foreground/55">
              Supply unavailable
            </span>
          ) : noIncentivePlaceholder}
        </div>
      </div>
    );
  }

  const heroValue = displayBorrowTotal;
  const isDisabled = isBorrowDisabled(reserve);
  const heroColorClass = heroValue === null || isDisabled ? 'text-cyan-500/50' : 'ds-text-brand-cyan';

  return (
    <div className="flex flex-col items-center gap-0.5">
      {isDisabled ? (
        <p className={`ds-text-22 font-bold tabular-nums ${heroColorClass} cursor-auto`}>
          {formatPercent(heroValue)}
        </p>
      ) : (
        <p className={`ds-text-22 font-bold tabular-nums ${heroColorClass}`}>
          {formatPercent(heroValue)}
        </p>
      )}
      <div className="flex min-h-[1rem] items-center justify-center">
        {visibleBorrowIncentive !== null ? (
          <div className="flex items-center gap-[var(--ds-space-1)] ds-text-11">
            <span className={isDisabled ? 'text-cyan-500/40' : 'ds-text-brand-cyan-70 font-medium'}>
              {formatPercent(displayBorrowNative)}
            </span>
            <span className="text-muted-foreground/70">-</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onIncentiveClick(e, reserve, 'borrow', visibleBorrowIncentive);
              }}
              className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-px shrink-0 ring-1 active:scale-95 transition-all active:ring-2 ${
                isDisabled
                    ? 'text-cyan-500/50 bg-cyan-500/10 ring-cyan-500/20 active:bg-cyan-500/20 active:ring-cyan-500/30'
                  : 'ds-text-brand-cyan-70 ds-bg-brand-cyan-10 active:bg-[rgb(var(--ds-brand-cyan-rgb)/0.25)] ds-ring-brand-cyan-15 active:ring-[rgb(var(--ds-brand-cyan-rgb)/0.3)]'
              }`}
            >
              <span>{formatPercent(visibleBorrowIncentive)}</span>
              <IncentiveIcon width={8} height={8} />
            </button>
          </div>
        ) : isDisabled ? (
          <span className="ds-text-10 font-medium leading-none text-muted-foreground/55">
            Borrow unavailable
          </span>
        ) : noIncentivePlaceholder}
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
  const supplyLocked = isSupplyDisabled(reserve);
  const borrowLocked = isBorrowDisabled(reserve);
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
    const usd = nativeToUsd(reserve.supplied, reserve.decimals, reserve.tokenPrice);
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
  const deficitDisplay: DeficitDisplay = computeDeficitDisplay(reserve, displayTokenPrice, displayReserveSizeUsd, inputMode);

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

  const optimalPct =
    reserve.optimalUtilization != null && Number(reserve.optimalUtilization) > 0
      ? Number(reserve.optimalUtilization)
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
        className={`bg-card py-3 transition-all duration-300 ${reserve.isPaused || reserve.isActive === false ? 'ds-bg-paused ' : reserve.isFrozen ? 'ds-bg-sky-500-8 ' : ''}${
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
            {reserve.isFrozen || reserve.isPaused || reserve.isActive === false ? (
              <div className="relative shrink-0">
                <TokenIcon
                  symbol={iconSymbol}
                  size={28}
                  loading="eager"
                  logoURI={logoURI}
                />
                <button
                  type="button"
                  data-testid="mobile-reserve-status-badge"
                  data-status={
                      reserve.isPaused
                        ? (reserve.isFrozen ? 'paused-frozen' : 'paused')
                        : (reserve.isActive === false ? 'inactive' : 'frozen')
                    }
                  onClick={() => setCapSheet('frozen')}
                  aria-label={[reserve.isPaused && 'paused', reserve.isActive === false && 'inactive', reserve.isFrozen && 'frozen'].filter(Boolean).join(' & ').replace(/^/, 'Show ') + ' details'}
                  className="absolute -top-2 -left-2 z-10 grid place-items-center h-7 rounded-full bg-transparent"
                  style={{ width: reserve.isFrozen && reserve.isPaused ? '2rem' : '1.75rem' }}
                >
                  {reserve.isFrozen && reserve.isPaused ? (
                    <span className="inline-flex items-center gap-[1px]">
                      <span className="inline-flex items-center justify-center w-3 h-3 rounded-full bg-sky-500 text-white">
                        <Snowflake className="w-[7px] h-[7px]" />
                      </span>
                      <span className="inline-flex items-center justify-center w-3 h-3 rounded-full bg-[rgb(var(--ds-paused-rgb))] text-white">
                        <PauseCircle className="w-[7px] h-[7px]" />
                      </span>
                    </span>
                  ) : reserve.isPaused ? (
                    <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-[rgb(var(--ds-paused-rgb))] text-white">
                      <PauseCircle className="w-2 h-2" />
                    </span>
                  ) : reserve.isActive === false ? (
                    <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-[rgb(var(--ds-paused-rgb))] text-white">
                      <Ban className="w-2 h-2" />
                    </span>
                  ) : (
                    <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-sky-500 text-white">
                      <Snowflake className="w-2 h-2" />
                    </span>
                  )}
                </button>
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
                {displayUtilization != null && optimalPct != null && (
                  <button
                    type="button"
                    onClick={() => setCapSheet('utilization')}
                    className="inline-flex shrink-0 items-center gap-0.5 rounded-md px-1 py-0.5 transition-all active:bg-muted/50 active:scale-[0.97] -translate-y-px"
                    aria-label="Show utilization details"
                  >
                    <span className={`ds-text-11 font-medium tabular-nums leading-none ${
                      optimalPct != null && displayUtilization > optimalPct
                        ? 'text-amber-600'
                        : 'text-foreground'
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

              <div className="mt-0 flex min-w-0 items-center gap-1 ds-text-11 text-muted-foreground/80">
                {chainIconSrc && (
                  <img src={chainIconSrc} alt={reserve.chainName} className="w-3 h-3 shrink-0 opacity-80" />
                )}
                <span className="min-w-0 flex-1 truncate">{getReserveMarketDisplayName(reserve)}</span>
                {reserve.hubName && reserve.hubId && (() => {
                  const aaveProHubUrl = buildAaveProHubUrl(reserve);
                  const isV4 = protocolVersion === 'v4';
                  const hubClass = cn(
                    "inline-flex items-center rounded-full ds-text-9 font-normal leading-none",
                    isV4
                      ? "text-[rgb(var(--ds-brand-magenta-rgb))] bg-[rgb(var(--ds-brand-magenta-rgb))]/10"
                      : "text-muted-foreground/70 bg-muted/40"
                  );

                  return (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectHub?.(reserve.hubId!);
                      }}
                      className={cn("inline-flex max-w-full shrink-0 items-center px-1.5 py-0.5 cursor-pointer transition-all duration-150 active:opacity-80 active:scale-[0.98]", hubClass)}
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

        {/* Pill tabs */}
        <div className="mx-3 mb-1 flex gap-[var(--ds-space-1)] rounded-lg bg-muted/40 p-0.5">
          <button
            type="button"
            onClick={() => setActiveTab('supply')}
            className={`flex-1 ds-text-12 font-medium py-1 rounded-md transition-all duration-200 ${
              activeTab === 'supply'
                ? 'ds-bg-emerald-500-10 ds-text-emerald-500 shadow-sm ring-1 ds-ring-emerald-500-15'
                : 'text-muted-foreground active:text-foreground/70'
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
                : 'text-muted-foreground active:text-foreground/70'
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
            onShowSupplyCap={() => setCapSheet('supply')}
            onShowBorrowCap={() => setCapSheet('borrow')}
            spread={displaySpread}
          />
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
              className="relative mt-0.5"
            >
              {activeTab === 'supply' && deficitDisplay.hasDeficit && (
                <div
                  className="absolute -top-1.5 right-4 z-10 cursor-pointer"
                  role="button"
                  tabIndex={0}
                  onClick={() => setCapSheet('deficit')}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCapSheet('deficit'); } }}
                  aria-label={`Deficit details for ${reserve.tokenSymbol}`}
                >
                  <DeficitLiquidityRing
                    deficitUsd={deficitDisplay.deficitUsd!}
                    totalSuppliedUsd={displayReserveSizeUsd}
                    displayMode={inputMode}
                    ringSize={11}
                    strokeWidth={1.5}
                    label={<DeficitShieldIcon ratio={deficitDisplay.deficitShareRatio} className={cn('h-2.5 w-2.5', deficitDisplay.isNeutralDeficit && 'opacity-70')} />}
                    disableTooltip
                  />
                </div>
              )}
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

          {/* Simulation toggle — horizontal single-line: label on left, expand icon on right */}
          <div className="mt-1.5 px-3">
            <button
              type="button"
              onClick={onToggleSimulation}
              aria-expanded={isSimulationExpanded}
              aria-label={isSimulationExpanded ? 'Collapse details panel' : 'Expand details panel'}
              className={`flex w-full items-center justify-between rounded-lg px-2 py-1 ds-text-12 text-muted-foreground transition-all duration-200 active:scale-[0.995] ${
                isSimulationExpanded
                  ? 'border border-foreground/25 bg-muted/60 shadow-sm dark:border-foreground/20 dark:bg-muted/40'
                  : 'border border-border/60 bg-background active:bg-muted/40 active:border-border/80 dark:bg-card/50 dark:active:bg-muted/30'
              }`}
            >
              {/* Liquidity text on left */}
              <span className="flex items-center gap-1">
                <span className="ds-text-10 text-muted-foreground/70">Liquidity</span>
                <span className={`ds-text-10 font-medium tabular-nums ${availableLiquidityUsd !== null && availableLiquidityUsd !== undefined ? (availableLiquidityUsd < 10000 ? 'text-amber-600' : 'text-purple-500') : 'text-muted-foreground/70'}`}>
                  {formatScenarioSize(availableLiquidityUsd ?? null, { inputMode, tokenPrice: displayTokenPrice, tokenSymbol: reserve.tokenSymbol })}
                </span>
              </span>
              <ListCollapse className={`h-3.5 w-3.5 shrink-0 transition-transform duration-300 ease-in-out ${isSimulationExpanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {/* Mobile bottom sheet for cap / utilization details */}
        <AnimatePresence>
          {capSheet !== null && (
            <MobileCapSheet
              capSheet={capSheet}
              onClose={() => setCapSheet(null)}
              reserve={reserve}
              displayReserveSizeUsd={displayReserveSizeUsd}
              displayUtilization={displayUtilization}
              optimalPct={optimalPct}
              hasDeficit={deficitDisplay.hasDeficit}
              deficitUsd={deficitDisplay.deficitUsd}
              deficitTokenLabel={deficitDisplay.deficitTokenLabel}
              inputMode={inputMode}
              displayTokenPrice={displayTokenPrice}
              totalBorrowedUsd={totalBorrowedUsd}
              availableLiquidityUsd={availableLiquidityUsd}
            />
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
