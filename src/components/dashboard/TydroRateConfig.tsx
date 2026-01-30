import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { TYDRO_POINT_TO_USD_RATE } from '@/lib/tydro';

interface TydroRateConfigProps {
  rateInput: string;
  setRateInput: (value: string) => void;
  onRateChange?: (rate: number) => void;
}

const DEFAULT_RATE = TYDRO_POINT_TO_USD_RATE;
const TOTAL_SUPPLY = 1_000_000_000;

function formatFdv(value: number): string {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

const TydroRateConfig = ({
  rateInput,
  setRateInput,
  onRateChange,
}: TydroRateConfigProps) => {
  const parsedRate = parseFloat(rateInput);
  const isValidRate = !Number.isNaN(parsedRate) && parsedRate >= 0;
  const isCustomRate = isValidRate && parsedRate !== DEFAULT_RATE;
  const estimatedFdv = isValidRate ? parsedRate * TOTAL_SUPPLY : null;
  const defaultFdv = formatFdv(DEFAULT_RATE * TOTAL_SUPPLY);
  const [fdvPulse, setFdvPulse] = useState(false);

  useEffect(() => {
    if (estimatedFdv === null) return;
    setFdvPulse(true);
    const timeout = setTimeout(() => setFdvPulse(false), 350);
    return () => clearTimeout(timeout);
  }, [estimatedFdv]);

  const handleInkPriceChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setRateInput(value);
    const parsed = parseFloat(value);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      onRateChange?.(parsed);
    }
  }, [setRateInput, onRateChange]);

  return (
    <div className="space-y-[var(--ds-space-3)]">
      <Card className="border-border/60 bg-card">
        <CardContent className="p-[var(--ds-space-4)] md:p-[var(--ds-space-5)]">
          <div className="space-y-[var(--ds-space-4)]">
            {/* Title */}
            <h3 className="ds-text-16 md:ds-text-18 font-semibold text-foreground">
              Ink incentive APR calculator
            </h3>

            <Collapsible defaultOpen>
              {/* Compact summary row */}
              <div className="flex items-center justify-between gap-[var(--ds-space-2)]">
                <div className="flex items-center gap-[var(--ds-space-2)] whitespace-nowrap overflow-x-auto">
                  <div className="flex items-center gap-[var(--ds-space-2)] ds-text-11 text-muted-foreground whitespace-nowrap">
                    <img
                      src="/icons/partners/inktoken.svg"
                      alt="Ink market"
                      className="w-4 h-4 shrink-0 invert dark:invert-0"
                    />
                    <span className="font-medium text-foreground">INK price</span>
                  </div>
                  <div className="inline-flex items-center gap-[var(--ds-space-1)] bg-muted/50 rounded-md px-[var(--ds-space-2)] py-[var(--ds-space-0-5)] whitespace-nowrap">
                    <span className="ds-text-12 text-muted-foreground">$</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={rateInput}
                      onChange={handleInkPriceChange}
                      placeholder="1.00"
                      className={`w-10 h-5 px-0 ds-text-11 font-medium tabular-nums bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/60 appearance-none [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                        isCustomRate ? 'text-[#6D28D9] dark:text-[#A78BFA]' : 'text-foreground'
                      }`}
                      aria-label="Estimated $INK price (USD)"
                    />
                  </div>
                  <div className="flex items-center gap-[var(--ds-space-2)]">
                    <span className="ds-text-11 font-medium text-muted-foreground">FDV</span>
                    <span
                      className={`ds-text-12 font-semibold tabular-nums transition-colors duration-300 ${
                        fdvPulse
                          ? 'text-[#6D28D9] dark:text-[#C4B5FD] animate-pulse'
                          : isCustomRate
                            ? 'text-[#6D28D9] dark:text-[#A78BFA]'
                            : 'text-foreground'
                      }`}
                    >
                      {estimatedFdv !== null ? formatFdv(estimatedFdv) : defaultFdv}
                    </span>
                  </div>
                </div>

                <CollapsibleTrigger
                  className="group inline-flex items-center gap-[var(--ds-space-1)] ds-text-11 text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
                  aria-label="Toggle details"
                >
                  <ChevronDown className="w-4 h-4 transition-transform group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
              </div>

              <CollapsibleContent className="mt-[var(--ds-space-2)] space-y-[var(--ds-space-3)]">
                {/* Description */}
                <p className="ds-text-12 md:ds-text-13 text-muted-foreground leading-relaxed">
                  Enter your estimated $INK price to see the incentive APR you could earn from TydroInkPoints across all Ink assets.
                </p>

                {/* Formula */}
                <div className="rounded-md border border-border/50 px-[var(--ds-space-2)] py-[var(--ds-space-1)]">
                  <div className="flex items-center gap-[var(--ds-space-2)]">
                    <Info className="w-4 h-4 text-muted-foreground shrink-0" />
                    <p className="ds-text-11 text-muted-foreground leading-relaxed">
                      APR = daily points x $INK price x 365%
                    </p>
                  </div>
                </div>

                {/* Reference data */}
                <div className="border-t border-border/50 pt-[var(--ds-space-3)]">
                  <div className="flex items-center gap-[var(--ds-space-1-5)] mb-[var(--ds-space-2)]">
                    <span className="ds-text-11 font-medium text-muted-foreground">Reference Data</span>
                  </div>
                  <div className="rounded-md border border-border/50 overflow-hidden">
                    <div className="grid grid-cols-4 gap-[var(--ds-space-2)] bg-muted/30 px-[var(--ds-space-2)] py-[var(--ds-space-1)] ds-text-9 text-muted-foreground/70 uppercase tracking-wide">
                      <span>Source</span>
                      <span>Token / Chain</span>
                      <span>FDV</span>
                      <span>Link</span>
                    </div>
                    <div className="grid grid-cols-4 gap-[var(--ds-space-2)] px-[var(--ds-space-2)] py-[var(--ds-space-2)]">
                      <div className="flex items-center gap-[var(--ds-space-1-5)]">
                        <img
                          src="/icons/partners/inktoken.svg"
                          alt="Ink market"
                          className="w-4 h-4 shrink-0"
                        />
                        <span className="ds-text-11 font-medium text-foreground">Ink Market</span>
                      </div>
                      <span className="ds-text-11 text-muted-foreground">$INK / Ink</span>
                      <span className="ds-text-11 font-semibold text-foreground tabular-nums">
                        {estimatedFdv !== null ? formatFdv(estimatedFdv) : defaultFdv}
                      </span>
                      <a
                        href="https://www.coingecko.com/"
                        target="_blank"
                        rel="noreferrer"
                        className="ds-text-11 text-primary hover:underline"
                        aria-label="Open CoinGecko"
                      >
                        CoinGecko
                      </a>
                    </div>
                    <div className="grid grid-cols-4 gap-[var(--ds-space-2)] px-[var(--ds-space-2)] py-[var(--ds-space-2)] border-t border-border/50 text-muted-foreground">
                      <span className="ds-text-11">Add more sources</span>
                      <span className="ds-text-11">Chains / tokens</span>
                      <span className="ds-text-11">FDV</span>
                      <span className="ds-text-11">Links</span>
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TydroRateConfig;
