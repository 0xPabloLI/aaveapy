import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ExternalLink, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { InfoIconButton, DesktopTooltip, MobileTooltip } from '@/components/dashboard/AprApyToggle';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useCoingeckoFdv } from '@/hooks/useCoingeckoFdv';
import { useIsMobile } from '@/hooks/use-mobile';

interface InkAprCalculatorProps {
  rateInput: string;
  setRateInput: (value: string) => void;
  onRateChange?: (rate: number) => void;
  onDragStateChange?: (isDragging: boolean) => void;
}

const TOTAL_SUPPLY = 1_000_000_000;
const DEFAULT_FDV = 1.0;
const MIN_FDV = 0;
const MAX_FDV = 115.8; // Binance as max

interface ReferencePoint {
  id: string;
  fdv: number;
  position: number;
  exchange?: string;
  chain?: string;
  token?: string;
  link?: string;
  isDefault?: boolean;
}

// Reference points with positions (0-100%)
// Tighter spacing: 0 at 0%, Default at 12%, then evenly distribute the rest
const REFERENCE_POINTS: ReferencePoint[] = [
  { id: 'zero', fdv: 0, position: 0 },
  { id: 'default', fdv: 1.0, position: 12, isDefault: true },
  { id: 'okx', fdv: 2.1, position: 29.6, exchange: 'OKX', chain: 'X Layer', token: 'OKB', link: 'https://www.coingecko.com/en/coins/okb' },
  { id: 'bitget', fdv: 3.2, position: 47.2, exchange: 'Bitget', chain: 'Morph', token: 'BGB', link: 'https://www.coingecko.com/en/coins/bitget-token' },
  { id: 'bybit', fdv: 5.0, position: 64.8, exchange: 'Bybit', chain: 'Mantle', token: 'MNT', link: 'https://www.coingecko.com/en/coins/mantle' },
  { id: 'cryptocom', fdv: 8.5, position: 82.4, exchange: 'Crypto.com', chain: 'Cronos', token: 'CRO', link: 'https://www.coingecko.com/en/coins/cronos' },
  { id: 'binance', fdv: 115.8, position: 100, exchange: 'Binance', chain: 'BSC', token: 'BNB', link: 'https://www.coingecko.com/en/coins/bnb' },
];

// Piecewise linear interpolation: evenly spaced reference points
function fdvToPosition(fdv: number, points: ReferencePoint[]): number {
  const sorted = [...points].sort((a, b) => a.fdv - b.fdv);
  if (fdv <= sorted[0].fdv) return sorted[0].position;
  if (fdv >= sorted[sorted.length - 1].fdv) return sorted[sorted.length - 1].position;
  
  for (let i = 0; i < sorted.length - 1; i++) {
    if (fdv >= sorted[i].fdv && fdv <= sorted[i + 1].fdv) {
      const ratio = (fdv - sorted[i].fdv) / (sorted[i + 1].fdv - sorted[i].fdv);
      return sorted[i].position + ratio * (sorted[i + 1].position - sorted[i].position);
    }
  }
  return 50;
}

function positionToFdv(position: number, points: ReferencePoint[]): number {
  const sorted = [...points].sort((a, b) => a.position - b.position);
  if (position <= sorted[0].position) return sorted[0].fdv;
  if (position >= sorted[sorted.length - 1].position) return sorted[sorted.length - 1].fdv;
  
  for (let i = 0; i < sorted.length - 1; i++) {
    if (position >= sorted[i].position && position <= sorted[i + 1].position) {
      const ratio = (position - sorted[i].position) / (sorted[i + 1].position - sorted[i].position);
      return sorted[i].fdv + ratio * (sorted[i + 1].fdv - sorted[i].fdv);
    }
  }
  return 1.0;
}

function formatInkPrice(fdvBillions: number): string {
  const price = (fdvBillions * 1e9) / TOTAL_SUPPLY;
  return price.toFixed(2);
}

function formatFdv(fdv: number): string {
  return fdv.toFixed(2);
}

// Thumb color at position (0–100): blue → purple → emerald (three-stop gradient)
function positionToThumbRgb(positionPercent: number): { r: number; g: number; b: number } {
  const p = Math.max(0, Math.min(100, positionPercent)) / 100;
  let r: number;
  let g: number;
  let b: number;
  if (p <= 0.5) {
    const t = p * 2;
    r = 59 + (168 - 59) * t;
    g = 130 + (85 - 130) * t;
    b = 246 + (247 - 246) * t;
  } else {
    const t = (p - 0.5) * 2;
    r = 168 + (5 - 168) * t;
    g = 85 + (150 - 85) * t;
    b = 247 + (105 - 247) * t;
  }
  return { r: Math.round(r), g: Math.round(g), b: Math.round(b) };
}

function positionToThumbColor(positionPercent: number): string {
  const { r, g, b } = positionToThumbRgb(positionPercent);
  return `rgb(${r}, ${g}, ${b})`;
}

function InkAprTooltipContent({
  formatInkPrice,
  currentFdvBillions,
}: {
  formatInkPrice: (fdvBillions: number) => string;
  currentFdvBillions: number;
}) {
  return (
    <>
      <div className="flex justify-center">
        <div className="bg-muted/50 rounded-lg border border-border px-3 py-2">
          <code className="ds-text-12 font-mono font-medium text-foreground whitespace-nowrap">
            APR = daily_points × $INK × 365%
          </code>
        </div>
      </div>
      <div className="flex items-center justify-center gap-1.5 ds-text-12 text-muted-foreground">
        <img
          src="/icons/partners/inktoken.svg"
          alt="INK"
          className="w-3.5 h-3.5 shrink-0 invert dark:invert-0"
        />
        <span>INK</span>
        <span className="tabular-nums">${formatInkPrice(currentFdvBillions)}</span>
      </div>
    </>
  );
}

const InkAprCalculator = ({
  rateInput,
  setRateInput,
  onRateChange,
  onDragStateChange,
}: InkAprCalculatorProps) => {
  const { data: fdvData } = useCoingeckoFdv();
  const isMobile = useIsMobile();
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [isAprTooltipOpen, setIsAprTooltipOpen] = useState(false);
  const [isFdvTooltipOpen, setIsFdvTooltipOpen] = useState(false);
  const [fdvTriggerRect, setFdvTriggerRect] = useState<DOMRect | null>(null);
  const [fdvInputValue, setFdvInputValue] = useState('1.00');
  const [isFdvInputFocused, setIsFdvInputFocused] = useState(false);
  const fdvTriggerRef = useRef<HTMLButtonElement>(null);
  const fdvInputRef = useRef<HTMLInputElement>(null);
  const [pillHoveredPointId, setPillHoveredPointId] = useState<string | null>(null);
  const [linkHoveredPointId, setLinkHoveredPointId] = useState<string | null>(null);
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [fdvJustChanged, setFdvJustChanged] = useState(false);
  const prevFdvRef = useRef(DEFAULT_FDV);

  const fdvBySymbol = useMemo(() => {
    return new Map(
      fdvData?.items
        .filter((item) => item.symbol)
        .map((item) => [item.symbol!.toUpperCase(), item.fdvUsd ? item.fdvUsd / 1e9 : null]) ?? []
    );
  }, [fdvData]);

  // Update reference points with live FDV data
  const referencePointsWithLiveFdv = useMemo(() => {
    return REFERENCE_POINTS.map((point) => {
      if (point.token && !point.isDefault) {
        const liveFdv = fdvBySymbol.get(point.token);
        if (liveFdv !== null && liveFdv !== undefined) {
          return { ...point, fdv: liveFdv };
        }
      }
      return point;
    });
  }, [fdvBySymbol]);
  
  // Filter out the zero point for display but keep for calculation
  const displayPoints = useMemo(() => {
    return referencePointsWithLiveFdv.filter(p => p.id !== 'zero');
  }, [referencePointsWithLiveFdv]);

  const parsedRate = parseFloat(rateInput);
  const isValidRate = !Number.isNaN(parsedRate) && parsedRate >= 0;
  const currentFdvBillions = isValidRate 
    ? (parsedRate * TOTAL_SUPPLY) / 1e9 
    : DEFAULT_FDV;
  const sliderPosition = fdvToPosition(currentFdvBillions, referencePointsWithLiveFdv);

  // Sync slider/data → input only when input is not focused (so editing is not overwritten)
  useEffect(() => {
    if (isFdvInputFocused) return;
    const formatted = currentFdvBillions.toFixed(2);
    if (Math.abs(parseFloat(fdvInputValue) - currentFdvBillions) > 0.01) {
      setFdvInputValue(formatted);
    }
  }, [currentFdvBillions, fdvInputValue, isFdvInputFocused]);

  // Brief color hint when FDV changes (slider/pill, not from typing)
  useEffect(() => {
    if (isFdvInputFocused) return;
    if (Math.abs(currentFdvBillions - prevFdvRef.current) > 0.001) {
      prevFdvRef.current = currentFdvBillions;
      setFdvJustChanged(true);
      const t = setTimeout(() => setFdvJustChanged(false), 450);
      return () => clearTimeout(t);
    }
  }, [currentFdvBillions, isFdvInputFocused]);
  
  useEffect(() => {
    if (!rateInput || rateInput === '0') {
      const defaultPrice = (DEFAULT_FDV * 1e9) / TOTAL_SUPPLY;
      setRateInput(defaultPrice.toFixed(4));
    }
  }, [rateInput, setRateInput]);

  const updateFromFdv = useCallback((fdvBillions: number) => {
    const clampedFdv = Math.max(MIN_FDV, Math.min(MAX_FDV, fdvBillions));
    const price = (clampedFdv * 1e9) / TOTAL_SUPPLY;
    setRateInput(price.toFixed(4));
    onRateChange?.(price);
  }, [setRateInput, onRateChange]);

  const handleFdvInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setFdvInputValue(raw);
    const parsed = parseFloat(raw);
    if (raw.trim() !== '' && !Number.isNaN(parsed) && parsed >= MIN_FDV) {
      const clamped = Math.min(MAX_FDV, parsed);
      updateFromFdv(clamped);
    }
  }, [updateFromFdv]);

  const commitFdvInput = useCallback(() => {
    const trimmed = fdvInputValue.trim();
    const parsed = parseFloat(fdvInputValue);
    if (trimmed === '' || Number.isNaN(parsed) || parsed < MIN_FDV) {
      setFdvInputValue(currentFdvBillions.toFixed(2));
      return;
    }
    const clamped = Math.min(MAX_FDV, parsed);
    setFdvInputValue(clamped.toFixed(2));
    updateFromFdv(clamped);
  }, [fdvInputValue, currentFdvBillions, updateFromFdv]);

  const handleFdvInputBlur = useCallback(() => {
    setIsFdvInputFocused(false);
    commitFdvInput();
  }, [commitFdvInput]);

  const handleFdvInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.currentTarget.blur();
      }
    },
    []
  );

  const handlePointClick = useCallback((fdv: number) => {
    updateFromFdv(fdv);
  }, [updateFromFdv]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const step = e.shiftKey ? 5 : 1;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault();
        updateFromFdv(Math.max(MIN_FDV, currentFdvBillions - step * 0.5));
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault();
        updateFromFdv(Math.min(MAX_FDV, currentFdvBillions + step * 0.5));
      }
    },
    [updateFromFdv, currentFdvBillions]
  );

  const handleTrackInteraction = useCallback((clientX: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const position = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const fdv = positionToFdv(position, referencePointsWithLiveFdv);
    updateFromFdv(fdv);
  }, [updateFromFdv, referencePointsWithLiveFdv]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    onDragStateChange?.(true);
    setShowTooltip(true);
    if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
    handleTrackInteraction(e.clientX);
  }, [handleTrackInteraction, onDragStateChange]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
    onDragStateChange?.(true);
    setShowTooltip(true);
    if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
    handleTrackInteraction(e.touches[0].clientX);
  }, [handleTrackInteraction, onDragStateChange]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      handleTrackInteraction(e.clientX);
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      handleTrackInteraction(e.touches[0].clientX);
    };

    const handleEnd = () => {
      setIsDragging(false);
      onDragStateChange?.(false);
      tooltipTimeoutRef.current = setTimeout(() => {
        setShowTooltip(false);
      }, 800);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, handleTrackInteraction, onDragStateChange]);

  useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
    };
  }, []);

  // State for collapsible reference section
  const [isReferenceOpen, setIsReferenceOpen] = useState(false);

  const fdvTooltipContent = (
    <div className="space-y-1">
      <p className="text-muted-foreground ds-text-11 leading-snug">Fully Diluted Valuation, in billions USD</p>
      <p className="text-muted-foreground ds-text-11 leading-snug">
        INK total supply: {TOTAL_SUPPLY.toLocaleString()} (1 billion){' '}
        <a
          href="https://x.com/inkfndhq/status/1934991370957033888"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Official documentation"
          className="inline text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="h-3 w-3 shrink-0 ml-0.5 inline-block align-middle" aria-hidden />
        </a>
      </p>
    </div>
  );

  // (CompactLayout removed - inlined in return statement to fix React hook rules)

  // Full layout for large screens (xl+)
  const FullLayout = () => (
    <div className="flex flex-col gap-[var(--ds-space-2)]">
      {/* Top Row: Title, Formula, Slider, Inputs */}
      <div className="flex flex-col lg:flex-row lg:items-start gap-[var(--ds-space-2)]">
        {/* Left: Logo + Title + Formula - relative z-10 so info icon receives hover above overlapping bottom row */}
        <div className="relative z-10 flex flex-col gap-1 shrink-0 lg:w-[240px]">
          <div className="flex items-center gap-[var(--ds-space-2)]">
            <img
              src="/icons/networks/ink.svg"
              alt="INK"
              className="w-5 h-5 shrink-0"
            />
            <span className="ds-text-14 md:ds-text-16 font-semibold text-foreground whitespace-nowrap">
              Ink incentive APR calculator
            </span>
            <InfoIconButton
              aria-label="Incentive APR formula"
              isOpen={isAprTooltipOpen}
              onToggle={() => setIsAprTooltipOpen((o) => !o)}
              onClose={() => setIsAprTooltipOpen(false)}
            >
              {(triggerRect) =>
                isMobile ? (
                  <MobileTooltip
                    isOpen={isAprTooltipOpen}
                    onClose={() => setIsAprTooltipOpen(false)}
                    title="Incentive APR formula"
                  >
                    <InkAprTooltipContent formatInkPrice={formatInkPrice} currentFdvBillions={currentFdvBillions} />
                  </MobileTooltip>
                ) : (
                  <DesktopTooltip
                    isOpen={isAprTooltipOpen}
                    alignLeft
                    triggerRect={triggerRect}
                    onMouseEnter={() => setIsAprTooltipOpen(true)}
                    onMouseLeave={() => setIsAprTooltipOpen(false)}
                    title="Incentive APR formula"
                  >
                    <InkAprTooltipContent formatInkPrice={formatInkPrice} currentFdvBillions={currentFdvBillions} />
                  </DesktopTooltip>
                )
              }
            </InfoIconButton>
          </div>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 ds-text-11 text-muted-foreground pl-7">
            <span>Enter your estimated <span className="font-semibold">$INK FDV</span></span>
            <span className="inline-flex items-center bg-muted/30 border border-border/70 rounded-md px-1.5 py-px h-4 focus-within:border-[rgb(var(--ds-brand-magenta-rgb))] transition-colors duration-200 shrink-0 [font-size:11px]">
              <span className="inline-flex items-center justify-center !text-[11px] leading-none text-muted-foreground/80">$</span>
              <Input
                ref={fdvInputRef}
                type="number"
                min="0"
                max="120"
                step="0.01"
                inputMode="decimal"
                value={fdvInputValue}
                onChange={handleFdvInputChange}
                onFocus={() => {
                  setIsFdvInputFocused(true);
                  requestAnimationFrame(() => fdvInputRef.current?.select());
                }}
                onBlur={handleFdvInputBlur}
                onKeyDown={handleFdvInputKeyDown}
                placeholder={isFdvInputFocused ? '' : '1.00'}
                className={`w-8 min-w-0 px-0.5 !text-[11px] font-medium tabular-nums bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/60 h-full min-h-0 p-0 text-center appearance-none [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-colors duration-300 [line-height:1rem] ${fdvJustChanged ? 'text-[rgb(var(--ds-brand-magenta-rgb))]' : 'text-muted-foreground/80 focus:text-muted-foreground/50'}`}
                aria-label="Estimated $INK FDV in billions"
              />
              <span className="inline-flex items-center justify-center !text-[11px] leading-none text-muted-foreground/80">B</span>
            </span>
            <span>to update the incentive APR</span>
          </div>
        </div>

        {/* Center: Slider - aligned with title row */}
        <div className="relative flex-1 min-w-[120px] lg:ml-4 lg:mr-6 lg:pt-[0.375rem]">
          <div className="flex items-center gap-1.5 -mt-1">
            <div className="relative flex items-center justify-center gap-0.5 w-14 ml-1">
              <span className="ds-text-10 md:ds-text-11 text-muted-foreground/70 font-normal tracking-wide">
                FDV (B)
              </span>
              <div className="relative inline-flex">
                <button
                  ref={fdvTriggerRef}
                  type="button"
                  aria-label="FDV definition"
                  className="h-4 w-4 rounded-full flex items-center justify-center ds-bg-purple-500-10 ds-text-purple-600 shadow-sm hover:bg-[rgb(var(--ds-purple-500-rgb)/0.2)] hover:ds-text-purple-700 hover:shadow-md transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                  onMouseEnter={() => {
                    if (fdvTriggerRef.current) setFdvTriggerRect(fdvTriggerRef.current.getBoundingClientRect());
                    if (!isMobile) setIsFdvTooltipOpen(true);
                  }}
                  onMouseLeave={() => !isMobile && setIsFdvTooltipOpen(false)}
                  onClick={() => {
                    if (isMobile && fdvTriggerRef.current) setFdvTriggerRect(fdvTriggerRef.current.getBoundingClientRect());
                    if (isMobile) setIsFdvTooltipOpen((o) => !o);
                  }}
                >
                  <Info className="h-2.5 w-2.5 shrink-0" aria-hidden />
                </button>
                {isMobile ? (
                  <MobileTooltip
                    isOpen={isFdvTooltipOpen}
                    onClose={() => setIsFdvTooltipOpen(false)}
                    title="FDV (B)"
                    variant="purple"
                  >
                    {fdvTooltipContent}
                  </MobileTooltip>
                ) : (
                  <DesktopTooltip
                    isOpen={isFdvTooltipOpen}
                    alignLeft
                    triggerRect={fdvTriggerRect}
                    onMouseEnter={() => setIsFdvTooltipOpen(true)}
                    onMouseLeave={() => setIsFdvTooltipOpen(false)}
                    title="FDV (B)"
                    variant="purple"
                    hideTitle
                  >
                    {fdvTooltipContent}
                  </DesktopTooltip>
                )}
              </div>
            </div>
            <div
              ref={trackRef}
              className="relative h-1.5 flex-1 rounded-full cursor-pointer select-none touch-none"
              style={{
                background: 'linear-gradient(to right, rgb(var(--ds-blue-500-rgb)), rgb(var(--ds-purple-500-rgb)), rgb(var(--ds-emerald-600-rgb)))',
              }}
              onMouseDown={handleMouseDown}
              onTouchStart={handleTouchStart}
              onKeyDown={handleKeyDown}
              role="slider"
              aria-valuemin={MIN_FDV}
              aria-valuemax={MAX_FDV}
              aria-valuenow={currentFdvBillions}
              aria-label="FDV slider"
              tabIndex={0}
            >
            {/* Reference point markers (skip zero) - high contrast on gradient */}
            {displayPoints.map((point) => (
              <div
                key={`marker-${point.id}`}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-white dark:bg-card border-2 border-foreground/90 shadow-sm pointer-events-none"
                style={{ left: `${point.position}%` }}
              />
            ))}

            {/* Current value thumb - color follows position on track gradient */}
            <div
              className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 border-white shadow-md pointer-events-none transition-all duration-150 ${
                isDragging ? 'scale-[1.4] shadow-lg ring-2 ring-white/30' : ''
              }`}
              style={{
                left: `${sliderPosition}%`,
                background: positionToThumbColor(sliderPosition),
              }}
            />

            {/* Tooltip: floating number only, no background box - positioned higher to avoid overlap with scaled thumb */}
            {(showTooltip || isDragging) && (
              <div
                className="absolute -top-6 -translate-x-1/2 text-foreground ds-text-13 font-semibold tabular-nums whitespace-nowrap z-20"
                style={{ left: `${sliderPosition}%` }}
              >
                ${formatFdv(currentFdvBillions)}
              </div>
            )}
            </div>
          </div>
        </div>

      </div>

      {/* Bottom Row: space above labels = space below tallest label to card bottom; keep a little gap between thumb bottom and shadow top. pointer-events-none so overlay does not block slider; auto on inputs/labels. */}
      <div className="flex items-center gap-[var(--ds-space-2)] -mt-[3.5625rem] min-h-[3.5rem] pointer-events-none">
        <div className="shrink-0 hidden lg:block w-[240px]" aria-hidden />
        {/* Wrapper: content shifted down slightly so space(slider→labels) ≈ space(labels bottom→card bottom); minimal pt so a little space remains between thumb bottom and labels/shadow. */}
        <div className="relative flex-1 min-w-[120px] lg:ml-4 lg:mr-6 flex flex-col justify-start min-h-[3.5rem] pt-[0.6875rem] pointer-events-none">
          <div className="flex items-start gap-1.5 pointer-events-none">
            <div className="hidden lg:flex w-14 shrink-0 flex-col items-center justify-start pt-0.5 h-8 pointer-events-auto">
              <div className="flex flex-col items-center leading-none gap-[var(--ds-space-0-5)] w-full">
                <span className="min-h-4 flex items-center justify-center ds-text-10 md:ds-text-11 font-medium tabular-nums whitespace-nowrap leading-none text-muted-foreground">
                  = $<span className={`transition-colors duration-300 ${fdvJustChanged ? 'text-[rgb(var(--ds-brand-magenta-rgb))]' : 'text-muted-foreground'}`}>{formatInkPrice(currentFdvBillions)}</span>/INK
                </span>
                <span className="ds-text-9 md:ds-text-10 whitespace-nowrap leading-none text-muted-foreground/40">Kraken</span>
                <a
                  href="https://coinmarketcap.com/currencies/ink-token/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-0.5 ds-text-9 md:ds-text-10 whitespace-nowrap leading-none text-muted-foreground/50 hover:text-foreground transition-colors"
                >
                  Ink/INK
                  <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-70" aria-hidden />
                </a>
              </div>
            </div>
            {/* Labels container same width as track (flex-1 after w-14 + gap-2) */}
            <div className="relative flex-1 min-w-0 h-8 pointer-events-none">
           {/* FDV label at 0 */}
          <div
            className="absolute flex flex-col items-center justify-start pt-0.5 h-full"
            style={{ left: '0%', transform: 'translateX(-50%)' }}
          />

          {/* Reference point labels */}
          {displayPoints.map((point) => {
            const isSelected = Math.abs(currentFdvBillions - point.fdv) < 0.02;
            const pointRgb = isSelected ? positionToThumbRgb(point.position) : null;
            return (
              <div
                key={point.id}
                onClick={() => handlePointClick(point.fdv)}
                className="absolute flex flex-col items-center justify-start pt-0.5 h-full cursor-pointer pointer-events-auto rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                style={{ left: `${point.position}%`, transform: 'translateX(-50%)' }}
                role="button"
                aria-label={point.isDefault ? `Set FDV to default (${point.fdv})` : `Set FDV to ${point.exchange} (${point.fdv.toFixed(2)})`}
              >
                <div className="flex flex-col items-center leading-none gap-[var(--ds-space-0-5)] w-full">
                  {/* Pill: only top two lines (FDV + exchange/Default), py-0 so line spacing equals gap to line 3 */}
                  <div
                    onMouseEnter={() => setPillHoveredPointId(point.id)}
                    onMouseLeave={() => setPillHoveredPointId(null)}
                    className={`rounded-md py-0 flex flex-col items-center leading-none gap-[var(--ds-space-0-5)] transition-all duration-200 ${
                      pointRgb ? 'px-[var(--ds-space-2-5)]' : 'px-[var(--ds-space-1-5)]'
                    } ${
                      !isSelected && (pillHoveredPointId === point.id && linkHoveredPointId !== point.id)
                        ? 'shadow-sm bg-muted/50'
                        : ''
                    }`}
                    style={pointRgb ? { backgroundColor: `rgba(${pointRgb.r}, ${pointRgb.g}, ${pointRgb.b}, 0.12)` } : undefined}
                  >
                    <span
                      className={`min-h-4 flex items-center justify-center ds-text-10 md:ds-text-11 tabular-nums whitespace-nowrap font-medium leading-none ${!pointRgb ? 'text-muted-foreground' : ''}`}
                      style={pointRgb ? { color: `rgb(${pointRgb.r}, ${pointRgb.g}, ${pointRgb.b})` } : undefined}
                    >
                      ${formatFdv(point.fdv)}
                    </span>
                    {point.isDefault ? (
                      <span
                        className={`ds-text-9 md:ds-text-10 whitespace-nowrap leading-none ${!pointRgb ? 'text-muted-foreground/50' : ''}`}
                        style={pointRgb ? { color: `rgba(${pointRgb.r}, ${pointRgb.g}, ${pointRgb.b}, 0.78)` } : undefined}
                      >
                        Default
                      </span>
                    ) : (
                      <span
                        className={`ds-text-9 md:ds-text-10 whitespace-nowrap leading-none ${!pointRgb ? 'text-muted-foreground/40' : ''}`}
                        style={pointRgb ? { color: `rgba(${pointRgb.r}, ${pointRgb.g}, ${pointRgb.b}, 0.78)` } : undefined}
                      >
                        {point.exchange}
                      </span>
                    )}
                  </div>
                  {/* Third line: chain/token link, outside the pill — centered with pill */}
                  {!point.isDefault && (
                    <a
                      href={point.link}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      onMouseEnter={() => setLinkHoveredPointId(point.id)}
                      onMouseLeave={() => setLinkHoveredPointId(null)}
                      title="Open CoinGecko (new tab)"
                      className={`inline-flex items-center justify-center gap-0.5 ds-text-9 md:ds-text-10 whitespace-nowrap leading-none transition-colors ${
                        linkHoveredPointId === point.id ? 'text-foreground' : !pointRgb ? 'text-muted-foreground/50 hover:text-foreground' : 'hover:text-foreground'
                      }`}
                      style={pointRgb && linkHoveredPointId !== point.id ? { color: `rgba(${pointRgb.r}, ${pointRgb.g}, ${pointRgb.b}, 0.72)` } : undefined}
                    >
                      {point.chain}/{point.token}
                      <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-70" aria-hidden />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
            </div>
          </div>
        </div>

      </div>
    </div>
  );

  // Use xl breakpoint (1280px) to switch between layouts
  // Below xl: compact layout with presets
  // xl and above: full layout with all reference points on slider
  const [isXl, setIsXl] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1280px)');
    const onChange = () => setIsXl(mql.matches);
    mql.addEventListener('change', onChange);
    setIsXl(mql.matches);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  // Render compact layout directly as JSX (not as component call)
  const subtitleWithInput = (
    <div className="flex flex-nowrap items-center gap-x-1.5 ds-text-11 text-muted-foreground overflow-x-auto min-w-0">
      <span className="shrink-0 whitespace-nowrap">Enter your estimated <span className="font-semibold">$INK FDV</span></span>
      <span className="inline-flex items-center h-7 rounded-md border bg-card/50 border-border/50 pl-[var(--ds-space-1-5)] pr-[var(--ds-space-1-5)] focus-within:border-[rgb(var(--ds-brand-magenta-rgb))] focus-within:ring-0 focus-within:ring-offset-0 transition-colors shrink-0 [font-size:11px] [line-height:1.75rem]">
        <span className="h-7 inline-flex items-center justify-center !text-[11px] leading-none text-muted-foreground/50 w-[1ch] shrink-0">$</span>
        <Input
          ref={fdvInputRef}
          type="number"
          min="0"
          max="120"
          step="0.01"
          inputMode="decimal"
          value={fdvInputValue}
          onChange={handleFdvInputChange}
          onFocus={() => {
            setIsFdvInputFocused(true);
            requestAnimationFrame(() => fdvInputRef.current?.select());
          }}
          onBlur={handleFdvInputBlur}
          onKeyDown={handleFdvInputKeyDown}
          placeholder={isFdvInputFocused ? '' : '1.00'}
          className={`w-9 min-w-0 px-1 !text-[11px] font-normal tabular-nums bg-transparent border-0 shadow-none placeholder:text-muted-foreground/50 focus:text-foreground focus-visible:ring-0 focus-visible:ring-offset-0 h-7 min-h-0 py-0 text-center appearance-none [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [line-height:1.75rem] transition-colors duration-300 ${fdvJustChanged ? 'text-[rgb(var(--ds-brand-magenta-rgb))]' : 'text-muted-foreground/50'}`}
          aria-label="Estimated $INK FDV in billions"
        />
        <span className="h-7 inline-flex items-center justify-center !text-[11px] leading-none text-muted-foreground/50 w-[1ch] shrink-0">B</span>
      </span>
      <div className="relative inline-flex shrink-0">
        <button
          ref={fdvTriggerRef}
          type="button"
          aria-label="FDV definition"
          className="h-4 w-4 rounded-full flex items-center justify-center ds-bg-purple-500-10 ds-text-purple-600 shadow-sm hover:bg-[rgb(var(--ds-purple-500-rgb)/0.2)] hover:ds-text-purple-700 hover:shadow-md transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
          onMouseEnter={() => {
            if (fdvTriggerRef.current) setFdvTriggerRect(fdvTriggerRef.current.getBoundingClientRect());
            if (!isMobile) setIsFdvTooltipOpen(true);
          }}
          onMouseLeave={() => !isMobile && setIsFdvTooltipOpen(false)}
          onClick={() => {
            if (isMobile && fdvTriggerRef.current) setFdvTriggerRect(fdvTriggerRef.current.getBoundingClientRect());
            if (isMobile) setIsFdvTooltipOpen((o) => !o);
          }}
        >
          <Info className="h-2.5 w-2.5 shrink-0" aria-hidden />
        </button>
        {isMobile ? (
          <MobileTooltip
            isOpen={isFdvTooltipOpen}
            onClose={() => setIsFdvTooltipOpen(false)}
            title="FDV (B)"
            variant="purple"
          >
            {fdvTooltipContent}
          </MobileTooltip>
        ) : (
          <DesktopTooltip
            isOpen={isFdvTooltipOpen}
            alignLeft
            triggerRect={fdvTriggerRect}
            onMouseEnter={() => setIsFdvTooltipOpen(true)}
            onMouseLeave={() => setIsFdvTooltipOpen(false)}
            title="FDV (B)"
            variant="purple"
            hideTitle
          >
            {fdvTooltipContent}
          </DesktopTooltip>
        )}
      </div>
      <span className="shrink-0 whitespace-nowrap min-[470px]:hidden">to update</span>
      <span className="hidden shrink-0 whitespace-nowrap min-[470px]:inline">to update the incentive APR</span>
    </div>
  );

  const compactLayoutJsx = (
    <div className="flex flex-col gap-[var(--ds-space-2)]">
      {/* Header: Logo + Title + Info; tablet (sm+): same row as subtitle with input */}
      <div className="flex flex-col gap-1 sm:flex-row sm:flex-nowrap sm:items-center sm:gap-[var(--ds-space-2)]">
        <div className="flex items-center gap-[var(--ds-space-2)] shrink-0">
          <img
            src="/icons/networks/ink.svg"
            alt="INK"
            className="w-5 h-5 shrink-0"
          />
          <span className="ds-text-14 font-semibold text-foreground whitespace-nowrap">
            Ink incentive APR calculator
          </span>
          <InfoIconButton
            aria-label="Incentive APR formula"
            isOpen={isAprTooltipOpen}
            onToggle={() => setIsAprTooltipOpen((o) => !o)}
            onClose={() => setIsAprTooltipOpen(false)}
          >
            {(triggerRect) =>
              isMobile ? (
                <MobileTooltip
                  isOpen={isAprTooltipOpen}
                  onClose={() => setIsAprTooltipOpen(false)}
                  title="Incentive APR formula"
                >
                  <InkAprTooltipContent formatInkPrice={formatInkPrice} currentFdvBillions={currentFdvBillions} />
                </MobileTooltip>
              ) : (
                <DesktopTooltip
                  isOpen={isAprTooltipOpen}
                  alignLeft
                  triggerRect={triggerRect}
                  onMouseEnter={() => setIsAprTooltipOpen(true)}
                  onMouseLeave={() => setIsAprTooltipOpen(false)}
                  title="Incentive APR formula"
                >
                  <InkAprTooltipContent formatInkPrice={formatInkPrice} currentFdvBillions={currentFdvBillions} />
                </DesktopTooltip>
              )
            }
          </InfoIconButton>
        </div>
        {/* Tablet: subtitle with input on same line as title */}
        <div className="sm:min-w-0 sm:flex-1">{subtitleWithInput}</div>
      </div>

      {/* Slider - full width on its own row */}
      <div className="flex flex-col">
        <div
          ref={!isXl ? trackRef : undefined}
          className="relative h-2 rounded-full cursor-pointer select-none touch-none"
          style={{
            background: 'linear-gradient(to right, rgb(var(--ds-blue-500-rgb)), rgb(var(--ds-purple-500-rgb)), rgb(var(--ds-emerald-600-rgb)))',
          }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onKeyDown={handleKeyDown}
          role="slider"
          aria-valuemin={MIN_FDV}
          aria-valuemax={MAX_FDV}
          aria-valuenow={currentFdvBillions}
          aria-label="FDV slider"
          tabIndex={0}
        >
          {/* Reference point markers */}
          {displayPoints.map((point) => (
            <div
              key={`marker-${point.id}`}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-white dark:bg-card border-2 border-foreground/90 shadow-sm pointer-events-none"
              style={{ left: `${point.position}%` }}
            />
          ))}

          {/* Current value thumb - enlarged hit area for mobile touch */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-11 h-11 flex items-center justify-center cursor-pointer"
            style={{ left: `${sliderPosition}%` }}
          >
            <div
              className={`w-4 h-4 rounded-full border-2 border-white shadow-md pointer-events-none transition-all duration-150 ${
                isDragging ? 'scale-[1.4] shadow-lg ring-2 ring-white/30' : ''
              }`}
              style={{ background: positionToThumbColor(sliderPosition) }}
            />
          </div>

          {/* Tooltip with background - dynamic positioning based on drag state */}
          {(showTooltip || isDragging) && (
            <div
              className={`absolute ${isDragging ? '-top-10' : '-top-8'} -translate-x-1/2 bg-card/95 backdrop-blur-sm border border-border/50 rounded-md px-1.5 py-0.5 shadow-sm pointer-events-none z-20 transition-[top] duration-150`}
              style={{ left: `${sliderPosition}%` }}
            >
              <span className="text-foreground ds-text-11 font-semibold tabular-nums whitespace-nowrap">
                ${formatFdv(currentFdvBillions)}B
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Collapsible Reference section - tighter spacing to slider */}
      <Collapsible open={isReferenceOpen} onOpenChange={setIsReferenceOpen} className="mt-[var(--ds-space-0-5)] -mb-1">
        <CollapsibleTrigger className="flex items-center gap-[var(--ds-space-1-5)] ds-text-11 text-muted-foreground hover:text-foreground transition-colors w-full py-1.5">
          <ChevronDown 
            className={`w-3.5 h-3.5 transition-transform duration-200 ${isReferenceOpen ? 'rotate-180' : ''}`} 
          />
          <span>Reference FDVs</span>
          <span className="ds-text-11 text-muted-foreground/50">(CEX chain tokens)</span>
          <span className="ds-text-11 tabular-nums ml-auto">
            = $<span className={`transition-colors duration-300 ${fdvJustChanged ? 'text-[rgb(var(--ds-brand-magenta-rgb))]' : 'text-muted-foreground/50'}`}>{formatInkPrice(currentFdvBillions)}</span>/INK
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-1">
          <div className="flex flex-wrap gap-[var(--ds-space-2)]">
            {displayPoints.map((point) => {
              const isSelected = Math.abs(currentFdvBillions - point.fdv) < 0.02;
              const pointRgb = isSelected ? positionToThumbRgb(point.position) : null;
              return (
                <button
                  key={point.id}
                  onClick={() => handlePointClick(point.fdv)}
                  className={`inline-flex flex-col items-start gap-0.5 px-2.5 py-1.5 rounded-lg ds-text-11 transition-all duration-200 min-w-[72px] ${
                    isSelected
                      ? 'shadow-sm'
                      : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
                  }`}
                  style={pointRgb ? {
                    backgroundColor: `rgba(${pointRgb.r}, ${pointRgb.g}, ${pointRgb.b}, 0.12)`,
                    color: `rgb(${pointRgb.r}, ${pointRgb.g}, ${pointRgb.b})`,
                  } : undefined}
                >
                  <span className="font-semibold tabular-nums">${formatFdv(point.fdv)}</span>
                  {point.isDefault ? (
                    <span className="ds-text-10 opacity-70">Default</span>
                  ) : (
                    <>
                      <span className="ds-text-10 opacity-70">{point.exchange}</span>
                      <a
                        href={point.link}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-0.5 ds-text-9 opacity-60 hover:opacity-100 transition-opacity"
                      >
                        {point.chain}/{point.token}
                        <ExternalLink className="w-2.5 h-2.5" aria-hidden />
                      </a>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );

  return (
    <Card className="group border-border/60 bg-card transition-[border-color,box-shadow] hover:border-border hover:shadow-md">
      <CardContent className="p-[var(--ds-space-3)] md:p-[var(--ds-space-4)]">
        {isXl ? <FullLayout /> : compactLayoutJsx}
      </CardContent>
    </Card>
  );
};

export default InkAprCalculator;
