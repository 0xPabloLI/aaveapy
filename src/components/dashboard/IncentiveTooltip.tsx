import { useRef, useEffect, useState } from 'react';
import { MarketWithSpread } from '@/types/aave';
import { formatPercent } from '@/lib/formatters';

interface IncentiveTooltipProps {
  market: MarketWithSpread;
  type: 'supply' | 'borrow';
  position: { x: number; y: number };
  triggerCenterX: number;
  onClose: () => void;
}

const IncentiveIcon = ({ className = "" }: { className?: string }) => (
  <svg 
    viewBox="0 0 16 16" 
    fill="none" 
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect width="16" height="16" rx="2" fill="#E8E7FF"/>
    <path
      d="M3 8C3 8 4.5 6 6 8C7.5 10 9 8 9 8"
      stroke="white"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M3 10C3 10 4.5 8 6 10C7.5 12 9 10 9 10"
      stroke="white"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const IncentiveTooltip = ({ market, type, position, triggerCenterX, onClose }: IncentiveTooltipProps) => {
  const incentiveApy = type === 'supply' 
    ? market.totalIncentiveSupplyApy 
    : market.totalIncentiveBorrowApy;

  const tooltipRef = useRef<HTMLDivElement>(null);
  const [arrowLeft, setArrowLeft] = useState(0);

  useEffect(() => {
    // Use requestAnimationFrame to ensure tooltip is fully rendered before calculating
    const updateArrowPosition = () => {
      if (tooltipRef.current) {
        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        const arrowWidth = 16;
        // Calculate arrow position: trigger center X - tooltip left - arrow width / 2
        const calculatedLeft = triggerCenterX - tooltipRect.left - arrowWidth / 2;
        // Clamp arrow position to stay within tooltip bounds (with some padding)
        const minLeft = 8;
        const maxLeft = tooltipRect.width - arrowWidth - 8;
        setArrowLeft(Math.max(minLeft, Math.min(maxLeft, calculatedLeft)));
      }
    };

    // Use requestAnimationFrame to wait for DOM update
    requestAnimationFrame(() => {
      requestAnimationFrame(updateArrowPosition);
    });
  }, [triggerCenterX, position]);

  return (
    <>
      {/* Background overlay */}
      <div 
        className="fixed inset-0 z-30" 
        onClick={onClose}
      />
      {/* Tooltip content with fade-in animation */}
      <div
        ref={tooltipRef}
        className="fixed z-40 bg-white border border-gray-200 rounded-xl shadow-xl p-4 max-w-[360px] animate-in fade-in-0 zoom-in-95 duration-200"
        style={{ 
          left: `${Math.min(position.x, window.innerWidth - 360)}px`, 
          top: `${position.y + 8}px` 
        }}
      >
        {/* Upward-pointing arrow - dynamically positioned, appears as border extension */}
        <div 
          className="absolute -top-2 w-4 h-4 bg-white border-l border-t border-gray-200 transform rotate-45"
          style={{ 
            left: `${arrowLeft}px`
          }}
        />
        <div className="flex items-start gap-3">
          {/* Icon area */}
          <div className="p-2 bg-amber-50 rounded-lg flex-shrink-0">
            <IncentiveIcon className="w-5 h-5" />
          </div>
          {/* Content area */}
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-gray-900 text-sm mb-1">
              Incentive APY
            </h4>
            <p className="text-xs text-gray-600 mb-2">
              {market.tokenSymbol} on {market.chainName}
            </p>
            
            {/* Data rows */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Rate:</span>
                <span className="font-bold text-amber-600">{formatPercent(incentiveApy)}</span>
              </div>
              
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Source:</span>
                <span className="font-medium text-gray-700">Protocol Rewards</span>
              </div>
              
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Duration:</span>
                <span className="font-medium text-gray-700">30 days</span>
              </div>
            </div>
            
            {/* Bottom disclaimer */}
            <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-100">
              Incentive APY is temporary and subject to change based on protocol emissions.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default IncentiveTooltip;
