import { Clock } from 'lucide-react';
import { formatRelativeTime } from '@/lib/formatters';

interface HeaderProps {
  isLoading: boolean;
  lastUpdated?: string;
}

const Header = ({ lastUpdated }: HeaderProps) => {
  return (
    <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div className="flex items-center gap-4">
        <img src="/aave_apy_logo.svg" alt="Aave APY logo" className="w-16 h-16 object-contain" />
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">
            <span className="gradient-text">Aave APY</span>
            <span className="text-muted-foreground ml-2 font-normal text-xl">Dashboard</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Find the best lending & leverage opportunities across 17 chains
          </p>
        </div>
      </div>

      {/* Last Updated */}
      {lastUpdated && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span>Updated {formatRelativeTime(lastUpdated)}</span>
        </div>
      )}
    </header>
  );
};

export default Header;
