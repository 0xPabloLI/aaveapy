import { Clock, ExternalLink } from 'lucide-react';
import { formatRelativeTime } from '@/lib/formatters';
import logo from '@/assets/logo.png';

interface HeaderProps {
  isLoading: boolean;
  lastUpdated?: string;
}

const Header = ({ lastUpdated }: HeaderProps) => {
  return (
    <header className="glass-card rounded-2xl p-3 md:p-5">
      <div className="flex items-center justify-between gap-3">
        {/* Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-card to-card/80 border border-border/50 p-1.5 shadow-sm">
              <img 
                src={logo} 
                alt="Aave APY" 
                className="w-full h-full object-contain"
              />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-success border-2 border-card" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg md:text-xl font-bold tracking-tight">
              <span className="gradient-text">Aave APY</span>
              <span className="hidden sm:inline text-muted-foreground ml-1.5 font-normal text-sm md:text-base">Dashboard</span>
            </h1>
            <p className="text-xs text-muted-foreground hidden sm:block">
              Best rates across 17 chains
            </p>
          </div>
        </div>

        {/* Right side - Links & Status */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* Last Updated */}
          {lastUpdated && (
            <div className="flex items-center gap-1.5 px-2 py-1 md:px-2.5 md:py-1.5 rounded-lg bg-muted/30 border border-border/30">
              <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              <Clock className="w-3 h-3 text-muted-foreground hidden sm:block" />
              <span className="text-[10px] md:text-xs text-muted-foreground">
                {formatRelativeTime(lastUpdated)}
              </span>
            </div>
          )}

          {/* Visit Aave */}
          <a
            href="https://app.aave.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-2.5 py-1 md:px-3 md:py-1.5 rounded-lg bg-primary/10 border border-primary/20 hover:border-primary/40 hover:bg-primary/15 transition-all duration-200 group"
          >
            <span className="text-xs font-medium text-primary">
              <span className="hidden sm:inline">Visit </span>Aave
            </span>
            <ExternalLink className="w-3 h-3 text-primary/70 group-hover:text-primary transition-colors" />
          </a>
        </div>
      </div>
    </header>
  );
};

export default Header;
