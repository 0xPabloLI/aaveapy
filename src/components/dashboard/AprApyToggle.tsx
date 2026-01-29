import { useState, useRef, useEffect } from 'react';
import { Info } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface AprApyToggleProps {
  isApy: boolean;
  setIsApy: (value: boolean) => void;
}

const TOOLTIP_WIDTH = 280;

interface TooltipRenderProps {
  tooltipRef: React.RefObject<HTMLDivElement>;
  isOpen: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onTooltipFocus: () => void;
  onTooltipBlur: (e: React.FocusEvent) => void;
}

function InfoIconButton({
  'aria-label': ariaLabel,
  isOpen,
  onOpen,
  onClose,
  renderTooltip,
}: {
  'aria-label': string;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  renderTooltip: (props: TooltipRenderProps) => React.ReactNode;
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
        className="h-3.5 w-3.5 rounded-full bg-muted text-muted-foreground
          hover:bg-primary hover:text-primary-foreground
          flex items-center justify-center
          transition-all duration-200
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
      >
        <Info className="h-2 w-2 shrink-0" aria-hidden />
      </button>
      {renderTooltip({
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
  tooltipRef: React.RefObject<HTMLDivElement>;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onFocus: () => void;
  onBlur: (e: React.FocusEvent) => void;
  title: string;
  children: React.ReactNode;
}) {
  const isMobile = useIsMobile();
  
  return (
    <div
      ref={tooltipRef}
      tabIndex={-1}
      className={`absolute top-5 z-50
        bg-popover border border-border rounded-xl shadow-xl
        transition-[opacity,visibility] duration-300 ease-out
        ${isOpen ? 'opacity-100 visible pointer-events-auto' : 'opacity-0 invisible pointer-events-none'}
        ${isMobile 
          ? 'fixed left-4 right-4 top-auto bottom-4 w-auto max-w-[calc(100vw-32px)]' 
          : alignLeft 
            ? 'left-0' 
            : 'right-0'
        }
      `}
      style={{ width: isMobile ? 'auto' : TOOLTIP_WIDTH }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocus={onFocus}
      onBlur={onBlur}
      role="tooltip"
      aria-hidden={!isOpen}
    >
      <div className="bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(175,65%,45%)] to-[hsl(175,65%,50%)] px-4 py-2.5 rounded-t-xl">
        <h3 className="text-primary-foreground text-sm font-bold">{title}</h3>
      </div>
      <div className="px-4 py-3.5 rounded-b-xl space-y-3 bg-popover">{children}</div>
    </div>
  );
}

function AprTooltipContent() {
  return (
    <>
      <div className="bg-card rounded-lg border border-border px-3 py-2.5">
        <code className="text-xs font-mono font-semibold text-foreground">
          APR = Native APY + Incentive APR
        </code>
      </div>
      <ul className="space-y-2 text-xs text-muted-foreground">
        <li className="flex gap-2 items-start">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[hsl(var(--ds-blue-500))]" aria-hidden />
          <span>
            <strong className="font-semibold text-[hsl(var(--ds-blue-600))]">Native APY:</strong>{' '}
            Auto-compounded by Aave smart contracts
          </span>
        </li>
        <li className="flex gap-2 items-start">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[hsl(var(--ds-emerald-500))]" aria-hidden />
          <span>
            <strong className="font-semibold text-[hsl(var(--ds-emerald-600))]">Incentive:</strong>{' '}
            Requires manual claiming & reinvesting
          </span>
        </li>
      </ul>
      <div className="border-t border-border pt-2">
        <p className="text-[11px] text-muted-foreground">
          Use APR if you don&apos;t plan to reinvest incentive rewards
        </p>
      </div>
    </>
  );
}

function ApyTooltipContent() {
  return (
    <>
      <div className="bg-card rounded-lg border border-border px-3 py-2.5">
        <code className="text-xs font-mono font-semibold text-foreground">
          APY = Native APY + Incentive APY
        </code>
      </div>
      <ul className="space-y-2 text-xs text-muted-foreground">
        <li className="flex gap-2 items-start">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[hsl(var(--ds-blue-500))]" aria-hidden />
          <span>
            <strong className="font-semibold text-[hsl(var(--ds-blue-600))]">Native APY:</strong>{' '}
            Auto-compounded by Aave smart contracts
          </span>
        </li>
        <li className="flex gap-2 items-start">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[hsl(var(--ds-emerald-500))]" aria-hidden />
          <span>
            <strong className="font-semibold text-[hsl(var(--ds-emerald-600))]">Incentive:</strong>{' '}
            Assumes monthly reinvesting of rewards
          </span>
        </li>
      </ul>
      <div className="bg-[hsl(var(--ds-emerald-500)/0.1)] border border-[hsl(var(--ds-emerald-500)/0.2)] rounded-lg px-3 py-2.5">
        <code className="text-[11px] font-mono font-semibold text-[hsl(var(--ds-emerald-700))] dark:text-[hsl(var(--ds-emerald-400))]">
          Incentive APY = (1 + APR/12)¹² − 1
        </code>
      </div>
      <div className="border-t border-border pt-2">
        <p className="text-[11px] text-muted-foreground">
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
    <div className="flex items-center gap-1.5">
      <InfoIconButton
        aria-label="Information about APR"
        isOpen={aprOpen}
        onOpen={() => setAprOpen(true)}
        onClose={() => setAprOpen(false)}
        renderTooltip={({ tooltipRef, isOpen, onMouseEnter, onMouseLeave, onTooltipFocus, onTooltipBlur }) => (
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
      />

      {/* Segmented Control Style Toggle */}
      <div className="flex items-center bg-muted rounded-full p-0.5 border border-border/50">
        <button
          type="button"
          onClick={() => setIsApy(false)}
          className={`
            px-2.5 py-0.5 rounded-full text-xs font-medium transition-all duration-200
            ${!isApy 
              ? 'bg-card text-foreground shadow-sm' 
              : 'text-muted-foreground hover:text-foreground'
            }
          `}
          aria-pressed={!isApy}
        >
          APR
        </button>
        <button
          type="button"
          onClick={() => setIsApy(true)}
          className={`
            px-2.5 py-0.5 rounded-full text-xs font-medium transition-all duration-200
            ${isApy 
              ? 'bg-card text-foreground shadow-sm' 
              : 'text-muted-foreground hover:text-foreground'
            }
          `}
          aria-pressed={isApy}
        >
          APY
        </button>
      </div>

      <InfoIconButton
        aria-label="Information about APY"
        isOpen={apyOpen}
        onOpen={() => setApyOpen(true)}
        onClose={() => setApyOpen(false)}
        renderTooltip={({ tooltipRef, isOpen, onMouseEnter, onMouseLeave, onTooltipFocus, onTooltipBlur }) => (
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
      />
    </div>
  );
}

export default AprApyToggle;
