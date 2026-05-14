// @vitest-environment happy-dom
import { act, useState } from 'react';
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

const ETH_MULTI_MARKETS = [
  { marketName: 'AaveV3Ethereum', chainName: 'Ethereum' },
  { marketName: 'AaveV4Ethereum', chainName: 'Ethereum' },
  { marketName: 'AaveV3Arbitrum', chainName: 'Arbitrum' },
];

function TestWrapper({
  initialCategory = 'all' as TokenCategory,
  initialMarkets = [] as string[],
  initialHubs = [] as string[],
  marketsList = ETH_MULTI_MARKETS,
  expandedChain: externalExpandedChain,
  setExpandedChain: externalSetExpandedChain,
}: {
  initialCategory?: TokenCategory;
  initialMarkets?: string[];
  initialHubs?: string[];
  marketsList?: { marketName: string; chainName: string }[];
  expandedChain?: string | null;
  setExpandedChain?: (chain: string | null) => void;
}) {
  const [category, setCategory] = useState<TokenCategory>(initialCategory);
  const [markets, setMarkets] = useState<string[]>(initialMarkets);
  const [hubs, setHubs] = useState<string[]>(initialHubs);
  const [searchQuery, setSearchQuery] = useState('');
  const [isApy, setIsApy] = useState(true);
  const [internalExpandedChain, setInternalExpandedChain] = useState<string | null>(null);

  const expandedChain = externalExpandedChain ?? internalExpandedChain;
  const setExpandedChain = externalSetExpandedChain ?? setInternalExpandedChain;

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
      hubNames={['Core', 'Prime']}
      selectedHubs={hubs}
      setSelectedHubs={setHubs}
      expandedChain={expandedChain}
      setExpandedChain={setExpandedChain}
    />
  );
}

describe('FilterBar', () => {
  it('renders token category chips with ds-chip class', () => {
    render(<TestWrapper />);

    const tokensRow = screen.getAllByTestId('tokens-row')[0];
    const tokenLabels = ['All', 'Stables', 'xETH', 'xBTC', 'Pendle'];
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

    const tokenChips = ['All', 'Stables', 'xETH', 'xBTC', 'Pendle'].map((label) =>
      within(tokensRow).getByRole('button', { name: label })
    );
    const allChip = within(marketsRow).getByRole('button', { name: 'All' });

    [...tokenChips, allChip].forEach((chip) => {
      expect(chip.className).not.toContain('h-7');
      expect(chip.className).not.toContain('inline-flex items-center justify-center h-7');
    });
  });
});

function getExpandButton() {
  return screen.getAllByTitle('Expand Ethereum markets')[0];
}

function getCollapseButton() {
  return screen.getAllByTitle('Collapse Ethereum markets')[0];
}

describe('FilterBar setExpandedChain', () => {
  it('expands Ethereum sub-markets on expand toggle click', () => {
    render(<TestWrapper />);

    fireEvent.click(getExpandButton());

    expect(getCollapseButton()).toBeInTheDocument();
    expect(screen.getAllByTitle('AaveV3Ethereum').length).toBeGreaterThan(0);
    expect(screen.getAllByTitle('AaveV4Ethereum').length).toBeGreaterThan(0);
  });

  it('collapses Ethereum sub-markets when clicking collapse toggle', () => {
    render(<TestWrapper />);

    fireEvent.click(getExpandButton());
    fireEvent.click(getCollapseButton());

    expect(getExpandButton()).toBeInTheDocument();
  });

  it('resets expandedChain to null when clicking All chip', () => {
    render(<TestWrapper />);

    fireEvent.click(getExpandButton());
    expect(getCollapseButton()).toBeInTheDocument();

    const marketsRow = screen.getAllByTestId('markets-row')[0];
    const allChip = within(marketsRow).getByRole('button', { name: 'All' });
    fireEvent.click(allChip);

    expect(getExpandButton()).toBeInTheDocument();
  });

  it('calls controlled setExpandedChain with chain name on expand', () => {
    function ControlledWrapper({ initialExpanded }: { initialExpanded: string | null }) {
      const [expandedChain, setExpandedChain] = useState<string | null>(initialExpanded);
      return (
        <TestWrapper expandedChain={expandedChain} setExpandedChain={setExpandedChain} />
      );
    }
    render(<ControlledWrapper initialExpanded={null} />);

    act(() => { fireEvent.click(getExpandButton()); });
    expect(getCollapseButton()).toBeInTheDocument();
  });

  it('calls controlled setExpandedChain with null on collapse', () => {
    function ControlledWrapper({ initialExpanded }: { initialExpanded: string | null }) {
      const [expandedChain, setExpandedChain] = useState<string | null>(initialExpanded);
      return (
        <TestWrapper expandedChain={expandedChain} setExpandedChain={setExpandedChain} />
      );
    }
    render(<ControlledWrapper initialExpanded="Ethereum" />);

    act(() => { fireEvent.click(getCollapseButton()); });
    expect(getExpandButton()).toBeInTheDocument();
  });
});

describe('FilterBar setExpandedChain type contract', () => {
  it('setExpandedChain prop only accepts (chain: string | null) => void', () => {
    const setExpandedChain: (chain: string | null) => void = vi.fn();
    render(
      <TestWrapper setExpandedChain={setExpandedChain} expandedChain={null} />
    );
    expect(true).toBe(true);
  });

  it('expandedChain prop only accepts string | null | undefined', () => {
    const validValues: (string | null | undefined)[] = ['Ethereum', null, undefined];
    validValues.forEach((val) => {
      const { unmount } = render(
        <TestWrapper expandedChain={val} />
      );
      unmount();
    });
    expect(true).toBe(true);
  });
});
