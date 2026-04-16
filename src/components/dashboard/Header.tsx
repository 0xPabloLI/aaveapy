import { useEffect, useState } from 'react';
import { Clock, HelpCircle } from 'lucide-react';
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
      {/* Left side: Logo + Title + Updated */}
      <div className="flex items-center gap-[var(--ds-space-3)] md:gap-[var(--ds-space-4)]">
        <img src="/aave_apy_logo.png" alt="Aave APY logo" className="w-12 h-12 md:w-16 md:h-16 object-contain" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-[var(--ds-space-2)] flex-wrap">
            <h1 className="ds-title whitespace-nowrap">
              <span className="gradient-text">Aave APY</span>
            </h1>
            {/* Updated: always next to title */}
            {lastUpdated && (
              <span className="ds-text-11 text-muted-foreground shrink-0">
                Updated {formatRelativeTime(lastUpdated)}
              </span>
            )}
          </div>
          <p className="ds-text-11 text-muted-foreground mt-[var(--ds-space-1)] sm:hidden">
            Find the best lending & leverage opportunities
          </p>
          <p className="ds-text-11 md:ds-text-14 text-muted-foreground mt-[var(--ds-space-1)] hidden sm:block">
            Find the best lending & leverage opportunities across 17 chains
          </p>
        </div>
        
        {/* Mobile: FAQ + Theme toggle */}
        <div className="md:hidden shrink-0 flex items-center gap-[var(--ds-space-2)]">
          <a
            href="#faq"
            className="flex items-center justify-center w-8 h-8 rounded-full bg-card/60 border border-border/40 text-muted-foreground hover:bg-muted/60 hover:border-border touch-manipulation"
            aria-label="FAQ"
          >
            <HelpCircle className="w-4 h-4" />
          </a>
          <ThemeToggle />
        </div>
      </div>

      {/* Desktop Right side: FAQ + Theme toggle */}
      <div className="hidden md:flex items-center gap-[var(--ds-space-3)]">
        {/* Desktop: FAQ link with gradient hover */}
        <a
          href="#faq"
          className="flex items-center gap-[var(--ds-space-1)] ds-text-11 text-muted-foreground hover-gradient-text transition-colors shrink-0"
          aria-label="FAQ"
        >
          <HelpCircle className="w-4 h-4" />
          <span>FAQ</span>
        </a>
        
        {/* Desktop: Theme Toggle */}
        <ThemeToggle />
      </div>
    </header>
  );
};

export default Header;
