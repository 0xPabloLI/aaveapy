import { LayoutGrid, Table } from 'lucide-react';

interface HeaderProps {
  isLoading: boolean;
  viewMode: 'cards' | 'table';
  setViewMode: (mode: 'cards' | 'table') => void;
}

const Header = ({ viewMode, setViewMode }: HeaderProps) => {
  return (
    <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
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
    </header>
  );
};

export default Header;
