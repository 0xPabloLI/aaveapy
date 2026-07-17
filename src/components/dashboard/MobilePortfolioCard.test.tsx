// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import MobilePortfolioCard from './MobilePortfolioCard';
import type { PortfolioReserveEntry, PortfolioSimulationActions } from '@/types/portfolio';
import type { ReserveWithSpread } from '@/types/aave';

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => true,
}));

vi.mock('@/lib/chainIcons', () => ({
  getChainIconSrc: () => null,
}));

vi.mock('@/lib/marketLabels', () => ({
  getMarketChipLabel: () => 'Ethereum',
}));

const EMPTY_SIDE = { amount: '', inputMode: 'usd' as const, walletValue: null };

const makeEntry = (symbol: string): PortfolioReserveEntry => ({
  reserveId: `AaveV3Ethereum-${symbol}`,
  tokenSymbol: symbol,
  marketName: 'AaveV3Ethereum',
  chainName: 'Ethereum',
  chainId: 1,
  supply: { ...EMPTY_SIDE, amount: '5000' },
  borrow: { ...EMPTY_SIDE, amount: '2000' },
  hidden: false,
  isOrphan: false,
  restrictedStatus: null,
});

const makeReserve = (symbol: string): ReserveWithSpread => ({
  reserveId: `AaveV3Ethereum-${symbol}`,
  marketName: 'AaveV3Ethereum',
  chainName: 'Ethereum',
  chainId: 1,
  tokenName: symbol,
  tokenSymbol: symbol,
  tokenAddress: '0x0000000000000000000000000000000000000001',
  tokenPrice: 1,
  decimals: 6,
  supplied: '1000000000000',
  supplyCap: '2000000000000',
  borrowCap: '1000000000000',
  utilizationPct: 45,
  optimalUtilization: 80,
  slopeBelowOptimal: 4,
  slopeAboveOptimal: 60,
  baseBorrowRate: 0,
  protocolFee: 10,
  supplyApy: 4.2,
  borrowApy: 6.1,
  supplyDisabled: false,
  borrowDisabled: false,
  supplyIncentives: [],
  borrowIncentives: [],
  meritSupplys: [],
  meritBorrows: [],
  merklSupplys: [],
  merklBorrows: [],
  brevisSupplys: [],
  brevisBorrows: [],
});

const makeActions = (): PortfolioSimulationActions => ({
  setActive: vi.fn(),
  addReserve: vi.fn(),
  updateReserve: vi.fn(),
  hideReserve: vi.fn(),
  unhideReserve: vi.fn(),
  importReserves: vi.fn(),
  forceSyncReserves: vi.fn(),
  restoreToWallet: vi.fn(),
  removeWalletEntries: vi.fn(() => 0),
  removeReserve: vi.fn(),
  clearAll: vi.fn(),
  saveSnapshot: vi.fn(),
  deleteSnapshot: vi.fn(),
});

function renderCard(entries: PortfolioReserveEntry[]) {
  const reserves = entries.map(e => makeReserve(e.tokenSymbol));
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <TooltipProvider>
        <MobilePortfolioCard
          entries={entries}
          actions={makeActions()}
          reserves={reserves}
        />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe('MobilePortfolioCard — P0 audit fixes (AAV-1183)', () => {
  afterEach(() => cleanup());

  describe('Token symbol never truncates', () => {
    it('token symbol span does not have truncate class', () => {
      const entries = [makeEntry('USDC')];
      const { container } = renderCard(entries);
      // Find the span containing the token symbol text
      const symbolSpan = Array.from(container.querySelectorAll('span'))
        .find(s => s.textContent === 'USDC' && s.classList.contains('font-semibold'));
      expect(symbolSpan).toBeTruthy();
      expect(symbolSpan!.className).not.toContain('truncate');
    });

    it('token symbol span has break-words and min-w-0', () => {
      const entries = [makeEntry('USDC')];
      const { container } = renderCard(entries);
      const symbolSpan = Array.from(container.querySelectorAll('span'))
        .find(s => s.textContent === 'USDC' && s.classList.contains('font-semibold'));
      expect(symbolSpan).toBeTruthy();
      expect(symbolSpan!.className).toContain('break-words');
      expect(symbolSpan!.className).toContain('min-w-0');
    });
  });

  describe('Touch targets ≥44px', () => {
    it('remove button has min-h-[44px]', () => {
      const entries = [makeEntry('USDC')];
      const { container } = renderCard(entries);
      const removeBtn = container.querySelector('button[aria-label*="Remove"]');
      expect(removeBtn).toBeTruthy();
      expect(removeBtn!.className).toContain('min-h-[44px]');
      expect(removeBtn!.className).toContain('min-w-[44px]');
    });

    it('pill tab buttons have min-h-[44px]', () => {
      const entries = [makeEntry('USDC')];
      const { container } = renderCard(entries);
      const supplyTab = container.querySelector('button[aria-label]')?.parentElement;
      const tabs = Array.from(container.querySelectorAll('button'))
        .filter(b => b.textContent === 'Supply' || b.textContent === 'Borrow');
      expect(tabs.length).toBe(2);
      for (const tab of tabs) {
        expect(tab.className).toContain('min-h-[44px]');
      }
    });

    it('expand toggle button has min-h-[44px]', () => {
      const entries = [makeEntry('USDC')];
      const { container } = renderCard(entries);
      const expandBtn = container.querySelector('button[aria-expanded]');
      expect(expandBtn).toBeTruthy();
      expect(expandBtn!.className).toContain('min-h-[44px]');
    });

    it('clear (eraser) button has min-h-[44px] on mobile', () => {
      const entries = [makeEntry('USDC')];
      const { container } = renderCard(entries);
      const clearBtn = container.querySelector('button[aria-label*="Clear"]');
      expect(clearBtn).toBeTruthy();
      expect(clearBtn!.className).toContain('min-h-[44px]');
      expect(clearBtn!.className).toContain('min-w-[44px]');
    });
  });

  describe('hover: replaced with active: + md:hover: guard', () => {
    it('remove button uses active: instead of bare hover:', () => {
      const entries = [makeEntry('USDC')];
      const { container } = renderCard(entries);
      const removeBtn = container.querySelector('button[aria-label*="Remove"]');
      expect(removeBtn).toBeTruthy();
      // Must have active: variant (mobile)
      expect(removeBtn!.className).toMatch(/active:/);
      // Must NOT have bare hover: without md: guard
      const bareHover = removeBtn!.className.match(/(?<!md:)hover:/g);
      expect(bareHover).toBeNull();
    });

    it('$&#47;T toggle uses active: instead of bare hover:', () => {
      const entries = [makeEntry('USDC')];
      const { container } = renderCard(entries);
      const toggleBtn = container.querySelector('button[aria-label*="Switch to"]');
      expect(toggleBtn).toBeTruthy();
      expect(toggleBtn!.className).toMatch(/active:/);
      const bareHover = toggleBtn!.className.match(/(?<!md:)hover:/g);
      expect(bareHover).toBeNull();
    });

    it('clear button uses active: instead of bare hover:', () => {
      const entries = [makeEntry('USDC')];
      const { container } = renderCard(entries);
      const clearBtn = container.querySelector('button[aria-label*="Clear"]');
      expect(clearBtn).toBeTruthy();
      expect(clearBtn!.className).toMatch(/active:/);
      const bareHover = clearBtn!.className.match(/(?<!md:)hover:/g);
      expect(bareHover).toBeNull();
    });
  });
});

// ── Ticket 2 (AAV-1184): ARIA tablist + reduced-motion ──────────

describe('MobilePortfolioCard — P1 ARIA tablist + reduced-motion (AAV-1184)', () => {
  afterEach(() => cleanup());

  it('pill tabs container has role="tablist"', () => {
    const { container } = renderCard([makeEntry('USDC')]);
    const tablist = container.querySelector('[role="tablist"]');
    expect(tablist).toBeTruthy();
  });

  it('each pill tab button has role="tab" and aria-selected', () => {
    const { container } = renderCard([makeEntry('USDC')]);
    const tabs = container.querySelectorAll('[role="tab"]');
    expect(tabs.length).toBe(2);
    for (const tab of tabs) {
      expect(tab.getAttribute('aria-selected')).toBeTruthy();
    }
    // Supply tab should be selected by default
    const supplyTab = Array.from(tabs).find(t => t.textContent === 'Supply');
    expect(supplyTab?.getAttribute('aria-selected')).toBe('true');
    const borrowTab = Array.from(tabs).find(t => t.textContent === 'Borrow');
    expect(borrowTab?.getAttribute('aria-selected')).toBe('false');
  });

  it('content area has role="tabpanel"', () => {
    const { container } = renderCard([makeEntry('USDC')]);
    const tabpanel = container.querySelector('[role="tabpanel"]');
    expect(tabpanel).toBeTruthy();
  });
});

// ── Ticket 3 (AAV-1185): gradient→solid + Summary $/day ──────────

describe('MobilePortfolioCard — P1 gradient→solid + Summary $/day (AAV-1185)', () => {
  afterEach(() => cleanup());

  it('incentive value does not use gradient text classes', () => {
    const { container } = renderCard([makeEntry('USDC')]);
    // Look for the incentive cell which might have bg-clip-text
    const incentiveSpans = container.querySelectorAll('[data-cell*="incentive"]');
    for (const span of incentiveSpans) {
      expect(span.className).not.toContain('bg-clip-text');
      expect(span.className).not.toContain('bg-gradient-to-r');
    }
  });

  it('card container uses space-y-2 (compact density)', () => {
    const { container } = renderCard([makeEntry('USDC'), makeEntry('WETH')]);
    const wrapper = container.firstElementChild;
    expect(wrapper?.className).toContain('space-y-2');
  });

  it('incentive value uses semantic color at 70% opacity when data present (not full, not gradient)', () => {
    const { container } = renderCard([makeEntry('USDC')]);
    const incentiveSpans = container.querySelectorAll('[data-cell*="incentive"]');
    for (const span of incentiveSpans) {
      expect(span.className).not.toContain('bg-clip-text');
      expect(span.className).not.toContain('bg-gradient-to-r');
      // When data present: semantic 70%. When no data: text-foreground/50 fallback is OK.
      if (!span.className.includes('text-foreground/50')) {
        expect(span.className).toMatch(/ds-text-emerald-600-70|ds-text-brand-cyan-70/);
      }
    }
  });

  it('native value uses semantic color at 70% opacity (not neutral gray)', () => {
    const { container } = renderCard([makeEntry('USDC')]);
    const nativeSpans = container.querySelectorAll('[data-cell*="native"]');
    for (const span of nativeSpans) {
      expect(span.className).not.toContain('text-foreground/');
      expect(span.className).toMatch(/ds-text-emerald-600-70|ds-text-brand-cyan-70/);
    }
  });
});

// ── Ticket 4 (AAV-1186): Polish pass ─────────────────────────────

describe('MobilePortfolioCard — P2+P3 polish (AAV-1186)', () => {
  afterEach(() => cleanup());

  it('metrics strip uses ring-1 ring-border/50 (framed data panel)', () => {
    const { container } = renderCard([makeEntry('USDC')]);
    const strips = container.querySelectorAll('[class*="grid-cols-3"]');
    for (const strip of strips) {
      expect(strip.className).toContain('ring-1');
      expect(strip.className).toContain('ring-border');
    }
  });

  it('ListCollapse icon uses h-3 w-3 (compact, with other affordances)', () => {
    const { container } = renderCard([makeEntry('USDC')]);
    const expandBtn = container.querySelector('button[aria-expanded] svg');
    expect(expandBtn?.getAttribute('class')).toContain('h-3 ');
    expect(expandBtn?.getAttribute('class')).toContain('w-3 ');
  });

  it('Native and Incentive both use semantic 70% when data present (hierarchy: Total full > secondary 70%)', () => {
    const { container } = renderCard([makeEntry('USDC')]);
    const totalSpan = container.querySelector('[data-cell*="total"]');
    const nativeSpan = container.querySelector('[data-cell*="native"]');
    const incentiveSpan = container.querySelector('[data-cell*="incentive"]');
    // Total should use full opacity semantic color
    expect(totalSpan?.className).toMatch(/ds-text-emerald-600(?!-70)/);
    // Native should use 70% opacity (always rendered with semantic color)
    expect(nativeSpan?.className).toMatch(/ds-text-emerald-600-70|ds-text-brand-cyan-70/);
    // Incentive: 70% when data present, text-foreground/50 fallback when no data
    if (incentiveSpan && !incentiveSpan.className.includes('text-foreground/50')) {
      expect(incentiveSpan.className).toMatch(/ds-text-emerald-600-70|ds-text-brand-cyan-70/);
    }
  });
});
