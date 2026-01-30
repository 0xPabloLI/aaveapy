import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useCoingeckoFdv } from '@/hooks/useCoingeckoFdv';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface InkAprCalculatorProps {
  rateInput: string;
  setRateInput: (value: string) => void;
  onRateChange?: (rate: number) => void;
}

const TOTAL_SUPPLY = 1_000_000_000;
const MIN_FDV = 0.1;
const MAX_FDV = 150;

interface ExchangeData {
  exchange: string;
  chain: string;
  token: string;
  defaultFdv: number;
  link: string;
}

const EXCHANGE_DATA: ExchangeData[] = [
  { exchange: 'OKX', chain: 'X Layer', token: 'OKB', defaultFdv: 2.1, link: 'https://www.coingecko.com/en/coins/okb' },
  { exchange: 'Bitget', chain: 'Morph', token: 'BGB', defaultFdv: 3.2, link: 'https://www.coingecko.com/en/coins/bitget-token' },
  { exchange: 'Bybit', chain: 'Mantle', token: 'MNT', defaultFdv: 5.0, link: 'https://www.coingecko.com/en/coins/mantle' },
  { exchange: 'Crypto.com', chain: 'Cronos', token: 'CRO', defaultFdv: 8.5, link: 'https://www.coingecko.com/en/coins/cronos' },
  { exchange: 'Binance', chain: 'BSC', token: 'BNB', defaultFdv: 115.8, link: 'https://www.coingecko.com/en/coins/bnb' },
];

function fdvToLogPosition(fdv: number): number {
  const minLog = Math.log10(MIN_FDV);
  const maxLog = Math.log10(MAX_FDV);
  const fdvLog = Math.log10(Math.max(MIN_FDV, Math.min(MAX_FDV, fdv)));
  return ((fdvLog - minLog) / (maxLog - minLog)) * 100;
}

function logPositionToFdv(position: number): number {
  const minLog = Math.log10(MIN_FDV);
  const maxLog = Math.log10(MAX_FDV);
  const fdvLog = minLog + (position / 100) * (maxLog - minLog);
  return Math.pow(10, fdvLog);
}

function formatInkPrice(fdvBillions: number): string {
  const price = (fdvBillions * 1e9) / TOTAL_SUPPLY;
  if (price >= 100) return price.toFixed(0);
  if (price >= 10) return price.toFixed(1);
  if (price >= 1) return price.toFixed(2);
  return price.toFixed(3);
}

function formatFdv(fdv: number): string {
  if (fdv >= 100) return fdv.toFixed(0);
  if (fdv >= 10) return fdv.toFixed(1);
  return fdv.toFixed(1);
}

const InkAprCalculator = ({
  rateInput,
  setRateInput,
  onRateChange,
}: InkAprCalculatorProps) => {
  const { data: fdvData } = useCoingeckoFdv();
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fdvInputValue, setFdvInputValue] = useState('1.0');

  const fdvBySymbol = useMemo(() => {
    return new Map(
      fdvData?.items
        .filter((item) => item.symbol)
        .map((item) => [item.symbol!.toUpperCase(), item.fdvUsd ? item.fdvUsd / 1e9 : null]) ?? []
    );
  }, [fdvData]);

  const exchangeDataWithLiveFdv = useMemo(() => {
    return EXCHANGE_DATA.map((ex) => ({
      ...ex,
      fdv: fdvBySymbol.get(ex.token) ?? ex.defaultFdv,
    }));
  }, [fdvBySymbol]);

  // Default to 1 billion if rateInput is empty or invalid
  const parsedRate = parseFloat(rateInput);
  const isValidRate = !Number.isNaN(parsedRate) && parsedRate >= 0;
  
  // If we have a valid rate input, calculate implied FDV. 
  // Otherwise default to 1B
  const currentFdvBillions = isValidRate 
    ? (parsedRate * TOTAL_SUPPLY) / 1e9 
    : 1.0;
    
  const sliderPosition = fdvToLogPosition(currentFdvBillions);

  useEffect(() => {
    // Only update the input value if it's significantly different to avoid cursor jumping
    // or if it's the initial load/reset
    const formatted = currentFdvBillions.toFixed(1);
    if (Math.abs(parseFloat(fdvInputValue) - currentFdvBillions) > 0.01) {
       setFdvInputValue(formatted);
    }
  }, [currentFdvBillions, fdvInputValue]);
  
  // Set default rate on mount if empty
  useEffect(() => {
    if (!rateInput || rateInput === '0') {
      const defaultPrice = (1.0 * 1e9) / TOTAL_SUPPLY;
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
    setFdvInputValue(value);
    const parsed = parseFloat(value);
    if (!Number.isNaN(parsed) && parsed > 0) {
      updateFromFdv(parsed);
    }
  }, [updateFromFdv]);

  const handleExchangeClick = useCallback((fdv: number) => {
    updateFromFdv(fdv);
  }, [updateFromFdv]);

  const handleTrackInteraction = useCallback((clientX: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const position = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const fdv = logPositionToFdv(position);
    updateFromFdv(fdv);
  }, [updateFromFdv]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    handleTrackInteraction(e.clientX);
  }, [handleTrackInteraction]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setIsDragging(true);
    handleTrackInteraction(e.touches[0].clientX);
  }, [handleTrackInteraction]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      handleTrackInteraction(e.clientX);
    };

    const handleTouchMove = (e: TouchEvent) => {
      handleTrackInteraction(e.touches[0].clientX);
    };

    const handleEnd = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, handleTrackInteraction]);

  return (
    <TooltipProvider>
      <Card className="border-border/60 bg-card">
        <CardContent className="p-[var(--ds-space-3)]">
          <div className="space-y-[var(--ds-space-2)]">
            {/* Row 1: Title (with description inline) and inputs */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-[var(--ds-space-2)]">
              <div className="flex items-center gap-[var(--ds-space-2)] flex-wrap">
                <div className="w-5 h-5 rounded-full bg-black dark:bg-white flex items-center justify-center shrink-0">
                  <img
                    src="/icons/networks/ink.svg"
                    alt="INK"
                    className="w-3.5 h-3.5 invert dark:invert-0"
                  />
                </div>
                <span className="ds-text-12 md:ds-text-13 font-semibold text-foreground">
                  Ink incentive APR calculator
                </span>
                <span className="ds-text-10 md:ds-text-11 text-muted-foreground">
                  enter estimated $INK FDV for TydroInkPoints APR
                </span>
              </div>

              <div className="flex items-center gap-[var(--ds-space-2)]">
                {/* FDV Input */}
                <div className="inline-flex items-center bg-muted/60 border border-transparent focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all rounded-md px-[var(--ds-space-2)] py-[var(--ds-space-1)] h-7">
                  <span className="ds-text-10 text-muted-foreground uppercase tracking-wide mr-1.5 font-medium">FDV</span>
                  <span className="ds-text-11 text-muted-foreground">$</span>
                  <Input
                    type="number"
                    min="0.1"
                    max="150"
                    step="0.1"
                    inputMode="decimal"
                    value={fdvInputValue}
                    onChange={handleFdvInputChange}
                    placeholder="1.0"
                    className="w-10 px-0 ds-text-11 font-medium tabular-nums bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/60 h-auto p-0 text-center"
                    aria-label="Estimated $INK FDV in billions"
                  />
                  <span className="ds-text-11 text-muted-foreground ml-0.5" title="Billions">B</span>
                </div>

                {/* INK Price */}
                <div className="inline-flex items-center gap-[var(--ds-space-1-5)] bg-primary/10 dark:bg-primary/20 rounded-md px-[var(--ds-space-2)] py-[var(--ds-space-1)] h-7">
                  <span className="ds-text-10 text-primary font-medium">INK</span>
                  <span className="ds-text-11 font-semibold tabular-nums text-foreground">
                    ${formatInkPrice(currentFdvBillions)}
                  </span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="APR formula"
                      >
                        <Info className="w-3 h-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                      <p className="ds-text-12 text-muted-foreground">
                        APR = daily points × $INK price × 365%
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>

            {/* Row 2: Slider */}
            <div className="relative pt-[var(--ds-space-8)] pb-[var(--ds-space-6)]">
              {/* Exchange labels + FDV values above slider */}
              <div className="absolute top-0 left-0 right-0 h-[var(--ds-space-6)]">
                {exchangeDataWithLiveFdv.map((ex) => {
                  const position = fdvToLogPosition(ex.fdv);
                  const isSelected = Math.abs(currentFdvBillions - ex.fdv) < 0.5;
                  return (
                    <div
                      key={ex.exchange}
                      onClick={(e) => {
                        e.preventDefault();
                        handleExchangeClick(ex.fdv);
                      }}
                      className={`absolute -translate-x-1/2 flex flex-col items-center gap-0 cursor-pointer group ${
                        isSelected ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                      }`}
                      style={{ left: `${position}%` }}
                      role="button"
                      aria-label={`Set FDV to ${ex.exchange} (${ex.fdv.toFixed(1)}B)`}
                    >
                      <span className={`ds-text-9 md:ds-text-10 font-medium whitespace-nowrap transition-colors ${
                        isSelected ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                      }`}>
                        {ex.exchange}
                      </span>
                      <span className={`ds-text-8 md:ds-text-9 tabular-nums whitespace-nowrap transition-colors ${
                        isSelected ? 'text-primary/80' : 'text-muted-foreground/60 group-hover:text-muted-foreground'
                      }`}>
                        ${formatFdv(ex.fdv)}B
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Current FDV indicator above slider */}
              <div
                className="absolute top-[var(--ds-space-4)] -translate-x-1/2 flex flex-col items-center z-10 pointer-events-none"
                style={{ left: `${sliderPosition}%` }}
              >
                <span className="ds-text-10 font-semibold tabular-nums text-primary whitespace-nowrap bg-card/80 px-1 rounded-sm backdrop-blur-[2px]">
                  ${formatFdv(currentFdvBillions)}B
                </span>
                <div className="w-px h-1.5 bg-primary/50" />
              </div>

              {/* Slider track */}
              <div
                ref={trackRef}
                className="relative h-1.5 rounded-full cursor-pointer select-none mt-1"
                style={{
                  background: 'linear-gradient(to right, #c242b1, #23cdbf)',
                }}
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
                role="slider"
                aria-valuemin={MIN_FDV}
                aria-valuemax={MAX_FDV}
                aria-valuenow={currentFdvBillions}
                aria-label="FDV slider"
                tabIndex={0}
              >
                {/* Reference point markers */}
                {exchangeDataWithLiveFdv.map((ex) => {
                  const position = fdvToLogPosition(ex.fdv);
                  return (
                    <div
                      key={`marker-${ex.exchange}`}
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-background border border-border pointer-events-none"
                      style={{ left: `${position}%` }}
                    />
                  );
                })}

                {/* Current value thumb */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-primary border-2 border-background shadow-sm pointer-events-none transition-transform hover:scale-110"
                  style={{ left: `${sliderPosition}%` }}
                />
              </div>

              {/* Chain labels below slider */}
              <div className="absolute bottom-0 left-0 right-0 h-[var(--ds-space-4)] mt-1.5">
                {exchangeDataWithLiveFdv.map((ex) => {
                  const position = fdvToLogPosition(ex.fdv);
                  return (
                    <a
                      key={`chain-${ex.exchange}`}
                      href={ex.link}
                      target="_blank"
                      rel="noreferrer"
                      className="absolute -translate-x-1/2 ds-text-8 md:ds-text-9 text-muted-foreground/70 hover:text-primary transition-colors whitespace-nowrap cursor-pointer z-10"
                      style={{ left: `${position}%` }}
                    >
                      {ex.chain}-{ex.token}
                    </a>
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};

export default InkAprCalculator;
