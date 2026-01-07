import { TrendingUp, Layers, Coins, Activity } from 'lucide-react';
import { MarketStats, MarketWithSpread } from '@/types/aave';
import { formatPercent } from '@/lib/formatters';
interface StatsCardsProps {
  stats?: MarketStats;
  markets?: MarketWithSpread[];
  isLoading: boolean;
}
const StatsCards = ({
  stats,
  markets,
  isLoading
}: StatsCardsProps) => {
  const avgSupplyApy = markets?.length ? markets.reduce((acc, m) => acc + m.totalSupplyApy, 0) / markets.length : 0;
  const avgBorrowApy = markets?.length ? markets.filter(m => m.totalBorrowApy !== null).reduce((acc, m) => acc + (m.totalBorrowApy || 0), 0) / markets.filter(m => m.totalBorrowApy !== null).length : 0;
  const loopingOpportunities = markets?.filter(m => m.apySpread !== null && m.apySpread < 0).length || 0;
  const statItems = [{
    label: 'Total Markets',
    value: isLoading ? '-' : stats?.totalTokens.toString() || '0',
    icon: Layers,
    color: 'from-primary to-secondary'
  }, {
    label: 'Avg Supply APY',
    value: isLoading ? '-' : formatPercent(avgSupplyApy),
    icon: TrendingUp,
    color: 'from-success to-secondary'
  }, {
    label: 'Avg Borrow APY',
    value: isLoading ? '-' : formatPercent(avgBorrowApy),
    icon: Coins,
    color: 'from-secondary to-primary'
  }, {
    label: 'Looping Opportunities',
    value: isLoading ? '-' : loopingOpportunities.toString(),
    icon: Activity,
    color: 'from-warning to-primary'
  }];
  return <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {statItems.map(item => {})}
    </div>;
};
export default StatsCards;