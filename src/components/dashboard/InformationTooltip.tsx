import { useState, useRef, useEffect } from 'react';
import { Info } from 'lucide-react';

const InformationTooltip = () => {
  const [isVisible, setIsVisible] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Handle mouse enter/leave for both trigger and tooltip
  const handleMouseEnter = () => setIsVisible(true);
  const handleMouseLeave = () => setIsVisible(false);

  // Handle keyboard focus
  const handleFocus = () => setIsVisible(true);
  const handleBlur = (e: React.FocusEvent) => {
    // Don't hide if focus is moving to tooltip
    if (tooltipRef.current?.contains(e.relatedTarget as Node)) {
      return;
    }
    setIsVisible(false);
  };

  // Make tooltip focusable for keyboard navigation
  const handleTooltipFocus = () => setIsVisible(true);
  const handleTooltipBlur = (e: React.FocusEvent) => {
    // Don't hide if focus is moving back to trigger
    if (triggerRef.current?.contains(e.relatedTarget as Node)) {
      return;
    }
    setIsVisible(false);
  };

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isVisible) {
        setIsVisible(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isVisible]);

  return (
    <div className="relative inline-flex">
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        aria-label="Information about APR and APY"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className="w-[14px] h-[14px] rounded-full bg-gradient-to-br from-purple-400/20 to-pink-400/20 
          hover:from-purple-500 hover:to-pink-500 
          flex items-center justify-center 
          transition-all duration-200 
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 focus-visible:ring-offset-1
          group"
      >
        <Info className="w-2 h-2 text-purple-600 group-hover:text-white transition-colors duration-200" />
      </button>

      {/* Tooltip Container */}
      <div
        ref={tooltipRef}
        tabIndex={-1}
        className={`absolute right-0 top-[calc(100%+8px)] w-[320px] z-50
          bg-[#e7e5e4] border border-[#d3d1cf] rounded-2xl shadow-xl
          transition-opacity duration-300 ease-out
          pointer-events-none
          ${isVisible ? 'opacity-100 visible pointer-events-auto' : 'opacity-0 invisible'}
        `}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleTooltipFocus}
        onBlur={handleTooltipBlur}
        role="tooltip"
        aria-hidden={!isVisible}
      >
        {/* Header with gradient background */}
        <div className="bg-gradient-to-r from-[#c242b1] via-[#7eb8d4] to-[#23cdbf] px-3 py-3 rounded-t-2xl">
          <h3 className="text-white text-sm font-bold">APR vs APY</h3>
        </div>

        {/* Content */}
        <div className="bg-[#f8f8f7] px-4 py-4 rounded-b-2xl space-y-3.5">
          {/* APR Section */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2 py-0.5 rounded-full border border-[#d3d1cf] text-xs font-bold text-[#1c1917] bg-white">
                APR
              </span>
              <span className="text-xs font-semibold text-[#1c1917]">Simple Annual Rate</span>
            </div>
            <p className="text-xs text-[#766f6b] leading-relaxed">
              The simple annual percentage rate without compounding. This is the base rate you earn or pay.
            </p>
          </div>

          {/* Divider */}
          <div className="border-t border-[#d3d1cf]" />

          {/* APY Section */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2 py-0.5 rounded-full border border-[#d3d1cf] text-xs font-bold text-[#1c1917] bg-white">
                APY
              </span>
              <span className="text-xs font-semibold text-[#1c1917]">Annual Percentage Yield</span>
            </div>
            <p className="text-xs text-[#766f6b] leading-relaxed">
              Assumes you claim and reinvest rewards monthly, including the effect of compounding. This shows your potential return if you actively manage rewards.
            </p>
          </div>

          {/* Formula Section */}
          <div className="mt-3.5">
            <h4 className="ds-text-12 font-semibold text-foreground mb-2">Conversion Formula</h4>
            <div className="bg-muted/50 rounded-lg border border-border px-3 py-2">
              <code className="ds-text-12 font-mono font-medium text-foreground whitespace-nowrap">
                APY = (1 + APR/12)<sup>12</sup> − 1
              </code>
            </div>
            <p className="ds-text-11 text-muted-foreground mt-2">
              We use monthly compounding to convert APR to APY. This formula assumes you reinvest rewards every month.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InformationTooltip;
