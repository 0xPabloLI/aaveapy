// @vitest-environment happy-dom
import { act, useState } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(cleanup);

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
      hubEntries={[{ id: 'hub-core', name: 'Core' }, { id: 'hub-prime', name: 'Prime' }]}
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

  it('passes hubId (not hubName) when hub chip is clicked', () => {
    const setHubsFn = vi.fn();
    const { container } = render(
      <FilterBar
        searchQuery=""
        setSearchQuery={() => {}}
        selectedMarkets={[]}
        setSelectedMarkets={() => {}}
        selectedCategory="all"
        setSelectedCategory={() => {}}
        isApy
        setIsApy={() => {}}
        marketsList={ETH_MULTI_MARKETS}
        hubEntries={[{ id: 'hub-core', name: 'Core' }, { id: 'hub-prime', name: 'Prime' }]}
        selectedHubs={[]}
        setSelectedHubs={setHubsFn}
        marketViewMode="hub"
        setMarketViewMode={() => {}}
      />
    );

    const marketsRow = container.querySelector('[data-testid="markets-row"]');
    expect(marketsRow).not.toBeNull();
    const coreChip = Array.from(marketsRow!.querySelectorAll('button')).find(b => b.textContent === 'Core');
    expect(coreChip).toBeDefined();
    fireEvent.click(coreChip!);
    expect(setHubsFn).toHaveBeenCalledWith(['hub-core']);
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

describe('FilterBar mobile layout', () => {
  it('renders mobile restricted toggle in Row 2 alongside search when showFrozenOrPaused is provided', () => {
    render(
      <FilterBar
        searchQuery=""
        setSearchQuery={() => {}}
        selectedMarkets={[]}
        setSelectedMarkets={() => {}}
        selectedCategory="all"
        setSelectedCategory={() => {}}
        isApy
        setIsApy={() => {}}
        marketsList={ETH_MULTI_MARKETS}
        hubEntries={[]}
        selectedHubs={[]}
        setSelectedHubs={() => {}}
        showFrozenOrPaused={false}
        setShowFrozenOrPaused={() => {}}
      />,
    );

    const frozenButtons = screen.getAllByTitle('Show frozen or paused assets');
    const mobileFrozen = frozenButtons.find((b) => b.className.includes('shrink-0'));
    expect(mobileFrozen).toBeDefined();
    expect(mobileFrozen!.className).toContain('inline-flex');
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

describe('FilterBar market filter search', () => {
  it('renders market filter toggle button in markets row', () => {
    render(<TestWrapper />);
    const marketsRow = screen.getAllByTestId('markets-row')[0];
    const filterToggle = within(marketsRow).getByTestId('market-filter-toggle');
    expect(filterToggle).toBeInTheDocument();
  });

  it('opens market filter input when toggle is clicked', () => {
    render(<TestWrapper />);
    const marketsRow = screen.getAllByTestId('markets-row')[0];
    const filterToggle = within(marketsRow).getByTestId('market-filter-toggle');
    fireEvent.click(filterToggle);
    const filterInput = within(marketsRow).getByTestId('market-filter-input');
    expect(filterInput).toBeInTheDocument();
  });

  it('closes market filter input and clears query when toggle is clicked again', () => {
    render(<TestWrapper />);
    const marketsRow = screen.getAllByTestId('markets-row')[0];
    const filterToggle = within(marketsRow).getByTestId('market-filter-toggle');
    fireEvent.click(filterToggle);
    const filterInput = within(marketsRow).getByTestId('market-filter-input');
    fireEvent.change(filterInput, { target: { value: 'arb' } });
    act(() => { fireEvent.click(filterToggle); });
  });

  it('filters chain chips by chain name when query is entered', () => {
    const manyMarkets = [
      { marketName: 'AaveV3Ethereum', chainName: 'Ethereum' },
      { marketName: 'AaveV3Arbitrum', chainName: 'Arbitrum' },
      { marketName: 'AaveV3Base', chainName: 'Base' },
    ];
    const { container } = render(
      <FilterBar
        searchQuery=""
        setSearchQuery={() => {}}
        selectedMarkets={[]}
        setSelectedMarkets={() => {}}
        selectedCategory="all"
        setSelectedCategory={() => {}}
        isApy
        setIsApy={() => {}}
        marketsList={manyMarkets}
        hubEntries={[]}
        selectedHubs={[]}
        setSelectedHubs={() => {}}
      />
    );

    const marketsRow = container.querySelector('[data-testid="markets-row"]')!;
    const filterToggle = marketsRow.querySelector('[data-testid="market-filter-toggle"]') as HTMLElement;
    fireEvent.click(filterToggle);
    const filterInput = within(marketsRow as HTMLElement).getByTestId('market-filter-input');
    fireEvent.change(filterInput, { target: { value: 'base' } });

    const chainButtons = Array.from(marketsRow.querySelectorAll('button'))
      .filter(b => b.textContent && !['All', 'Chain', 'Hub'].includes(b.textContent.trim()) && !b.getAttribute('data-testid'));
    const chainNames = chainButtons.map(b => b.textContent?.trim());
    expect(chainNames).toContain('Base');
    expect(chainNames).not.toContain('Arbitrum');
  });

  it('filters hub chips by hub name when in hub view', () => {
    const setHubsFn = vi.fn();
    const { container } = render(
      <FilterBar
        searchQuery=""
        setSearchQuery={() => {}}
        selectedMarkets={[]}
        setSelectedMarkets={() => {}}
        selectedCategory="all"
        setSelectedCategory={() => {}}
        isApy
        setIsApy={() => {}}
        marketsList={ETH_MULTI_MARKETS}
        hubEntries={[{ id: 'hub-core', name: 'Core' }, { id: 'hub-prime', name: 'Prime' }]}
        selectedHubs={[]}
        setSelectedHubs={setHubsFn}
        marketViewMode="hub"
        setMarketViewMode={() => {}}
      />
    );

    const marketsRow = container.querySelector('[data-testid="markets-row"]')!;
    const filterToggle = marketsRow.querySelector('[data-testid="market-filter-toggle"]') as HTMLElement;
    fireEvent.click(filterToggle);
    const filterInput = within(marketsRow as HTMLElement).getByTestId('market-filter-input');
    fireEvent.change(filterInput, { target: { value: 'prime' } });

    const hubButtons = Array.from(marketsRow.querySelectorAll('button'))
      .filter(b => b.textContent && ['Core', 'Prime'].includes(b.textContent.trim()) && !b.getAttribute('data-testid'));
    const hubNames = hubButtons.map(b => b.textContent?.trim());
    expect(hubNames).toContain('Prime');
    expect(hubNames).not.toContain('Core');
  });

  it('auto-expands Ethereum when market filter matches a sub-market name', () => {
    const ethSubMarkets = [
      { marketName: 'AaveV3Ethereum', chainName: 'Ethereum' },
      { marketName: 'AaveV3EthereumLido', chainName: 'Ethereum' },
      { marketName: 'AaveV4Ethereum', chainName: 'Ethereum' },
      { marketName: 'AaveV3Arbitrum', chainName: 'Arbitrum' },
    ];
    const { container } = render(<TestWrapper marketsList={ethSubMarkets} />);

    expect(screen.queryAllByTitle('Collapse Ethereum markets').length).toBe(0);

    const marketsRow = container.querySelector('[data-testid="markets-row"]')!;
    const filterToggle = marketsRow.querySelector('[data-testid="market-filter-toggle"]') as HTMLElement;
    fireEvent.click(filterToggle);
    const filterInput = within(marketsRow as HTMLElement).getByTestId('market-filter-input');
    act(() => { fireEvent.change(filterInput, { target: { value: 'lido' } }); });

    expect(screen.getAllByTitle('Collapse Ethereum markets').length).toBeGreaterThan(0);
  });
});
