// @vitest-environment happy-dom
import { act, useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import FilterBar from './FilterBar';
import type { TokenCategory } from '@/types/aave';

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}));

vi.mock('@/components/dashboard/AprApyToggle', () => ({
  default: () => <div data-testid="apr-apy-toggle" />,
}));

afterEach(() => {
  cleanup();
});

const AVALANCHE_MULTI_MARKETS = [
  { marketName: 'AaveV3Avalanche', chainName: 'Avalanche', chainId: 43114 },
  { marketName: 'AaveV4AvalancheMain', chainName: 'Avalanche', chainId: 43114 },
  { marketName: 'AaveV4AvalancheForex', chainName: 'Avalanche', chainId: 43114 },
];

function TestWrapper({
  marketsList = AVALANCHE_MULTI_MARKETS,
}: {
  marketsList?: { marketName: string; chainName: string; chainId: number }[];
}) {
  const [markets, setMarkets] = useState<string[]>([]);
  const [category, setCategory] = useState<TokenCategory>('all');
  const [hubs, setHubs] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isApy, setIsApy] = useState(true);
  const [internalExpandedChain, setInternalExpandedChain] = useState<string | null>(null);

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
      marketsList={marketsList}
      hubEntries={[{ id: 'hub-core', name: 'Core' }, { id: 'hub-prime', name: 'Prime' }]}
      selectedHubs={hubs}
      setSelectedHubs={setHubs}
      expandedChain={internalExpandedChain}
      setExpandedChain={setInternalExpandedChain}
    />
  );
}

function getExpandButton(chainName: string) {
  return screen.getAllByTitle(`Expand ${chainName} markets`)[0];
}

function getCollapseButton(chainName: string) {
  return screen.getAllByTitle(`Collapse ${chainName} markets`)[0];
}

describe('FilterBar multi-chain expandable', () => {
  it('shows expand button for Avalanche with V3 + V4 markets', () => {
    render(<TestWrapper />);

    const expandButton = getExpandButton('Avalanche');
    expect(expandButton).toBeInTheDocument();
    expect(expandButton).toHaveAttribute('title', 'Expand Avalanche markets');
  });

  it('expands Avalanche sub-markets and shows V3 + V4 chips', () => {
    render(<TestWrapper />);

    fireEvent.click(getExpandButton('Avalanche'));

    expect(getCollapseButton('Avalanche')).toBeInTheDocument();
    expect(screen.getAllByTitle('AaveV3Avalanche').length).toBeGreaterThan(0);
    expect(screen.getAllByTitle('AaveV4AvalancheMain').length).toBeGreaterThan(0);
    expect(screen.getAllByTitle('AaveV4AvalancheForex').length).toBeGreaterThan(0);
  });

  it('shows V4 badge on V4 sub-market chips', () => {
    render(<TestWrapper />);

    fireEvent.click(getExpandButton('Avalanche'));

    const mainChip = screen.getAllByTitle('AaveV4AvalancheMain')[0];
    expect(mainChip.textContent).toContain('V4');
    expect(mainChip.textContent).toContain('Avalanche Main');

    const forexChip = screen.getAllByTitle('AaveV4AvalancheForex')[0];
    expect(forexChip.textContent).toContain('V4');
    expect(forexChip.textContent).toContain('Avalanche Forex');
  });
});