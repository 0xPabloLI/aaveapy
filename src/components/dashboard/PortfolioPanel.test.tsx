// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { TooltipProvider } from '@/components/ui/tooltip';
import PortfolioPanel from './PortfolioPanel';
import { useWatchModeConnect } from '@/hooks/useWatchModeConnect';
import type { ReserveWithSpread } from '@/types/aave';
import type { PortfolioReserveEntry, PortfolioSimulationActions } from '@/types/portfolio';

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}));

vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/hooks/useWatchModeConnect');

vi.mock('wagmi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
    useAccount: () => ({ address: undefined, isConnected: false }),
  };
});

// Cast to `any` because the global wagmi Register augmentation
// (src/lib/wagmi/config.ts) types the config with the production connectors
// (injected/walletConnect/watch); tests use an empty connector list.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const testWagmiConfig: any = createConfig({
  chains: [mainnet],
  connectors: [],
  transports: { [mainnet.id]: http() },
  ssr: true,
});

const makeReserve = (symbol: string, market = 'AaveV3Ethereum'): ReserveWithSpread => ({
  reserveId: `${market}-${symbol}`,
  marketName: market,
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
  removeReserve: vi.fn(),
  updateReserve: vi.fn(),
  hideReserve: vi.fn(),
  unhideReserve: vi.fn(),
  importReserves: vi.fn(),
  restoreToWallet: vi.fn(),
  clearAll: vi.fn(),
  saveSnapshot: vi.fn(),
  deleteSnapshot: vi.fn(),
  undoLastRemove: vi.fn(),
  addPosition: vi.fn(),
  removePosition: vi.fn(),
  updateAmount: vi.fn(),
  updateDeltaSign: vi.fn(),
  updateInputMode: vi.fn(),
  importPositions: vi.fn(),
  restorePosition: vi.fn(),
  toggleHidden: vi.fn(),
  hideOrRemoveReserveAction: vi.fn(),
  unhideReserveAction: vi.fn(),
});

const EMPTY_SIDE = { amount: '', inputMode: 'usd' as const, walletValue: null };

describe('PortfolioPanel', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.mocked(useWatchModeConnect).mockReturnValue({
      connectWatchAddress: vi.fn(),
    });
  });

  it('renders search input when panel mounts', () => {
    const reserves = [makeReserve('USDC'), makeReserve('USDT')];
    render(
      <WagmiProvider config={testWagmiConfig}>
        <QueryClientProvider client={new QueryClient()}>
          <RainbowKitProvider>
            <TooltipProvider>
            <PortfolioPanel
              entries={[]}
              actions={makeActions()}
              reserves={reserves}
            />
            </TooltipProvider>
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>,
    );
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
  });

  it('exposes View address from the Portfolio wallet actions', () => {
    const reserves = [makeReserve('USDC')];
    render(
      <WagmiProvider config={testWagmiConfig}>
        <QueryClientProvider client={new QueryClient()}>
          <RainbowKitProvider>
            <TooltipProvider>
            <PortfolioPanel
              entries={[]}
              actions={makeActions()}
              reserves={reserves}
            />
            </TooltipProvider>
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /wallet actions/i }));

    expect(screen.getByRole('button', { name: /view address/i })).toBeInTheDocument();
  });

  it('calls addReserve when token is added from search', () => {
    const reserves = [makeReserve('USDC')];
    const actions = makeActions();
    render(
      <WagmiProvider config={testWagmiConfig}>
        <QueryClientProvider client={new QueryClient()}>
          <RainbowKitProvider>
            <TooltipProvider>
            <PortfolioPanel
              entries={[]}
              actions={actions}
              reserves={reserves}
            />
            </TooltipProvider>
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>,
    );
    const searchInput = screen.getByPlaceholderText(/search/i);
    fireEvent.change(searchInput, { target: { value: 'USDC' } });
    const addButtons = screen.getAllByRole('button', { name: /add.*USDC/i });
    fireEvent.click(addButtons[0]);
    expect(actions.addReserve).toHaveBeenCalledTimes(1);
  });

  it('shows entry rows for existing entries', () => {
    const reserves = [makeReserve('USDC')];
    const entries: PortfolioReserveEntry[] = [
      { reserveId: 'AaveV3Ethereum-USDC', tokenSymbol: 'USDC', marketName: 'AaveV3Ethereum', chainName: 'Ethereum', supply: { ...EMPTY_SIDE, amount: '5000' }, borrow: { ...EMPTY_SIDE, amount: '2000' }, hidden: false, isOrphan: false },
    ];
    render(
      <WagmiProvider config={testWagmiConfig}>
        <QueryClientProvider client={new QueryClient()}>
          <RainbowKitProvider>
            <TooltipProvider>
            <PortfolioPanel
              entries={entries}
              actions={makeActions()}
              reserves={reserves}
            />
            </TooltipProvider>
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>,
    );
    expect(screen.getByText('USDC')).toBeInTheDocument();
  });

  it('renders empty state when no entries are added', () => {
    const reserves = [makeReserve('USDC')];
    const { container } = render(
      <WagmiProvider config={testWagmiConfig}>
        <QueryClientProvider client={new QueryClient()}>
          <RainbowKitProvider>
            <TooltipProvider>
            <PortfolioPanel
              entries={[]}
              actions={makeActions()}
              reserves={reserves}
            />
            </TooltipProvider>
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>,
    );
    expect(container.innerHTML).not.toContain('position-results');
  });

  it('renders PortfolioModeToggle in header when simulationMode is provided', () => {
    const reserves = [makeReserve('USDC')];
    const onModeChange = vi.fn();
    render(
      <WagmiProvider config={testWagmiConfig}>
        <QueryClientProvider client={new QueryClient()}>
          <RainbowKitProvider>
            <TooltipProvider>
            <PortfolioPanel
              entries={[]}
              actions={makeActions()}
              reserves={reserves}
              simulationMode="portfolio"
              onSimulationModeChange={onModeChange}
            />
            </TooltipProvider>
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>,
    );
    const toggle = screen.getByRole('switch', { name: /portfolio/i });
    expect(toggle).toBeInTheDocument();
  });

  it('does not render PortfolioModeToggle when simulationMode is not provided', () => {
    const reserves = [makeReserve('USDC')];
    render(
      <WagmiProvider config={testWagmiConfig}>
        <QueryClientProvider client={new QueryClient()}>
          <RainbowKitProvider>
            <TooltipProvider>
            <PortfolioPanel
              entries={[]}
              actions={makeActions()}
              reserves={reserves}
            />
            </TooltipProvider>
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>,
    );
    expect(screen.queryByRole('switch', { name: /portfolio/i })).not.toBeInTheDocument();
  });
});
