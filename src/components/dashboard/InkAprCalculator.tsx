import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { InfoIconButton, DesktopTooltip, MobileTooltip } from '@/components/dashboard/AprApyToggle';
import { useCoingeckoFdv } from '@/hooks/useCoingeckoFdv';
import { useIsMobile } from '@/hooks/use-mobile';

interface InkAprCalculatorProps {
  rateInput: string;
  setRateInput: (value: string) => void;
  onRateChange?: (rate: number) => void;
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
function positionToThumbColor(positionPercent: number): string {
  const p = Math.max(0, Math.min(100, positionPercent)) / 100;
  let r: number;
  let g: number;
  let b: number;
  if (p <= 0.5) {
    const t = p * 2; // 0..1 over first half
    r = 59 + (168 - 59) * t;
    g = 130 + (85 - 130) * t;
    b = 246 + (247 - 246) * t;
  } else {
    const t = (p - 0.5) * 2; // 0..1 over second half
    r = 168 + (5 - 168) * t;
    g = 85 + (150 - 85) * t;
    b = 247 + (105 - 247) * t;
  }
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
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
}: InkAprCalculatorProps) => {
  const { data: fdvData } = useCoingeckoFdv();
  const isMobile = useIsMobile();
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [isAprTooltipOpen, setIsAprTooltipOpen] = useState(false);
  const [fdvInputValue, setFdvInputValue] = useState('1.00');
  const [pillHoveredPointId, setPillHoveredPointId] = useState<string | null>(null);
  const [linkHoveredPointId, setLinkHoveredPointId] = useState<string | null>(null);
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  useEffect(() => {
    const formatted = currentFdvBillions.toFixed(2);
    if (Math.abs(parseFloat(fdvInputValue) - currentFdvBillions) > 0.01) {
       setFdvInputValue(formatted);
    }
  }, [currentFdvBillions, fdvInputValue]);
  
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
    const value = e.target.value;
    const trimmed = value.trim();
    const parsed = parseFloat(value);
    if (trimmed === '' || Number.isNaN(parsed) || parsed <= 0) {
      setFdvInputValue('1.00');
      updateFromFdv(DEFAULT_FDV);
      return;
    }
    setFdvInputValue(value);
    updateFromFdv(parsed);
  }, [updateFromFdv]);

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
    setShowTooltip(true);
    if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
    handleTrackInteraction(e.clientX);
  }, [handleTrackInteraction]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setShowTooltip(true);
    if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
    handleTrackInteraction(e.touches[0].clientX);
  }, [handleTrackInteraction]);

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
  }, [isDragging, handleTrackInteraction]);

  useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
    };
  }, []);

  return (
    <Card className="border-border/60 bg-card">
      <CardContent className="p-[var(--ds-space-2)] md:p-[var(--ds-space-3)]">
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
              </div>
              <div className="flex items-center justify-center">
                <div className="flex flex-wrap items-center justify-center gap-1.5 text-muted-foreground text-center">
                  <span className="ds-text-11">
                    Enter your estimated $INK FDV to update the incentive{' '}
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                      APR
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
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {/* Center: Slider - aligned with title row */}
            <div className="relative flex-1 min-w-[120px] lg:ml-4 lg:mr-6 lg:pt-[0.375rem]">
              <div className="flex items-center gap-1.5">
                <div className="flex items-center justify-center w-14">
                  <span className="ds-text-11 md:ds-text-12 text-muted-foreground font-semibold tracking-wide">
                    FDV (B)
                  </span>
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
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full border-2 border-white/90 shadow-md pointer-events-none transition-colors duration-150"
                  style={{
                    left: `${sliderPosition}%`,
                    background: positionToThumbColor(sliderPosition),
                  }}
                />

                {/* Tooltip: floating number only, no background box */}
                {(showTooltip || isDragging) && (
                  <div
                    className="absolute -top-5 -translate-x-1/2 text-foreground ds-text-13 font-semibold tabular-nums whitespace-nowrap z-20"
                    style={{ left: `${sliderPosition}%` }}
                  >
                    ${formatFdv(currentFdvBillions)}
                  </div>
                )}
                </div>
              </div>
            </div>

          </div>

          {/* Bottom Row: space above labels = space below tallest label to card bottom. pointer-events-none so overlay does not block slider; auto on inputs/labels. */}
          <div className="flex items-center gap-[var(--ds-space-2)] -mt-14 min-h-[3.5rem] pointer-events-none">
            <div className="shrink-0 hidden lg:block w-[240px]" aria-hidden />
            {/* Wrapper: content shifted down slightly so space(slider→labels) ≈ space(labels bottom→card bottom) */}
            <div className="relative flex-1 min-w-[120px] lg:ml-4 lg:mr-6 flex flex-col justify-center min-h-[3.5rem] pt-2 pointer-events-none">
              <div className="flex items-start gap-1.5 pointer-events-none">
                <div className="hidden lg:flex w-14 shrink-0 items-center justify-center pt-0.5 pointer-events-auto">
                  <span className="inline-flex items-center bg-muted/30 border border-border/70 rounded-md px-1.5 py-0.5 h-6 align-middle focus-within:border-foreground/40 transition-colors">
                    <span className="ds-text-11 text-muted-foreground">$</span>
                    <Input
                      type="number"
                      min="0"
                      max="120"
                      step="0.01"
                      inputMode="decimal"
                      value={fdvInputValue}
                      onChange={handleFdvInputChange}
                      placeholder="1.00"
                      className="w-10 px-0.5 ds-text-11 font-medium tabular-nums bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/60 h-auto p-0 text-left appearance-none [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      aria-label="Estimated $INK FDV in billions"
                    />
              </span>
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
                return (
                  <div
                    key={point.id}
                    onClick={() => handlePointClick(point.fdv)}
                    className="absolute flex flex-col items-center justify-start pt-0.5 h-full cursor-pointer pointer-events-auto rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                    style={{ left: `${point.position}%`, transform: 'translateX(-50%)' }}
                    role="button"
                    aria-label={point.isDefault ? `Set FDV to default (${point.fdv})` : `Set FDV to ${point.exchange} (${point.fdv.toFixed(2)})`}
                  >
                    <div className="flex flex-col items-center leading-none gap-[var(--ds-space-0-5)]">
                      {/* Pill: only top two lines (FDV + exchange/Default), py-0 so line spacing equals gap to line 3 */}
                      <div
                        onMouseEnter={() => setPillHoveredPointId(point.id)}
                        onMouseLeave={() => setPillHoveredPointId(null)}
                        className={`rounded-md px-[var(--ds-space-1-5)] py-0 flex flex-col items-center leading-none gap-[var(--ds-space-0-5)] transition-all duration-200 ${
                          isSelected
                            ? 'border border-[rgb(var(--ds-brand-magenta-rgb))] shadow-sm ds-bg-brand-magenta-10 ds-text-brand-magenta'
                            : pillHoveredPointId === point.id && linkHoveredPointId !== point.id
                              ? 'ring-1 ring-border shadow-sm bg-muted/50'
                              : ''
                        }`}
                      >
                        <span className={`ds-text-10 md:ds-text-11 tabular-nums whitespace-nowrap font-medium leading-none ${
                          isSelected ? 'ds-text-brand-magenta' : 'text-muted-foreground'
                        }`}>
                          ${formatFdv(point.fdv)}
                        </span>
                        {point.isDefault ? (
                          <span className={`ds-text-9 md:ds-text-10 whitespace-nowrap leading-none ${
                            isSelected ? 'ds-text-brand-magenta/90' : 'text-muted-foreground/50'
                          }`}>
                            Default
                          </span>
                        ) : (
                          <span className={`ds-text-9 md:ds-text-10 whitespace-nowrap leading-none ${
                            isSelected ? 'ds-text-brand-magenta/90' : 'text-muted-foreground/40'
                          }`}>
                            {point.exchange}
                          </span>
                        )}
                      </div>
                      {/* Third line: chain/token link, outside the pill */}
                      {!point.isDefault && (
                        <a
                          href={point.link}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          onMouseEnter={() => setLinkHoveredPointId(point.id)}
                          onMouseLeave={() => setLinkHoveredPointId(null)}
                          title="Open CoinGecko (new tab)"
                          className={`inline-flex items-center gap-0.5 ds-text-9 md:ds-text-10 whitespace-nowrap leading-none transition-colors ${
                            linkHoveredPointId === point.id
                              ? 'text-foreground'
                              : isSelected
                                ? 'ds-text-brand-magenta/90 hover:text-foreground'
                                : 'text-muted-foreground/50 hover:text-foreground'
                          }`}
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
      </CardContent>
    </Card>
  );
};

export default InkAprCalculator;
