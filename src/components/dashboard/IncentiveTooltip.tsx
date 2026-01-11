import { X } from 'lucide-react';
import { MarketWithSpread } from '@/types/aave';
import { formatPercent } from '@/lib/formatters';

interface IncentiveTooltipProps {
  market: MarketWithSpread;
  type: 'supply' | 'borrow';
  position: { x: number; y: number };
  onClose: () => void;
}

const IncentiveIcon = ({ className = "" }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    className={className}
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const IncentiveTooltip = ({ market, type, position, onClose }: IncentiveTooltipProps) => {
  const incentiveApy = type === 'supply' 
    ? market.totalIncentiveSupplyApy 
    : market.totalIncentiveBorrowApy;

  const meritApr = type === 'supply' ? market.meritSupplyApr : market.meritBorrowApr;
  const merklApr = type === 'supply' ? market.merklSupplyApr : market.merklBorrowApr;
  const brevisApr = type === 'supply' ? market.brevisSupplyApr : market.brevisBorrowApr;

  return (
    <>
      {/* Background overlay */}
      <div 
        className="fixed inset-0 z-30" 
        onClick={onClose}
      />
      {/* Tooltip content */}
      <div
        className="fixed z-40 bg-popover border border-border rounded-lg shadow-xl p-4 max-w-xs"
        style={{ 
          left: `${Math.min(position.x, window.innerWidth - 280)}px`, 
          top: `${Math.min(position.y + 10, window.innerHeight - 200)}px` 
        }}
      >
        <div className="flex items-start gap-3">
          <div className="p-2 bg-amber-500/10 rounded-lg flex-shrink-0">
            <IncentiveIcon className="w-5 h-5 text-amber-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <h4 className="font-bold text-foreground text-sm">
                {type === 'supply' ? 'Supply' : 'Borrow'} Incentives
              </h4>
              <button
                onClick={onClose}
                className="p-1 hover:bg-accent rounded transition-colors"
              >
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              {market.tokenSymbol} on {market.chainName}
            </p>
            
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Total Incentive:</span>
                <span className="font-bold text-amber-500">{formatPercent(incentiveApy)}</span>
              </div>
              
              {meritApr && meritApr.length > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Merit Rewards:</span>
                  <span className="font-medium text-foreground">{meritApr.join(', ')}</span>
                </div>
              )}
              
              {merklApr !== undefined && merklApr > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Merkl Rewards:</span>
                  <span className="font-medium text-foreground">{formatPercent(merklApr)}</span>
                </div>
              )}
              
              {brevisApr !== undefined && brevisApr !== null && brevisApr > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Brevis Rewards:</span>
                  <span className="font-medium text-foreground">{formatPercent(brevisApr)}</span>
                </div>
              )}
            </div>
            
            <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border/50">
              Incentive APY is temporary and subject to change.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default IncentiveTooltip;
