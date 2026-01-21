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
import { TokenIcon } from '@/components/primitives/TokenIcon';
import { fetchIconSymbolAndName } from '@/ui-config/reservePatches';

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
  const { iconSymbol, logoURI } = fetchIconSymbolAndName({
    underlyingAsset: pool.tokenAddress,
    symbol: pool.tokenSymbol,
    name: pool.tokenName,
  });

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
      className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm active:bg-gray-50 transition-colors cursor-pointer"
      onClick={handleCardClick}
    >
      {/* Header: Token + Market - Compact layout */}
      <div className="flex items-center gap-2 mb-2">
        <TokenIcon
          symbol={iconSymbol}
          size={32}
          loading="eager"
          className="shrink-0"
          logoURI={logoURI}
        />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-gray-900 text-sm truncate">{pool.tokenSymbol}</p>
          <div className="flex items-center gap-1 text-[10px] text-gray-500">
            {chainIconSrc && (
              <img src={chainIconSrc} alt={pool.chainName} className="w-3 h-3" />
            )}
            <span className="truncate">{getMarketDisplayName()}</span>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
      </div>

      {/* APY Values - 3 column layout: Supply | Spread | Borrow */}
      <div className="grid grid-cols-3 gap-2">
        {/* Supply */}
        <div className="space-y-0.5">
          <p className="text-[9px] text-gray-500 uppercase font-medium">Supply</p>
          <p className={`text-sm font-bold ${getSupplyColorClass(displaySupplyTotal)}`}>
            {formatPercent(displaySupplyTotal)}
          </p>
          {displaySupplyIncentive !== null && (
            <div className="flex items-center gap-0.5 text-[9px] flex-nowrap">
              <span className="text-blue-600">{formatPercent(isApy ? (pool.supplyApy ?? null) : (pool.supplyApy !== null && pool.supplyApy !== undefined ? apyToApr(pool.supplyApy) : null))}</span>
              <span className="text-gray-400">+</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onIncentiveClick(e, pool, 'supply', displaySupplyIncentive);
                }}
                className="inline-flex items-center gap-0.5 text-amber-600 shrink-0"
              >
                <IncentiveIcon width={7} height={7} />
                <span>{formatPercent(displaySupplyIncentive)}</span>
              </button>
            </div>
          )}
        </div>

        {/* Spread - middle, less prominent */}
        <div className="space-y-0.5 text-center">
          <p className="text-[9px] text-gray-400 uppercase font-medium">Spread</p>
          <p className={`text-xs font-medium ${
            spread !== null && spread >= 0 ? 'text-amber-400' : 'text-gray-400'
          }`}>
            {formatSpread(spread)}
          </p>
        </div>

        {/* Borrow */}
        <div className="space-y-0.5 text-right">
          <p className="text-[9px] text-gray-500 uppercase font-medium">Borrow</p>
          <p className={`text-sm font-bold ${getSupplyColorClass(displayBorrowTotal)}`}>
            {formatPercent(displayBorrowTotal)}
          </p>
          {displayBorrowIncentive !== null && (
            <div className="flex items-center gap-0.5 text-[9px] flex-nowrap justify-end">
              <span className="text-blue-600">{formatPercent(isApy ? (pool.borrowApy ?? null) : (pool.borrowApy !== null && pool.borrowApy !== undefined ? apyToApr(pool.borrowApy) : null))}</span>
              <span className="text-gray-400">-</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onIncentiveClick(e, pool, 'borrow', displayBorrowIncentive);
                }}
                className="inline-flex items-center gap-0.5 text-amber-600 shrink-0"
              >
                <IncentiveIcon width={7} height={7} />
                <span>{formatPercent(displayBorrowIncentive)}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MobilePoolCard;
