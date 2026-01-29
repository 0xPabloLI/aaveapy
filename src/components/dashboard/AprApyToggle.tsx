import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Info, X } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface AprApyToggleProps {
  isApy: boolean;
  setIsApy: (value: boolean) => void;
}

const TOOLTIP_WIDTH = 320;
const VIEWPORT_PADDING = 16;

interface TooltipPosition {
  top: number;
  left?: number;
  right?: number;
}

function calculateTooltipPosition(
  triggerRect: DOMRect,
  alignLeft: boolean
): TooltipPosition {
  const top = triggerRect.bottom + 8;
  
  if (alignLeft) {
    const left = Math.max(VIEWPORT_PADDING, triggerRect.left);
    const rightEdge = left + TOOLTIP_WIDTH;
    if (rightEdge > window.innerWidth - VIEWPORT_PADDING) {
      return {
        top,
        left: Math.max(VIEWPORT_PADDING, window.innerWidth - TOOLTIP_WIDTH - VIEWPORT_PADDING),
      };
    }
    return { top, left };
  } else {
    const right = Math.max(VIEWPORT_PADDING, window.innerWidth - triggerRect.right);
    const leftEdge = window.innerWidth - right - TOOLTIP_WIDTH;
    if (leftEdge < VIEWPORT_PADDING) {
      return {
        top,
        right: Math.max(VIEWPORT_PADDING, window.innerWidth - TOOLTIP_WIDTH - VIEWPORT_PADDING),
      };
    }
    return { top, right };
  }
}

function InfoIconButton({
  'aria-label': ariaLabel,
  isOpen,
  onToggle,
  onClose,
  children,
}: {
  'aria-label': string;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  children: (triggerRect: DOMRect | null) => React.ReactNode;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);
  const isMobile = useIsMobile();

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

  const handleClick = () => {
    if (isMobile) {
      updateTriggerRect();
      onToggle();
    }
  };

  const handleMouseEnter = () => {
    if (!isMobile) {
      updateTriggerRect();
      onToggle();
    }
  };

  const handleMouseLeave = () => {
    if (!isMobile) {
      onClose();
    }
  };

  return (
    <div className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={() => {
          if (!isMobile) {
            updateTriggerRect();
            onToggle();
          }
        }}
        onBlur={() => {
          if (!isMobile) {
            onClose();
          }
        }}
        className="h-4 w-4 rounded-full ds-bg-emerald-500-10 ds-text-emerald-600
          hover:ds-bg-emerald-500-20 hover:ds-text-emerald-700
          flex items-center justify-center
          transition-all duration-200
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
      >
        <Info className="h-2.5 w-2.5 shrink-0" aria-hidden />
      </button>
      {children(triggerRect)}
    </div>
  );
}

function MobileTooltip({
  isOpen,
  onClose,
  title,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!isOpen) return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 bg-background/40 z-[9998] backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="fixed inset-x-4 bottom-4 z-[9999] bg-card border border-border rounded-xl shadow-xl
          animate-in slide-in-from-bottom-4 fade-in-0 duration-200"
        role="dialog"
        aria-modal="true"
      >
        <div className="ds-bg-emerald-500-10 px-4 py-2.5 rounded-t-xl flex items-center justify-between border-b ds-border-emerald-200">
          <h3 className="ds-text-emerald-700 ds-text-14 font-semibold">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-4 py-3.5 rounded-b-xl space-y-3 bg-card">{children}</div>
      </div>
    </>,
    document.body
  );
}

function DesktopTooltip({
  isOpen,
  alignLeft,
  triggerRect,
  onMouseEnter,
  onMouseLeave,
  title,
  children,
}: {
  isOpen: boolean;
  alignLeft: boolean;
  triggerRect: DOMRect | null;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!isOpen || !triggerRect) return null;

  const position = calculateTooltipPosition(triggerRect, alignLeft);

  return createPortal(
    <div
      className="fixed z-[9999] bg-card border border-border rounded-xl shadow-lg
        animate-in fade-in-0 zoom-in-95 duration-150"
      style={{
        width: TOOLTIP_WIDTH,
        top: position.top,
        left: position.left,
        right: position.right,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      role="tooltip"
    >
      <div className="ds-bg-emerald-500-10 px-4 py-2 rounded-t-xl border-b ds-border-emerald-200">
        <h3 className="ds-text-emerald-700 ds-text-14 font-semibold">{title}</h3>
      </div>
      <div className="px-4 py-3 rounded-b-xl space-y-2.5 bg-card">{children}</div>
    </div>,
    document.body
  );
}

function AprTooltipContent() {
  return (
    <>
      <div className="bg-muted/50 rounded-lg border border-border px-3 py-2">
        <code className="ds-text-12 font-mono font-semibold text-foreground whitespace-nowrap">
          APR = Native APY + Incentive APR
        </code>
      </div>
      <ul className="space-y-1.5 ds-text-12 text-muted-foreground">
        <li className="flex gap-2 items-start">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ds-bg-emerald-500-20 ring-1 ring-[rgb(var(--ds-emerald-500-rgb)/0.4)]" aria-hidden />
          <span>
            <strong className="font-semibold ds-text-emerald-600">Native APY:</strong>{' '}
            Auto-compounded by Aave
          </span>
        </li>
        <li className="flex gap-2 items-start">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ds-bg-emerald-500-20 ring-1 ring-[rgb(var(--ds-emerald-500-rgb)/0.4)]" aria-hidden />
          <span>
            <strong className="font-semibold ds-text-emerald-600">Incentive:</strong>{' '}
            Requires manual claiming
          </span>
        </li>
      </ul>
      <div className="border-t border-border pt-2">
        <p className="ds-text-11 text-muted-foreground">
          Use APR if you don&apos;t reinvest incentive
        </p>
      </div>
    </>
  );
}

function ApyTooltipContent() {
  return (
    <>
      <div className="bg-muted/50 rounded-lg border border-border px-3 py-2">
        <code className="ds-text-12 font-mono font-semibold text-foreground whitespace-nowrap">
          APY = Native APY + Incentive APY
        </code>
      </div>
      <ul className="space-y-1.5 ds-text-12 text-muted-foreground">
        <li className="flex gap-2 items-start">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ds-bg-emerald-500-20 ring-1 ring-[rgb(var(--ds-emerald-500-rgb)/0.4)]" aria-hidden />
          <span>
            <strong className="font-semibold ds-text-emerald-600">Native APY:</strong>{' '}
            Auto-compounded by Aave
          </span>
        </li>
        <li className="flex gap-2 items-start">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ds-bg-emerald-500-20 ring-1 ring-[rgb(var(--ds-emerald-500-rgb)/0.4)]" aria-hidden />
          <span>
            <strong className="font-semibold ds-text-emerald-600">Incentive:</strong>{' '}
            Monthly reinvesting assumed
          </span>
        </li>
      </ul>
      <div className="ds-bg-emerald-500-10 border ds-border-emerald-200 rounded-lg px-3 py-2">
        <code className="ds-text-11 font-mono font-semibold ds-text-emerald-700 whitespace-nowrap">
          Incentive APY = (1 + APR/12)¹² − 1
        </code>
      </div>
      <div className="border-t border-border pt-2">
        <p className="ds-text-11 text-muted-foreground">
          Use APY if you reinvest the incentive monthly
        </p>
      </div>
    </>
  );
}

export function AprApyToggle({ isApy, setIsApy }: AprApyToggleProps) {
  const [aprOpen, setAprOpen] = useState(false);
  const [apyOpen, setApyOpen] = useState(false);
  const isMobile = useIsMobile();

  return (
    <div className="flex items-center gap-1.5">
      <InfoIconButton
        aria-label="Information about APR"
        isOpen={aprOpen}
        onToggle={() => setAprOpen(!aprOpen)}
        onClose={() => setAprOpen(false)}
      >
        {(triggerRect) =>
          isMobile ? (
            <MobileTooltip
              isOpen={aprOpen}
              onClose={() => setAprOpen(false)}
              title="APR (Annual Percentage Rate)"
            >
              <AprTooltipContent />
            </MobileTooltip>
          ) : (
            <DesktopTooltip
              isOpen={aprOpen}
              alignLeft
              triggerRect={triggerRect}
              onMouseEnter={() => setAprOpen(true)}
              onMouseLeave={() => setAprOpen(false)}
              title="APR (Annual Percentage Rate)"
            >
              <AprTooltipContent />
            </DesktopTooltip>
          )
        }
      </InfoIconButton>

      {/* Segmented Control with color indication */}
      <div className="flex items-center gap-0.5 bg-muted/60 rounded-lg p-0.5 border border-border/40">
        <button
          type="button"
          onClick={() => setIsApy(false)}
          className={`
            px-3 py-1 rounded-md ds-text-12 font-semibold transition-all duration-200
            ${!isApy 
              ? 'bg-card ds-text-emerald-600 shadow-sm border border-border/60' 
              : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
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
            px-3 py-1 rounded-md ds-text-12 font-semibold transition-all duration-200
            ${isApy 
              ? 'bg-card ds-text-emerald-600 shadow-sm border border-border/60' 
              : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
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
        onToggle={() => setApyOpen(!apyOpen)}
        onClose={() => setApyOpen(false)}
      >
        {(triggerRect) =>
          isMobile ? (
            <MobileTooltip
              isOpen={apyOpen}
              onClose={() => setApyOpen(false)}
              title="APY (Annual Percentage Yield)"
            >
              <ApyTooltipContent />
            </MobileTooltip>
          ) : (
            <DesktopTooltip
              isOpen={apyOpen}
              alignLeft={false}
              triggerRect={triggerRect}
              onMouseEnter={() => setApyOpen(true)}
              onMouseLeave={() => setApyOpen(false)}
              title="APY (Annual Percentage Yield)"
            >
              <ApyTooltipContent />
            </DesktopTooltip>
          )
        }
      </InfoIconButton>
    </div>
  );
}

export default AprApyToggle;
