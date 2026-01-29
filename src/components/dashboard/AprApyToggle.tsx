import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Info, X } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface AprApyToggleProps {
  isApy: boolean;
  setIsApy: (value: boolean) => void;
}

const TOOLTIP_WIDTH = 260;
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
    // For left-aligned tooltip, ensure it doesn't overflow left edge
    const left = Math.max(VIEWPORT_PADDING, triggerRect.left);
    // Also check right edge
    const rightEdge = left + TOOLTIP_WIDTH;
    if (rightEdge > window.innerWidth - VIEWPORT_PADDING) {
      // Shift left to fit
      return {
        top,
        left: Math.max(VIEWPORT_PADDING, window.innerWidth - TOOLTIP_WIDTH - VIEWPORT_PADDING),
      };
    }
    return { top, left };
  } else {
    // For right-aligned tooltip, ensure it doesn't overflow right edge
    const right = Math.max(VIEWPORT_PADDING, window.innerWidth - triggerRect.right);
    // Also check left edge
    const leftEdge = window.innerWidth - right - TOOLTIP_WIDTH;
    if (leftEdge < VIEWPORT_PADDING) {
      // Shift right to fit
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

  // Mobile: click only
  // Desktop: hover + focus
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
        className="h-4 w-4 rounded-full bg-muted text-muted-foreground
          hover:bg-primary hover:text-primary-foreground
          flex items-center justify-center
          transition-all duration-200
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
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
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-[9998] backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden
      />
      {/* Bottom Sheet */}
      <div
        className="fixed inset-x-4 bottom-4 z-[9999] bg-popover border border-border rounded-xl shadow-2xl
          animate-in slide-in-from-bottom-4 fade-in-0 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-primary via-secondary to-[hsl(175,65%,50%)] px-4 py-2.5 rounded-t-xl flex items-center justify-between">
          <h3 className="text-primary-foreground text-sm font-bold">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-primary-foreground/80 hover:text-primary-foreground transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {/* Content */}
        <div className="px-4 py-3.5 rounded-b-xl space-y-3 bg-popover">{children}</div>
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
      className="fixed z-[9999] bg-popover border border-border rounded-xl shadow-2xl
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
      {/* Header */}
      <div className="bg-gradient-to-r from-primary via-secondary to-[hsl(175,65%,50%)] px-4 py-2 rounded-t-xl">
        <h3 className="text-primary-foreground text-sm font-bold">{title}</h3>
      </div>
      {/* Content */}
      <div className="px-4 py-3 rounded-b-xl space-y-2.5 bg-popover">{children}</div>
    </div>,
    document.body
  );
}

function AprTooltipContent() {
  return (
    <>
      <div className="bg-card rounded-lg border border-border px-3 py-2">
        <code className="text-xs font-mono font-semibold text-foreground">
          APR = Native APY + Incentive APR
        </code>
      </div>
      <ul className="space-y-1.5 text-xs text-muted-foreground">
        <li className="flex gap-2 items-start">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[hsl(var(--ds-blue-500))]" aria-hidden />
          <span>
            <strong className="font-semibold text-[hsl(var(--ds-blue-600))]">Native APY:</strong>{' '}
            Auto-compounded
          </span>
        </li>
        <li className="flex gap-2 items-start">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[hsl(var(--ds-emerald-500))]" aria-hidden />
          <span>
            <strong className="font-semibold text-[hsl(var(--ds-emerald-600))]">Incentive:</strong>{' '}
            Requires manual claiming
          </span>
        </li>
      </ul>
      <div className="border-t border-border pt-2">
        <p className="text-[11px] text-muted-foreground">
          Use APR if you don&apos;t reinvest rewards
        </p>
      </div>
    </>
  );
}

function ApyTooltipContent() {
  return (
    <>
      <div className="bg-card rounded-lg border border-border px-3 py-2">
        <code className="text-xs font-mono font-semibold text-foreground">
          APY = Native APY + Incentive APY
        </code>
      </div>
      <ul className="space-y-1.5 text-xs text-muted-foreground">
        <li className="flex gap-2 items-start">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[hsl(var(--ds-blue-500))]" aria-hidden />
          <span>
            <strong className="font-semibold text-[hsl(var(--ds-blue-600))]">Native APY:</strong>{' '}
            Auto-compounded
          </span>
        </li>
        <li className="flex gap-2 items-start">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[hsl(var(--ds-emerald-500))]" aria-hidden />
          <span>
            <strong className="font-semibold text-[hsl(var(--ds-emerald-600))]">Incentive:</strong>{' '}
            Monthly reinvesting assumed
          </span>
        </li>
      </ul>
      <div className="bg-[hsl(var(--ds-emerald-500)/0.1)] border border-[hsl(var(--ds-emerald-500)/0.2)] rounded-lg px-3 py-2">
        <code className="text-[10px] font-mono font-semibold text-[hsl(var(--ds-emerald-700))] dark:text-[hsl(var(--ds-emerald-400))]">
          Incentive APY = (1 + APR/12)¹² − 1
        </code>
      </div>
      <div className="border-t border-border pt-2">
        <p className="text-[11px] text-muted-foreground">
          Use APY if you reinvest monthly
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
              title="APR"
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
              title="APR"
            >
              <AprTooltipContent />
            </DesktopTooltip>
          )
        }
      </InfoIconButton>

      {/* Segmented Control */}
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
        onToggle={() => setApyOpen(!apyOpen)}
        onClose={() => setApyOpen(false)}
      >
        {(triggerRect) =>
          isMobile ? (
            <MobileTooltip
              isOpen={apyOpen}
              onClose={() => setApyOpen(false)}
              title="APY"
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
              title="APY"
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
