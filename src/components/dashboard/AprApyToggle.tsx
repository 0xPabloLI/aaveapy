import { useState, useRef, useEffect } from 'react';
import { Info } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

interface AprApyToggleProps {
  isApy: boolean;
  setIsApy: (value: boolean) => void;
}

const TOOLTIP_WIDTH = 280;

function InfoIconButton({
  'aria-label': ariaLabel,
  isOpen,
  onOpen,
  onClose,
  children,
}: {
  'aria-label': string;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const handleBlur = (e: React.FocusEvent) => {
    if (tooltipRef.current?.contains(e.relatedTarget as Node)) return;
    onClose();
  };
  const handleTooltipBlur = (e: React.FocusEvent) => {
    if (triggerRef.current?.contains(e.relatedTarget as Node)) return;
    onClose();
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  return (
    <div className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        onMouseEnter={onOpen}
        onMouseLeave={onClose}
        onFocus={onOpen}
        onBlur={handleBlur}
        className="h-3.5 w-3.5 rounded-full bg-stone-200 text-stone-500
          hover:bg-gradient-to-r hover:from-purple-500 hover:to-pink-500 hover:text-white
          flex items-center justify-center
          transition-all duration-200
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 focus-visible:ring-offset-1"
      >
        <Info className="h-2 w-2 shrink-0" aria-hidden />
      </button>
      {children({
        tooltipRef,
        isOpen,
        onMouseEnter: onOpen,
        onMouseLeave: onClose,
        onTooltipFocus: onOpen,
        onTooltipBlur: handleTooltipBlur,
      })}
    </div>
  );
}

function TooltipShell({
  alignLeft,
  isOpen,
  tooltipRef,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  title,
  children,
}: {
  alignLeft: boolean;
  isOpen: boolean;
  tooltipRef: React.RefObject<HTMLDivElement | null>;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onFocus: () => void;
  onBlur: (e: React.FocusEvent) => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      ref={tooltipRef}
      tabIndex={-1}
      className={`absolute top-5 z-50 w-[280px]
        bg-[#f8f8f7] border border-[#d3d1cf] rounded-xl shadow-xl
        transition-[opacity,visibility] duration-300 ease-out
        ${isOpen ? 'opacity-100 visible pointer-events-auto' : 'opacity-0 invisible pointer-events-none'}
        ${alignLeft ? 'left-0' : 'right-0'}
      `}
      style={{ width: TOOLTIP_WIDTH }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocus={onFocus}
      onBlur={onBlur}
      role="tooltip"
      aria-hidden={!isOpen}
    >
      <div className="bg-gradient-to-r from-[#c242b1] via-[#7eb8d4] to-[#23cdbf] px-4 py-2.5 rounded-t-xl">
        <h3 className="text-white text-sm font-bold">{title}</h3>
      </div>
      <div className="px-4 py-3.5 rounded-b-xl space-y-3">{children}</div>
    </div>
  );
}

function AprTooltipContent() {
  return (
    <>
      <div className="bg-white rounded-lg border border-[#d3d1cf] px-3 py-2.5">
        <code className="text-xs font-mono font-semibold text-[#1c1917]">
          APR = Native APY + Incentive APR
        </code>
      </div>
      <ul className="space-y-2 text-xs text-[#766f6b]">
        <li className="flex gap-2 items-start">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" aria-hidden />
          <span>
            <strong className="font-semibold text-blue-600">Native APY:</strong>{' '}
            Auto-compounded by Aave smart contracts
          </span>
        </li>
        <li className="flex gap-2 items-start">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
          <span>
            <strong className="font-semibold text-amber-600">Incentive:</strong>{' '}
            Requires manual claiming & reinvesting
          </span>
        </li>
      </ul>
      <div className="border-t border-[#e7e5e4] pt-2">
        <p className="text-[11px] text-[#a8a29e]">
          Use APR if you don&apos;t plan to reinvest incentive rewards
        </p>
      </div>
    </>
  );
}

function ApyTooltipContent() {
  return (
    <>
      <div className="bg-white rounded-lg border border-[#d3d1cf] px-3 py-2.5">
        <code className="text-xs font-mono font-semibold text-[#1c1917]">
          APY = Native APY + Incentive APY
        </code>
      </div>
      <ul className="space-y-2 text-xs text-[#766f6b]">
        <li className="flex gap-2 items-start">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" aria-hidden />
          <span>
            <strong className="font-semibold text-blue-600">Native APY:</strong>{' '}
            Auto-compounded by Aave smart contracts
          </span>
        </li>
        <li className="flex gap-2 items-start">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
          <span>
            <strong className="font-semibold text-amber-600">Incentive:</strong>{' '}
            Assumes monthly reinvesting of rewards
          </span>
        </li>
      </ul>
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">
        <code className="text-[11px] font-mono font-semibold text-emerald-700">
          Incentive APY = (1 + APR/12)¹² − 1
        </code>
      </div>
      <div className="border-t border-[#e7e5e4] pt-2">
        <p className="text-[11px] text-[#a8a29e]">
          Use APY if you plan to reinvest incentives monthly
        </p>
      </div>
    </>
  );
}

export function AprApyToggle({ isApy, setIsApy }: AprApyToggleProps) {
  const [aprOpen, setAprOpen] = useState(false);
  const [apyOpen, setApyOpen] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <InfoIconButton
        aria-label="Information about APR"
        isOpen={aprOpen}
        onOpen={() => setAprOpen(true)}
        onClose={() => setAprOpen(false)}
      >
        {({ tooltipRef, isOpen, onMouseEnter, onMouseLeave, onTooltipFocus, onTooltipBlur }) => (
          <TooltipShell
            alignLeft
            isOpen={isOpen}
            tooltipRef={tooltipRef}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onFocus={onTooltipFocus}
            onBlur={onTooltipBlur}
            title="APR"
          >
            <AprTooltipContent />
          </TooltipShell>
        )}
      </InfoIconButton>

      <span className={`ds-text-11 text-muted-foreground ${!isApy ? 'text-foreground font-medium' : ''}`}>
        APR
      </span>
      <Switch
        checked={isApy}
        onCheckedChange={setIsApy}
        className="data-[state=checked]:bg-[rgb(var(--ds-brand-magenta-rgb))] scale-[0.65] md:scale-75"
        aria-label="Toggle between APR and APY"
      />
      <span className={`ds-text-11 text-muted-foreground ${isApy ? 'text-foreground font-medium' : ''}`}>
        APY
      </span>

      <InfoIconButton
        aria-label="Information about APY"
        isOpen={apyOpen}
        onOpen={() => setApyOpen(true)}
        onClose={() => setApyOpen(false)}
      >
        {({ tooltipRef, isOpen, onMouseEnter, onMouseLeave, onTooltipFocus, onTooltipBlur }) => (
          <TooltipShell
            alignLeft={false}
            isOpen={isOpen}
            tooltipRef={tooltipRef}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onFocus={onTooltipFocus}
            onBlur={onTooltipBlur}
            title="APY"
          >
            <ApyTooltipContent />
          </TooltipShell>
        )}
      </InfoIconButton>
    </div>
  );
}

export default AprApyToggle;
