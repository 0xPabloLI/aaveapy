import { AlertTriangle, Clock, LayoutGrid, Table } from 'lucide-react';
import { formatRelativeTime } from '@/lib/formatters';

interface HeaderProps {
  lastUpdated?: string;
  isStale?: boolean;
  isLoading: boolean;
  viewMode: 'cards' | 'table';
  setViewMode: (mode: 'cards' | 'table') => void;
}

const Header = ({ lastUpdated, isStale, isLoading, viewMode, setViewMode }: HeaderProps) => {
  return (
    <header className="space-y-6">
      {/* Logo and title */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center glow-primary">
              <span className="text-2xl font-black text-white">A</span>
            </div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-success border-2 border-background" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">
              <span className="gradient-text">Aave APY</span>
              <span className="text-muted-foreground ml-2 font-normal text-xl">Dashboard</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              Find the best lending & borrowing opportunities across 17 chains
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex bg-card/50 rounded-lg p-1 border border-border/50">
            <button
              onClick={() => setViewMode('cards')}
              className={`p-2 rounded-md transition-all ${
                viewMode === 'cards'
                  ? 'bg-gradient-to-r from-primary to-secondary text-white'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-md transition-all ${
                viewMode === 'table'
                  ? 'bg-gradient-to-r from-primary to-secondary text-white'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Table className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex flex-wrap items-center gap-4 text-sm">
        {lastUpdated && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="w-4 h-4" />
            Updated {formatRelativeTime(lastUpdated)}
          </div>
        )}
        {isStale && (
          <div className="flex items-center gap-2 text-warning bg-warning/10 px-3 py-1 rounded-full">
            <AlertTriangle className="w-4 h-4" />
            Data may be stale
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
