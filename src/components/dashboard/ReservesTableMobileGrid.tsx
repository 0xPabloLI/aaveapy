import type { ScenarioInputMode, RateSimulationResult } from '@/hooks/useRateSimulation';
import type { ReserveWithSpread } from '@/types/aave';
import { Skeleton } from '@/components/ui/skeleton';
import MobileReserveCard from './MobileReserveCard';
import MobileExpandedReserveShell from './MobileExpandedReserveShell';

interface ReservesTableMobileGridProps {
  displayData: ReserveWithSpread[];
  expandedReserveId: string | null;
  isLoading?: boolean;
  reservesCount: number;
  isApy: boolean;
  tydroPointToUsdRate: number;
  hasSharedScenario: boolean;
  inputMode: ScenarioInputMode;
  supplyInput: string;
  borrowInput: string;
  mobileCardDefaultTab: 'supply' | 'borrow';
  simulationsById: Record<string, RateSimulationResult>;
  onIncentiveClick: (
    e: React.MouseEvent,
    reserve: ReserveWithSpread,
    type: 'supply' | 'borrow',
    apy: number | null
  ) => void;
  onToggleExpand: (reserveId: string) => void;
  onCorrectSupplyInput?: (correctedValue: string) => void;
  onCorrectBorrowInput?: (correctedValue: string) => void;
  isPortfolioMode?: boolean;
  portfolioReserveIds?: Set<string>;
  onPortfolioToggle?: (reserveId: string, reserve: ReserveWithSpread) => void;
  onAddToPortfolio?: (reserve: ReserveWithSpread, side: 'supply' | 'borrow') => void;
}

function MobileReservesSkeletonGrid() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-card rounded-xl border border-border/60 ds-card-pad-sm">
          <div className="flex items-center gap-[var(--ds-space-2)] mb-[var(--ds-space-3)]">
            <Skeleton variant="gradient" className="w-8 h-8 rounded-full border-transparent shrink-0" />
            <div className="space-y-1 flex-1 min-w-0">
              <Skeleton variant="gradient" className="h-4 w-14 rounded-md" />
              <Skeleton variant="subtle" className="h-3 w-20 rounded-md" />
            </div>
            <Skeleton variant="subtle" className="w-7 h-7 rounded-full border-border/60 shrink-0" />
          </div>
          <div className="grid grid-cols-3 gap-[var(--ds-space-2)]">
            <div className="space-y-1">
              <Skeleton variant="subtle" className="h-2 w-10 rounded-md" />
              <Skeleton variant="gradient" className="h-5 w-14 rounded-md" />
              <Skeleton variant="subtle" className="h-3 w-16 rounded-full border-transparent" />
            </div>
            <div className="space-y-1 items-center flex flex-col">
              <Skeleton variant="subtle" className="h-2 w-10 rounded-md" />
              <Skeleton variant="subtle" className="h-4 w-14 rounded-md" />
            </div>
            <div className="space-y-1 flex flex-col items-end">
              <Skeleton variant="subtle" className="h-2 w-10 rounded-md" />
              <Skeleton variant="gradient" className="h-5 w-14 rounded-md" />
              <Skeleton variant="subtle" className="h-3 w-16 rounded-full border-transparent" />
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

export default function ReservesTableMobileGrid({
  displayData,
  expandedReserveId,
  isLoading,
  reservesCount,
  isApy,
  tydroPointToUsdRate,
  hasSharedScenario,
  inputMode,
  supplyInput,
  borrowInput,
  mobileCardDefaultTab,
  simulationsById,
  onIncentiveClick,
  onToggleExpand,
  onCorrectSupplyInput,
  onCorrectBorrowInput,
  isPortfolioMode,
  portfolioReserveIds,
  onPortfolioToggle,
  onAddToPortfolio,
}: ReservesTableMobileGridProps) {
  if (isLoading && reservesCount === 0) {
    return <MobileReservesSkeletonGrid />;
  }

  const nodes: React.ReactNode[] = [];

  for (let i = 0; i < displayData.length; i += 2) {
    const leftReserve = displayData[i];
    const leftId = `${leftReserve.marketName}-${leftReserve.tokenAddress}`;
    const rightReserve = i + 1 < displayData.length ? displayData[i + 1] : null;
    const rightId = rightReserve ? `${rightReserve.marketName}-${rightReserve.tokenAddress}` : null;

    const leftExpanded = leftId === expandedReserveId;
    const rightExpanded = rightId !== null && rightId === expandedReserveId;
    const rowHasExpanded = leftExpanded || rightExpanded;

    const isLeftActive = leftExpanded;
    const isRightActive = rightExpanded;
    const activeReserve = isLeftActive ? leftReserve : rightReserve;
    const activeId = isLeftActive ? leftId : rightId;

    const portfolioProps = (id: string, reserve: ReserveWithSpread) => ({
      isPortfolioMode: isPortfolioMode ?? false,
      isInPortfolio: portfolioReserveIds?.has(id) ?? false,
      onPortfolioToggle,
      onAddToPortfolio,
    });

    const leftCard = (
      <MobileReserveCard
        variant={isLeftActive ? 'upperOnly' : 'full'}
        connectedBelow={leftExpanded}
        reserve={leftReserve}
        isApy={isApy}
        tydroPointToUsdRate={tydroPointToUsdRate}
        onIncentiveClick={onIncentiveClick}
        isSimulationExpanded={isLeftActive}
        onToggleSimulation={() => onToggleExpand(leftId)}
        simulation={simulationsById[leftId]}
        supplyInput={supplyInput}
        borrowInput={borrowInput}
        hasSharedScenario={hasSharedScenario}
        inputMode={inputMode}
        onCorrectSupplyInput={onCorrectSupplyInput}
        onCorrectBorrowInput={onCorrectBorrowInput}
        defaultTab={mobileCardDefaultTab}
        {...portfolioProps(leftId, leftReserve)}
      />
    );

    const rightCard = rightReserve ? (
      <MobileReserveCard
        variant={isRightActive ? 'upperOnly' : 'full'}
        connectedBelow={rightExpanded}
        reserve={rightReserve}
        isApy={isApy}
        tydroPointToUsdRate={tydroPointToUsdRate}
        onIncentiveClick={onIncentiveClick}
        isSimulationExpanded={isRightActive}
        onToggleSimulation={() => onToggleExpand(rightId!)}
        simulation={simulationsById[rightId!]}
        supplyInput={supplyInput}
        borrowInput={borrowInput}
        hasSharedScenario={hasSharedScenario}
        inputMode={inputMode}
        onCorrectSupplyInput={onCorrectSupplyInput}
        onCorrectBorrowInput={onCorrectBorrowInput}
        defaultTab={mobileCardDefaultTab}
        {...portfolioProps(rightId!, rightReserve)}
      />
    ) : null;

    nodes.push(
      <div
        key={`row-${i}`}
        className="col-span-2"
        data-reserve-expanded-anchor={activeId ?? undefined}
      >
        {rowHasExpanded && activeReserve && activeId ? (
          <MobileExpandedReserveShell
            side={leftExpanded ? 'left' : 'right'}
            upper={leftExpanded ? leftCard : rightCard}
            sibling={leftExpanded ? rightCard : leftCard}
            panel={
              <MobileReserveCard
                variant="simulationOnly"
                reserve={activeReserve}
                isApy={isApy}
                tydroPointToUsdRate={tydroPointToUsdRate}
                onIncentiveClick={onIncentiveClick}
                isSimulationExpanded
                onToggleSimulation={() => onToggleExpand(activeId)}
                simulation={simulationsById[activeId]}
                supplyInput={supplyInput}
                borrowInput={borrowInput}
                hasSharedScenario={hasSharedScenario}
                inputMode={inputMode}
                onCorrectSupplyInput={onCorrectSupplyInput}
                onCorrectBorrowInput={onCorrectBorrowInput}
                defaultTab={mobileCardDefaultTab}
              />
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-[var(--ds-space-2)]">
            <div className="min-w-0">{leftCard}</div>
            {rightCard ? <div className="min-w-0">{rightCard}</div> : null}
          </div>
        )}
      </div>
    );
  }

  return <>{nodes}</>;
}
