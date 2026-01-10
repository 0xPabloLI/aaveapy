import { Clock, ExternalLink } from 'lucide-react';
import { formatRelativeTime } from '@/lib/formatters';
import logo from '@/assets/logo.png';

interface HeaderProps {
  isLoading: boolean;
  lastUpdated?: string;
}

const Header = ({ lastUpdated }: HeaderProps) => {
  return (
    <header className="glass-card rounded-2xl p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Logo & Title */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 p-1 glow-primary">
              <img 
                src={logo} 
                alt="Aave APY Logo" 
                className="w-full h-full object-contain"
              />
            </div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-success border-2 border-background animate-pulse" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              <span className="gradient-text">Aave APY</span>
              <span className="text-muted-foreground ml-2 font-normal text-lg md:text-xl">Dashboard</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Find the best lending & borrowing opportunities across 17 chains
            </p>
          </div>
        </div>

        {/* Right side - Links & Status */}
        <div className="flex items-center gap-4">
          {/* Visit Aave */}
          <a
            href="https://app.aave.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20 hover:border-primary/40 transition-all duration-300 group"
          >
            <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
              Visit Aave
            </span>
            <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </a>

          {/* Last Updated */}
          {lastUpdated && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/50 border border-border/50">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs md:text-sm text-muted-foreground">
                {formatRelativeTime(lastUpdated)}
              </span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
