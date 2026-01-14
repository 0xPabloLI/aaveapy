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

  return (
    <div 
      className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm active:bg-gray-50 transition-colors cursor-pointer"
      onClick={handleCardClick}
    >
      {/* Header: Token + Market */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-600">
            {pool.tokenSymbol[0]}
          </div>
          <div>
            <p className="font-bold text-gray-900">{pool.tokenSymbol}</p>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              {chainIconSrc && (
                <img src={chainIconSrc} alt={pool.chainName} className="w-3.5 h-3.5" />
              )}
              <span>{getMarketDisplayName()}</span>
            </div>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-400" />
      </div>

      {/* APY Values */}
      <div className="grid grid-cols-3 gap-3">
        {/* Supply */}
        <div className="space-y-0.5">
          <p className="text-[10px] text-gray-500 uppercase font-medium">Supply</p>
          <p className="text-base font-bold text-emerald-500">
            {formatPercent(displaySupplyTotal)}
          </p>
          {displaySupplyIncentive !== null && (
            <div className="flex items-center gap-1 text-[10px]">
              <span className="text-blue-600">{formatPercent(isApy ? (pool.supplyApy ?? null) : (pool.supplyApy !== null && pool.supplyApy !== undefined ? apyToApr(pool.supplyApy) : null))}</span>
              <span className="text-gray-400">+</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onIncentiveClick(e, pool, 'supply', displaySupplyIncentive);
                }}
                className="inline-flex items-center gap-0.5 text-amber-600"
              >
                <IncentiveIcon width={8} height={8} />
                <span>{formatPercent(displaySupplyIncentive)}</span>
              </button>
            </div>
          )}
        </div>

        {/* Borrow */}
        <div className="space-y-0.5">
          <p className="text-[10px] text-gray-500 uppercase font-medium">Borrow</p>
          <p className="text-base font-bold text-gray-900">
            {displayBorrowTotal !== null ? formatPercent(displayBorrowTotal) : '-'}
          </p>
          {displayBorrowIncentive !== null && (
            <div className="flex items-center gap-1 text-[10px]">
              <span className="text-blue-600">{formatPercent(isApy ? (pool.borrowApy ?? null) : (pool.borrowApy !== null && pool.borrowApy !== undefined ? apyToApr(pool.borrowApy) : null))}</span>
              <span className="text-gray-400">-</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onIncentiveClick(e, pool, 'borrow', displayBorrowIncentive);
                }}
                className="inline-flex items-center gap-0.5 text-amber-600"
              >
                <IncentiveIcon width={8} height={8} />
                <span>{formatPercent(displayBorrowIncentive)}</span>
              </button>
            </div>
          )}
        </div>

        {/* Spread */}
        <div className="space-y-0.5">
          <p className="text-[10px] text-gray-500 uppercase font-medium">Spread</p>
          <p className={`text-base font-bold ${
            spread !== null && spread >= 0 ? 'text-amber-500' : 'text-rose-500'
          }`}>
            {formatSpread(spread)}
          </p>
        </div>
      </div>
    </div>
  );
};

export default MobilePoolCard;
