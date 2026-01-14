import { Clock } from 'lucide-react';
import { formatRelativeTime } from '@/lib/formatters';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface HeaderProps {
  lastUpdated?: string;
}

const Header = ({ lastUpdated }: HeaderProps) => {
  return (
    <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4">
      <div className="flex items-center gap-3 md:gap-4">
        <img src="/aave_apy_logo.svg" alt="Aave APY logo" className="w-12 h-12 md:w-16 md:h-16 object-contain" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl md:text-2xl lg:text-3xl font-bold whitespace-nowrap">
              <span className="gradient-text">Aave APY</span>
            </h1>
            {/* Mobile: Last Updated as icon with tooltip */}
            {lastUpdated && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="md:hidden flex items-center justify-center w-6 h-6 rounded-full bg-card/60 border border-border/40">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    Updated {formatRelativeTime(lastUpdated)}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 sm:hidden">
            Find the best opportunities
          </p>
          <p className="text-xs md:text-sm text-muted-foreground mt-0.5 hidden sm:block">
            Find the best lending & leverage opportunities across 17 chains
          </p>
        </div>
      </div>

      {/* Desktop: Last Updated */}
      {lastUpdated && (
        <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground shrink-0">
          <Clock className="w-4 h-4" />
          <span>Updated {formatRelativeTime(lastUpdated)}</span>
        </div>
      )}
    </header>
  );
};

export default Header;
