// @vitest-environment happy-dom
import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import FilterBar from './FilterBar';
import type { TokenCategory } from '@/types/aave';

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}));

vi.mock('@/components/dashboard/AprApyToggle', () => ({
  default: () => <div data-testid="apr-apy-toggle" />,
}));

function TestWrapper({
  initialCategory = 'all' as TokenCategory,
  initialMarkets = [] as string[],
  initialHubs = [] as string[],
}: {
  initialCategory?: TokenCategory;
  initialMarkets?: string[];
  initialHubs?: string[];
}) {
  const [category, setCategory] = useState<TokenCategory>(initialCategory);
  const [markets, setMarkets] = useState<string[]>(initialMarkets);
  const [hubs, setHubs] = useState<string[]>(initialHubs);
  const [searchQuery, setSearchQuery] = useState('');
  const [isApy, setIsApy] = useState(true);

  return (
    <FilterBar
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      selectedMarkets={markets}
      setSelectedMarkets={setMarkets}
      selectedCategory={category}
      setSelectedCategory={setCategory}
      isApy={isApy}
      setIsApy={setIsApy}
      marketsList={[
        { marketName: 'AaveV3Ethereum', chainName: 'Ethereum' },
        { marketName: 'AaveV3Arbitrum', chainName: 'Arbitrum' },
      ]}
      hubNames={['Core', 'Prime']}
      selectedHubs={hubs}
      setSelectedHubs={setHubs}
    />
  );
}

describe('FilterBar', () => {
  it('renders token category chips with ds-chip class', () => {
    render(<TestWrapper />);

    const tokensRow = screen.getAllByTestId('tokens-row')[0];
    const tokenLabels = ['All', 'Stables', 'ETH', 'BTC', 'Pendle'];
    tokenLabels.forEach((label) => {
      const chip = within(tokensRow).getByRole('button', { name: label });
      expect(chip.className).toContain('ds-chip');
      expect(chip.className).toContain('font-medium');
    });
  });

  it('renders Markets All chip with ds-chip class', () => {
    render(<TestWrapper />);

    const marketsRow = screen.getAllByTestId('markets-row')[0];
    const allChip = within(marketsRow).getByRole('button', { name: 'All' });
    expect(allChip.className).toContain('ds-chip');
  });

  it('renders hub chips with ds-chip class when hubs exist', () => {
    render(<TestWrapper />);

    const marketsRow = screen.getAllByTestId('markets-row')[0];
    const hubButton = within(marketsRow).getByRole('radio', { name: 'Hub' });
    fireEvent.click(hubButton);

    ['Core', 'Prime'].forEach((hub) => {
      const chip = within(marketsRow).getByRole('button', { name: hub });
      expect(chip.className).toContain('ds-chip');
      expect(chip.className).toContain('font-medium');
    });
  });

  it('toggles token category selection', () => {
    render(<TestWrapper />);

    const tokensRow = screen.getAllByTestId('tokens-row')[0];
    const stableChip = within(tokensRow).getByRole('button', { name: 'Stables' });
    expect(stableChip.className).toContain('bg-card/50');

    fireEvent.click(stableChip);
    expect(stableChip.className).toContain('bg-card');
    expect(stableChip.className).toContain('border-[rgb(var(--ds-brand-magenta-rgb))]');

    fireEvent.click(stableChip);
    expect(stableChip.className).toContain('bg-card/50');
  });

  it('does not use ad-hoc h-7 inline-flex class on filter chips', () => {
    render(<TestWrapper />);

    const tokensRow = screen.getAllByTestId('tokens-row')[0];
    const marketsRow = screen.getAllByTestId('markets-row')[0];

    const tokenChips = ['All', 'Stables', 'ETH', 'BTC', 'Pendle'].map((label) =>
      within(tokensRow).getByRole('button', { name: label })
    );
    const allChip = within(marketsRow).getByRole('button', { name: 'All' });

    [...tokenChips, allChip].forEach((chip) => {
      expect(chip.className).not.toContain('h-7');
      expect(chip.className).not.toContain('inline-flex items-center justify-center h-7');
    });
  });
});
