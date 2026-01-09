import { TrendingUp, Coins, Activity, Clock } from 'lucide-react';
import { MarketWithSpread } from '@/types/aave';
import { formatPercent, formatRelativeTime } from '@/lib/formatters';

interface StatsCardsProps {
  markets?: MarketWithSpread[];
  isLoading: boolean;
  lastUpdated?: string;
}

const StatsCards = ({ markets, isLoading, lastUpdated }: StatsCardsProps) => {
  const avgSupplyApy = markets?.length 
    ? markets.reduce((acc, m) => acc + m.totalSupplyApy, 0) / markets.length 
    : 0;
  const avgBorrowApy = markets?.length 
    ? markets.filter(m => m.totalBorrowApy !== null).reduce((acc, m) => acc + (m.totalBorrowApy || 0), 0) / markets.filter(m => m.totalBorrowApy !== null).length 
    : 0;
  const loopingOpportunities = markets?.filter(m => m.apySpread !== null && m.apySpread < 0).length || 0;

  const statItems = [
    {
      label: 'Avg Supply APY',
      value: isLoading ? '-' : formatPercent(avgSupplyApy),
      icon: TrendingUp,
      color: 'from-success to-secondary'
    },
    {
      label: 'Avg Borrow APY',
      value: isLoading ? '-' : formatPercent(avgBorrowApy),
      icon: Coins,
      color: 'from-secondary to-primary'
    },
    {
      label: 'Looping Opportunities',
      value: isLoading ? '-' : loopingOpportunities.toString(),
      icon: Activity,
      color: 'from-warning to-primary'
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {statItems.map((item) => (
        <div
          key={item.label}
          className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-4 hover:border-primary/30 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${item.color} flex items-center justify-center`}>
              <item.icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="text-lg font-bold">{item.value}</p>
            </div>
          </div>
        </div>
      ))}
      
      {/* Updated time card */}
      {lastUpdated && (
        <div className="bg-card/30 backdrop-blur-sm border border-border/30 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center">
            <Clock className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Last Updated</p>
            <p className="text-sm font-medium">{formatRelativeTime(lastUpdated)}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default StatsCards;