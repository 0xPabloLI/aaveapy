import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useCoingeckoFdv } from '@/hooks/useCoingeckoFdv';

interface InkAprCalculatorProps {
  rateInput: string;
  setRateInput: (value: string) => void;
  onRateChange?: (rate: number) => void;
}

const TOTAL_SUPPLY = 1_000_000_000;
const MIN_FDV = 0.1;
const MAX_FDV = 150;
const DEFAULT_FDV = 1.0;

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
  const [showTooltip, setShowTooltip] = useState(false);
  const [fdvInputValue, setFdvInputValue] = useState('1.0');
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  const parsedRate = parseFloat(rateInput);
  const isValidRate = !Number.isNaN(parsedRate) && parsedRate >= 0;
  const currentFdvBillions = isValidRate 
    ? (parsedRate * TOTAL_SUPPLY) / 1e9 
    : DEFAULT_FDV;
  const sliderPosition = fdvToLogPosition(currentFdvBillions);
  const defaultPosition = fdvToLogPosition(DEFAULT_FDV);

  useEffect(() => {
    const formatted = currentFdvBillions.toFixed(1);
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
    setShowTooltip(true);
    if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
    handleTrackInteraction(e.clientX);
  }, [handleTrackInteraction]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
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
    window.addEventListener('touchmove', handleTouchMove);
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
      <CardContent className="p-[var(--ds-space-3)]">
        <div className="space-y-[var(--ds-space-2)]">
          {/* Row 1: Title, slider, formula, inputs */}
          <div className="flex flex-col lg:flex-row lg:items-center gap-[var(--ds-space-2)]">
            {/* Left: Logo + Title + Formula */}
            <div className="flex items-center gap-[var(--ds-space-2)] shrink-0">
              <img
                src="/icons/networks/ink.svg"
                alt="INK"
                className="w-5 h-5 shrink-0"
              />
              <span className="ds-text-12 md:ds-text-13 font-semibold text-foreground whitespace-nowrap">
                Ink incentive APR calculator
              </span>
              <span className="ds-text-9 text-muted-foreground font-mono whitespace-nowrap hidden sm:inline">
                APR = points × $INK × 365%
              </span>
            </div>

            {/* Center: Slider */}
            <div className="relative flex-1 min-w-[120px] lg:mx-4">
              <div
                ref={trackRef}
                className="relative h-1.5 rounded-full cursor-pointer select-none"
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
                {/* Default 1B marker */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none"
                  style={{ left: `${defaultPosition}%` }}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-foreground/60" />
                </div>

                {/* Reference point markers */}
                {exchangeDataWithLiveFdv.map((ex) => {
                  const position = fdvToLogPosition(ex.fdv);
                  return (
                    <div
                      key={`marker-${ex.exchange}`}
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-background border border-border/80 pointer-events-none"
                      style={{ left: `${position}%` }}
                    />
                  );
                })}

                {/* Current value thumb */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-foreground shadow-md pointer-events-none transition-transform"
                  style={{ left: `${sliderPosition}%` }}
                />

                {/* Tooltip popup on drag */}
                {showTooltip && (
                  <div
                    className="absolute -top-8 -translate-x-1/2 bg-foreground text-background px-1.5 py-0.5 rounded ds-text-10 font-semibold tabular-nums whitespace-nowrap shadow-md z-20 transition-opacity"
                    style={{ left: `${sliderPosition}%`, opacity: showTooltip ? 1 : 0 }}
                  >
                    ${formatFdv(currentFdvBillions)}B
                  </div>
                )}
              </div>

              {/* Default label below slider */}
              <div
                className="absolute top-2.5 -translate-x-1/2 ds-text-8 text-muted-foreground/60 whitespace-nowrap"
                style={{ left: `${defaultPosition}%` }}
              >
                default 1B
              </div>
            </div>

            {/* Right: Inputs */}
            <div className="flex items-center gap-[var(--ds-space-2)] shrink-0">
              <span className="ds-text-10 text-muted-foreground hidden md:inline">FDV</span>
              <div className="inline-flex items-center bg-muted/50 border border-border rounded px-1.5 py-0.5 h-6 focus-within:border-foreground/40 transition-colors">
                <span className="ds-text-10 text-muted-foreground">$</span>
                <Input
                  type="number"
                  min="0.1"
                  max="150"
                  step="0.1"
                  inputMode="decimal"
                  value={fdvInputValue}
                  onChange={handleFdvInputChange}
                  placeholder="1.0"
                  className="w-10 px-0.5 ds-text-10 font-medium tabular-nums bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/60 h-auto p-0 text-right"
                  aria-label="Estimated $INK FDV in billions"
                />
                <span className="ds-text-9 text-muted-foreground">B</span>
              </div>
              <div className="w-px h-3 bg-border" />
              <span className="ds-text-10 text-muted-foreground hidden md:inline">INK</span>
              <span className="ds-text-11 font-semibold tabular-nums text-foreground">
                ${formatInkPrice(currentFdvBillions)}
              </span>
            </div>
          </div>

          {/* Row 2: Reference points info */}
          <div className="flex items-start justify-between gap-[var(--ds-space-2)] overflow-x-auto pb-1">
            {exchangeDataWithLiveFdv.map((ex) => {
              const isSelected = Math.abs(currentFdvBillions - ex.fdv) < 0.5;
              return (
                <a
                  key={ex.exchange}
                  href={ex.link}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => {
                    e.preventDefault();
                    handleExchangeClick(ex.fdv);
                  }}
                  className={`flex flex-col items-center gap-0 cursor-pointer group transition-colors min-w-0 flex-1 ${
                    isSelected ? '' : 'hover:opacity-80'
                  }`}
                  aria-label={`Set FDV to ${ex.exchange} (${ex.fdv.toFixed(1)}B)`}
                >
                  <span className={`ds-text-9 md:ds-text-10 tabular-nums whitespace-nowrap font-medium ${
                    isSelected ? 'text-foreground' : 'text-muted-foreground'
                  }`}>
                    ${formatFdv(ex.fdv)}B
                  </span>
                  <span className={`ds-text-8 whitespace-nowrap underline decoration-dotted underline-offset-2 ${
                    isSelected ? 'text-foreground/70' : 'text-muted-foreground/50 group-hover:text-muted-foreground'
                  }`}>
                    {ex.chain}/{ex.token}
                  </span>
                  <span className={`ds-text-8 whitespace-nowrap ${
                    isSelected ? 'text-foreground/60' : 'text-muted-foreground/40'
                  }`}>
                    {ex.exchange}
                  </span>
                </a>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default InkAprCalculator;
