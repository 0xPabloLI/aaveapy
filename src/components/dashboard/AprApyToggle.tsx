import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Info, X } from 'lucide-react';
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
  triggerRect: DOMRect | null;
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
  const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);

  const handleBlur = (e: React.FocusEvent) => {
    if (tooltipRef.current?.contains(e.relatedTarget as Node)) return;
    onClose();
  };
  const handleTooltipBlur = (e: React.FocusEvent) => {
    if (triggerRef.current?.contains(e.relatedTarget as Node)) return;
    onClose();
  };

  const updateTriggerRect = () => {
    if (triggerRef.current) {
      setTriggerRect(triggerRef.current.getBoundingClientRect());
    }
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

  useEffect(() => {
    if (isOpen) {
      updateTriggerRect();
    }
  }, [isOpen]);

  return (
    <div className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        onMouseEnter={() => {
          updateTriggerRect();
          onOpen();
        }}
        onMouseLeave={onClose}
        onFocus={() => {
          updateTriggerRect();
          onOpen();
        }}
        onBlur={handleBlur}
        className="h-4 w-4 rounded-full bg-muted text-muted-foreground
          hover:bg-primary hover:text-primary-foreground
          flex items-center justify-center
          transition-all duration-200
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
      >
        <Info className="h-2.5 w-2.5 shrink-0" aria-hidden />
      </button>
      {renderTooltip({
        tooltipRef,
        isOpen,
        onMouseEnter: onOpen,
        onMouseLeave: onClose,
        onTooltipFocus: onOpen,
        onTooltipBlur: handleTooltipBlur,
        triggerRect,
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
  onClose,
  title,
  children,
  triggerRect,
}: {
  alignLeft: boolean;
  isOpen: boolean;
  tooltipRef: React.RefObject<HTMLDivElement>;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onFocus: () => void;
  onBlur: (e: React.FocusEvent) => void;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  triggerRect: DOMRect | null;
}) {
  const isMobile = useIsMobile();

  if (!isOpen) return null;

  const tooltipContent = (
    <div
      ref={tooltipRef}
      tabIndex={-1}
      className={`z-[9999] bg-popover border border-border rounded-xl shadow-2xl
        transition-[opacity,transform] duration-200 ease-out
        ${isOpen ? 'opacity-100' : 'opacity-0'}
        ${isMobile ? 'fixed inset-x-4 bottom-4' : 'fixed'}
      `}
      style={
        isMobile
          ? { width: 'auto' }
          : {
              width: TOOLTIP_WIDTH,
              top: triggerRect ? triggerRect.bottom + 8 : 0,
              left: alignLeft
                ? Math.max(16, triggerRect?.left ?? 0)
                : undefined,
              right: !alignLeft
                ? Math.max(16, window.innerWidth - (triggerRect?.right ?? 0))
                : undefined,
            }
      }
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocus={onFocus}
      onBlur={onBlur}
      role="tooltip"
      aria-hidden={!isOpen}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-primary via-secondary to-[hsl(175,65%,50%)] px-4 py-2.5 rounded-t-xl flex items-center justify-between">
        <h3 className="text-primary-foreground text-sm font-bold">{title}</h3>
        {isMobile && (
          <button
            type="button"
            onClick={onClose}
            className="text-primary-foreground/80 hover:text-primary-foreground transition-colors"
            aria-label="Close tooltip"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {/* Content */}
      <div className="px-4 py-3.5 rounded-b-xl space-y-3 bg-popover">{children}</div>
    </div>
  );

  // Mobile: also render backdrop
  if (isMobile) {
    return createPortal(
      <>
        <div
          className="fixed inset-0 bg-black/20 z-[9998] backdrop-blur-[1px]"
          onClick={onClose}
          aria-hidden
        />
        {tooltipContent}
      </>,
      document.body
    );
  }

  return createPortal(tooltipContent, document.body);
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
        renderTooltip={({ tooltipRef, isOpen, onMouseEnter, onMouseLeave, onTooltipFocus, onTooltipBlur, triggerRect }) => (
          <TooltipShell
            alignLeft
            isOpen={isOpen}
            tooltipRef={tooltipRef}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onFocus={onTooltipFocus}
            onBlur={onTooltipBlur}
            onClose={() => setAprOpen(false)}
            title="APR"
            triggerRect={triggerRect}
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
        renderTooltip={({ tooltipRef, isOpen, onMouseEnter, onMouseLeave, onTooltipFocus, onTooltipBlur, triggerRect }) => (
          <TooltipShell
            alignLeft={false}
            isOpen={isOpen}
            tooltipRef={tooltipRef}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onFocus={onTooltipFocus}
            onBlur={onTooltipBlur}
            onClose={() => setApyOpen(false)}
            title="APY"
            triggerRect={triggerRect}
          >
            <ApyTooltipContent />
          </TooltipShell>
        )}
      />
    </div>
  );
}

export default AprApyToggle;
