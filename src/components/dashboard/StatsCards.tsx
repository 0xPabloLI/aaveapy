import { TrendingUp, Layers, Coins, Activity } from 'lucide-react';
import { MarketStats, MarketWithSpread } from '@/types/aave';
import { formatPercent } from '@/lib/formatters';

interface StatsCardsProps {
  stats?: MarketStats;
  markets?: MarketWithSpread[];
  isLoading: boolean;
}

const StatsCards = ({ stats, markets, isLoading }: StatsCardsProps) => {
  const avgSupplyApy = markets?.length
    ? markets.reduce((acc, m) => acc + m.totalSupplyApy, 0) / markets.length
    : 0;
  
  const avgBorrowApy = markets?.length
    ? markets.filter(m => m.totalBorrowApy !== null).reduce((acc, m) => acc + (m.totalBorrowApy || 0), 0) / 
      markets.filter(m => m.totalBorrowApy !== null).length
    : 0;

  const loopingOpportunities = markets?.filter(m => m.apySpread !== null && m.apySpread < 0).length || 0;

  const statItems = [
    {
      label: 'Total Markets',
      value: isLoading ? '-' : stats?.totalTokens.toString() || '0',
      icon: Layers,
      color: 'from-primary to-secondary',
    },
    {
      label: 'Avg Supply APY',
      value: isLoading ? '-' : formatPercent(avgSupplyApy),
      icon: TrendingUp,
      color: 'from-success to-secondary',
    },
    {
      label: 'Avg Borrow APY',
      value: isLoading ? '-' : formatPercent(avgBorrowApy),
      icon: Coins,
      color: 'from-secondary to-primary',
    },
    {
      label: 'Looping Opportunities',
      value: isLoading ? '-' : loopingOpportunities.toString(),
      icon: Activity,
      color: 'from-warning to-primary',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {statItems.map((item) => (
        <div
          key={item.label}
          className="glass-card rounded-xl p-4 md:p-6 relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300"
        >
          <div className={`absolute inset-0 bg-gradient-to-br ${item.color} opacity-5 group-hover:opacity-10 transition-opacity`} />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <item.icon className="w-5 h-5 text-muted-foreground" />
              <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${item.color} animate-pulse`} />
            </div>
            <p className="text-2xl md:text-3xl font-bold gradient-text">
              {item.value}
            </p>
            <p className="text-xs md:text-sm text-muted-foreground mt-1">
              {item.label}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default StatsCards;
