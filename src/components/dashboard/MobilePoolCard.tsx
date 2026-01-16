import { ChevronRight } from 'lucide-react';
import { PoolWithSpread, ETHEREUM_MARKET_NAMES } from '@/types/aave';
import { 
  formatPercent, 
  formatSpread, 
  calculateTotalSupplyApr,
  calculateTotalSupplyApy,
  calculateTotalBorrowApr,
  calculateTotalBorrowApy,
  calculateSpreadApy,
  calculateSpreadApr,
  calculateTotalIncentiveApr,
  calculateTotalIncentiveApy,
  apyToApr
} from '@/lib/formatters';
import { getChainIconSrc } from '@/lib/chainIcons';
import { IncentiveIcon } from '@/components/IncentiveIcon';
import { buildAaveReserveUrl } from '@/lib/aaveLinks';

interface MobilePoolCardProps {
  pool: PoolWithSpread;
  isApy: boolean;
  onIncentiveClick: (
    e: React.MouseEvent,
    pool: PoolWithSpread,
    type: 'supply' | 'borrow',
    apy: number | null
  ) => void;
}

const MobilePoolCard = ({ pool, isApy, onIncentiveClick }: MobilePoolCardProps) => {
  // Helper: Get incentive values for a pool (supply or borrow)
  const getIncentiveValues = (type: 'supply' | 'borrow') => {
    const protocolIncentives = type === 'supply' ? pool.supplyIncentives : pool.borrowIncentives;
    const meritIncentives = type === 'supply' ? pool.meritSupplys : pool.meritBorrows;
    const merklOpportunities = type === 'supply' ? pool.merklSupplys : pool.merklBorrows;
    const brevisApr = type === 'supply' ? pool.brevisSupplyApr : pool.brevisBorrowApr;
    return {
      apr: calculateTotalIncentiveApr(meritIncentives, merklOpportunities, brevisApr, protocolIncentives),
      apy: calculateTotalIncentiveApy(meritIncentives, merklOpportunities, brevisApr, protocolIncentives),
    };
  };

  const getMarketDisplayName = () => {
    if (pool.chainName === 'Ethereum' && ETHEREUM_MARKET_NAMES[pool.marketName]) {
      return ETHEREUM_MARKET_NAMES[pool.marketName];
    }
    return pool.chainName;
  };

  // Cache incentive values to avoid redundant calculations
  const supplyIncentiveValues = getIncentiveValues('supply');
  const borrowIncentiveValues = getIncentiveValues('borrow');
  
  const totalSupplyApy = calculateTotalSupplyApy(pool.supplyApy, supplyIncentiveValues.apy);
  const totalSupplyApr = calculateTotalSupplyApr(pool.supplyApy, supplyIncentiveValues.apr);
  const totalBorrowApy = calculateTotalBorrowApy(pool.borrowApy, borrowIncentiveValues.apy);
  const totalBorrowApr = calculateTotalBorrowApr(pool.borrowApy, borrowIncentiveValues.apr);
  
  const displaySupplyTotal = isApy ? totalSupplyApy : totalSupplyApr;
  const displayBorrowTotal = isApy ? totalBorrowApy : totalBorrowApr;
  
  // Get display incentive values using cached results
  const displaySupplyIncentive = (() => {
    const incentive = isApy ? supplyIncentiveValues.apy : supplyIncentiveValues.apr;
    return incentive === 0 || isNaN(incentive) || incentive < 0.01 ? null : incentive;
  })();
  const displayBorrowIncentive = (() => {
    const incentive = isApy ? borrowIncentiveValues.apy : borrowIncentiveValues.apr;
    return incentive === 0 || isNaN(incentive) || incentive < 0.01 ? null : incentive;
  })();

  const spread = isApy
    ? calculateSpreadApy(totalSupplyApy, totalBorrowApy)
    : calculateSpreadApr(totalSupplyApr, totalBorrowApr);

  const chainIconSrc = getChainIconSrc(pool.chainName);

  const handleCardClick = () => {
    const url = buildAaveReserveUrl({
      marketName: pool.marketName,
      tokenAddress: pool.tokenAddress,
    });
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  // Dynamic color based on APY value
  const getSupplyColorClass = (value: number | null) => {
    if (value === null) return 'text-gray-400';
    if (value >= 10) return 'text-emerald-600';
    if (value >= 5) return 'text-emerald-500';
    if (value >= 2) return 'text-emerald-400';
    if (value >= 1) return 'text-teal-500';
    return 'text-gray-500';
  };

  return (
    <div 
      className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm active:bg-gray-50 transition-colors cursor-pointer h-full flex flex-col"
      onClick={handleCardClick}
    >
      {/* Header: Token + Market - Fixed height */}
      <div className="flex items-center gap-2 mb-2 h-10">
        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0">
          {pool.tokenSymbol[0]}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-gray-900 text-sm truncate leading-tight">{pool.tokenSymbol}</p>
          <div className="flex items-center gap-1 text-[10px] text-gray-500 leading-tight">
            {chainIconSrc && (
              <img src={chainIconSrc} alt={pool.chainName} className="w-3 h-3 shrink-0" />
            )}
            <span className="truncate">{getMarketDisplayName()}</span>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
      </div>

      {/* APY Values - 3 column grid with fixed structure */}
      <div className="grid grid-cols-3 gap-1 flex-1">
        {/* Supply Column */}
        <div className="flex flex-col min-h-[48px]">
          <p className="text-[9px] text-gray-500 uppercase font-medium mb-0.5">Supply</p>
          <p className={`text-sm font-bold leading-tight ${getSupplyColorClass(displaySupplyTotal)}`}>
            {formatPercent(displaySupplyTotal)}
          </p>
          <div className="mt-auto min-h-[14px]">
            {displaySupplyIncentive !== null && (
              <div className="flex items-center gap-0.5 text-[9px] flex-nowrap">
                <span className="text-blue-600 tabular-nums">{formatPercent(isApy ? (pool.supplyApy ?? null) : (pool.supplyApy !== null && pool.supplyApy !== undefined ? apyToApr(pool.supplyApy) : null))}</span>
                <span className="text-gray-400">+</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onIncentiveClick(e, pool, 'supply', displaySupplyIncentive);
                  }}
                  className="inline-flex items-center gap-0.5 text-amber-600 shrink-0"
                >
                  <IncentiveIcon width={7} height={7} />
                  <span className="tabular-nums">{formatPercent(displaySupplyIncentive)}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Spread Column - Centered */}
        <div className="flex flex-col items-center min-h-[48px]">
          <p className="text-[9px] text-gray-400 uppercase font-medium mb-0.5">Spread</p>
          <p className={`text-xs font-medium leading-tight ${
            spread !== null && spread >= 0 ? 'text-amber-500' : 'text-gray-400'
          }`}>
            {formatSpread(spread)}
          </p>
        </div>

        {/* Borrow Column */}
        <div className="flex flex-col items-end min-h-[48px]">
          <p className="text-[9px] text-gray-500 uppercase font-medium mb-0.5">Borrow</p>
          <p className={`text-sm font-bold leading-tight ${getSupplyColorClass(displayBorrowTotal)}`}>
            {formatPercent(displayBorrowTotal)}
          </p>
          <div className="mt-auto min-h-[14px]">
            {displayBorrowIncentive !== null && (
              <div className="flex items-center gap-0.5 text-[9px] flex-nowrap justify-end">
                <span className="text-blue-600 tabular-nums">{formatPercent(isApy ? (pool.borrowApy ?? null) : (pool.borrowApy !== null && pool.borrowApy !== undefined ? apyToApr(pool.borrowApy) : null))}</span>
                <span className="text-gray-400">+</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onIncentiveClick(e, pool, 'borrow', displayBorrowIncentive);
                  }}
                  className="inline-flex items-center gap-0.5 text-amber-600 shrink-0"
                >
                  <IncentiveIcon width={7} height={7} />
                  <span className="tabular-nums">{formatPercent(displayBorrowIncentive)}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobilePoolCard;
