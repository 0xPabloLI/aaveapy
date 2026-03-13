import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { formatRelativeTime } from '@/lib/formatters';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import ThemeToggle from '@/components/ThemeToggle';

interface HeaderProps {
  lastUpdated?: string;
}

const Header = ({ lastUpdated }: HeaderProps) => {
  const [, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    if (!lastUpdated) return;

    const intervalId = window.setInterval(() => {
      setNowTick(Date.now());
    }, 60000);

    return () => window.clearInterval(intervalId);
  }, [lastUpdated]);

  return (
    <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-[var(--ds-space-3)] md:gap-[var(--ds-space-4)]">
      {/* Left side: Logo + Title + Mobile theme toggle */}
      <div className="flex items-center gap-[var(--ds-space-3)] md:gap-[var(--ds-space-4)]">
        <img src="/aave_apy_logo.png" alt="Aave APY logo" className="w-12 h-12 md:w-16 md:h-16 object-contain" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-[var(--ds-space-2)] flex-wrap">
            <h1 className="ds-title whitespace-nowrap">
              <span className="gradient-text">Aave APY</span>
            </h1>
            {/* Mobile: Last Updated as clickable icon; click opens small popover */}
            {lastUpdated && (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="md:hidden flex items-center justify-center w-6 h-6 rounded-full bg-card/60 border border-border/40 text-muted-foreground touch-manipulation hover:bg-muted/60 hover:border-border focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    aria-label={`Last updated ${formatRelativeTime(lastUpdated)}`}
                  >
                    <Clock className="w-3 h-3" />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="start" sideOffset={6} className="w-auto py-2 px-3 ds-text-11">
                  Updated {formatRelativeTime(lastUpdated)}
                </PopoverContent>
              </Popover>
            )}
          </div>
          <p className="ds-text-11 text-muted-foreground mt-[var(--ds-space-1)] sm:hidden">
            Find the best lending & leverage opportunities
          </p>
          <p className="ds-text-11 md:ds-text-14 text-muted-foreground mt-[var(--ds-space-1)] hidden sm:block">
            Find the best lending & leverage opportunities across 17 chains
          </p>
        </div>
        
        {/* Mobile: Theme toggle aligned with title */}
        <div className="md:hidden shrink-0 flex items-center gap-[var(--ds-space-2)]">
          <ThemeToggle />
        </div>
      </div>

      {/* Desktop Right side: Last Updated + Theme toggle */}
      <div className="hidden md:flex items-center gap-[var(--ds-space-3)]">
        {/* Desktop: Last Updated first */}
        {lastUpdated && (
          <div className="flex items-center gap-[var(--ds-space-2)] ds-text-11 text-muted-foreground shrink-0">
            <Clock className="w-4 h-4" />
            <span>Updated {formatRelativeTime(lastUpdated)}</span>
          </div>
        )}
        
        {/* Desktop: Theme Toggle */}
        <ThemeToggle />
      </div>
    </header>
  );
};

export default Header;
