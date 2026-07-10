import { useEffect, useState } from 'react';
import { Clock, HelpCircle } from 'lucide-react';
import { formatRelativeTime } from '@/lib/formatters';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import ThemeToggle from '@/components/ThemeToggle';
import { useWatchModeConnect } from '@/hooks/useWatchModeConnect';
import { WalletButton } from './WalletButton';
import {
  HEADER_CONTROL_AFFORDANCE_ICON_CLASS,
  HEADER_CONTROL_DESKTOP_CLASS,
  HEADER_CONTROL_ICON_CLASS,
  HEADER_CONTROL_MOBILE_CLASS,
} from '@/lib/headerControlStyles';
import { cn } from '@/lib/utils';

interface HeaderProps {
  lastUpdated?: string;
  chainCount?: number;
}

const Header = ({ lastUpdated, chainCount }: HeaderProps) => {
  const [, setNowTick] = useState(() => Date.now());
  const { connectWatchAddress } = useWatchModeConnect();

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
        <img src="/aave_apy_logo.png" alt="AaveAPY logo" className="w-12 h-12 md:w-16 md:h-16 object-contain" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-[var(--ds-space-2)] flex-wrap">
            <h1 className="ds-title whitespace-nowrap">
              <span className="gradient-text">AaveAPY</span>
            </h1>
            {/* Desktop: Updated text with clock icon next to title */}
            {lastUpdated && (
              <span className="hidden md:inline-flex items-center gap-[var(--ds-space-1)] ds-text-11 text-muted-foreground shrink-0">
                <Clock className="w-3 h-3" />
                Updated {formatRelativeTime(lastUpdated)}
              </span>
            )}
          </div>
          <p className="ds-text-11 text-muted-foreground mt-[var(--ds-space-1)] sm:hidden">
            Find the best lending & leverage opportunities
          </p>
          <p className="ds-text-11 md:ds-text-14 text-muted-foreground mt-[var(--ds-space-1)] hidden sm:block">
            Find the best lending & leverage opportunities across {chainCount ?? 17} chains
          </p>
        </div>
        
        {/* Mobile: Updated clock + Wallet + FAQ + Theme toggle */}
        <div className="md:hidden shrink-0 flex items-center gap-[var(--ds-space-2)]">
          {lastUpdated && (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={HEADER_CONTROL_MOBILE_CLASS}
                  aria-label={`Last updated ${formatRelativeTime(lastUpdated)}`}
                >
                  <Clock className={HEADER_CONTROL_AFFORDANCE_ICON_CLASS} />
                </button>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="start" sideOffset={6} className="w-auto py-2 px-3 ds-text-11">
                Updated {formatRelativeTime(lastUpdated)}
              </PopoverContent>
            </Popover>
          )}
          <WalletButton mobile onWatchSubmit={connectWatchAddress} />
          <a
            href="#faq"
            className={cn(HEADER_CONTROL_MOBILE_CLASS, 'hover-gradient-text')}
            aria-label="FAQ"
          >
            <HelpCircle className={HEADER_CONTROL_ICON_CLASS} />
          </a>
          <ThemeToggle />
        </div>
      </div>

      {/* Desktop Right side: Wallet + FAQ + Theme toggle */}
      <div className="hidden md:flex items-center gap-[var(--ds-space-3)]">
        <WalletButton onWatchSubmit={connectWatchAddress} />
        {/* Desktop: FAQ link with gradient hover */}
        <a
          href="#faq"
          className={cn(HEADER_CONTROL_DESKTOP_CLASS, 'group shrink-0')}
          aria-label="FAQ"
        >
          <HelpCircle
            className={cn(HEADER_CONTROL_ICON_CLASS, 'transition-colors group-hover:text-[hsl(var(--ds-gradient-primary))]')}
          />
          <span className="group-hover-gradient-text">FAQ</span>
        </a>
        
        {/* Desktop: Theme Toggle */}
        <ThemeToggle />
      </div>
    </header>
  );
};

export default Header;
