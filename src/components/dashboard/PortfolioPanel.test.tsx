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
import type { PortfolioPosition, PortfolioSimulationActions } from '@/types/portfolio';

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
  addPosition: vi.fn(),
  removePosition: vi.fn(),
  updateAmount: vi.fn(),
  updateInputMode: vi.fn(),
  clearAll: vi.fn(),
});

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
              positions={[]}
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

  it('exposes View address from the Batch wallet actions', () => {
    const reserves = [makeReserve('USDC')];
    render(
      <WagmiProvider config={testWagmiConfig}>
        <QueryClientProvider client={new QueryClient()}>
          <RainbowKitProvider>
            <TooltipProvider>
            <PortfolioPanel
              positions={[]}
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

  it('calls addPosition with supply and borrow sides when token is added from search', () => {
    const reserves = [makeReserve('USDC')];
    const actions = makeActions();
    render(
      <WagmiProvider config={testWagmiConfig}>
        <QueryClientProvider client={new QueryClient()}>
          <RainbowKitProvider>
            <TooltipProvider>
            <PortfolioPanel
              positions={[]}
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
    expect(actions.addPosition).toHaveBeenCalledTimes(2);
  });

  it('shows position rows for existing positions', () => {
    const reserves = [makeReserve('USDC')];
    const positions: PortfolioPosition[] = [
      { positionId: 'p1', reserveId: 'AaveV3Ethereum-USDC', side: 'supply', amount: '5000', inputMode: 'usd', tokenSymbol: 'USDC', marketName: 'AaveV3Ethereum', chainName: 'Ethereum' },
      { positionId: 'p2', reserveId: 'AaveV3Ethereum-USDC', side: 'borrow', amount: '2000', inputMode: 'usd', tokenSymbol: 'USDC', marketName: 'AaveV3Ethereum', chainName: 'Ethereum' },
    ];
    render(
      <WagmiProvider config={testWagmiConfig}>
        <QueryClientProvider client={new QueryClient()}>
          <RainbowKitProvider>
            <TooltipProvider>
            <PortfolioPanel
              positions={positions}
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

  it('renders empty state when no positions are added', () => {
    const reserves = [makeReserve('USDC')];
    const { container } = render(
      <WagmiProvider config={testWagmiConfig}>
        <QueryClientProvider client={new QueryClient()}>
          <RainbowKitProvider>
            <TooltipProvider>
            <PortfolioPanel
              positions={[]}
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

  it('renders Merkl rewards section when claimableRewards are provided', () => {
    const reserves = [makeReserve('USDC')];
    const claimableRewards = [
      { id: 'r1', claimable: 12.34, symbol: 'USDC', startDate: '2025-01-01', endDate: '2025-06-01', claimUntil: '2025-12-01' },
      { id: 'r2', claimable: 0.56, symbol: 'ETH', startDate: '2025-01-01', endDate: '2025-06-01', claimUntil: '2025-12-01' },
    ];
    render(
      <WagmiProvider config={testWagmiConfig}>
        <QueryClientProvider client={new QueryClient()}>
          <RainbowKitProvider>
            <TooltipProvider>
            <PortfolioPanel
              positions={[]}
              actions={makeActions()}
              reserves={reserves}
              claimableRewards={claimableRewards}
              claimableRewardsLoading={false}
            />
            </TooltipProvider>
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>,
    );
    expect(screen.getByText('Merkl Rewards')).toBeInTheDocument();
    expect(screen.getAllByText('USDC').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('ETH').length).toBeGreaterThanOrEqual(1);
  });

  it('shows loading state for Merkl rewards', () => {
    const reserves = [makeReserve('USDC')];
    render(
      <WagmiProvider config={testWagmiConfig}>
        <QueryClientProvider client={new QueryClient()}>
          <RainbowKitProvider>
            <TooltipProvider>
            <PortfolioPanel
              positions={[]}
              actions={makeActions()}
              reserves={reserves}
              claimableRewardsLoading={true}
            />
            </TooltipProvider>
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>,
    );
    expect(screen.getByText(/loading rewards/i)).toBeInTheDocument();
  });

  it('does not render Merkl section when rewards array is empty', () => {
    const reserves = [makeReserve('USDC')];
    const { queryByText } = render(
      <WagmiProvider config={testWagmiConfig}>
        <QueryClientProvider client={new QueryClient()}>
          <RainbowKitProvider>
            <TooltipProvider>
            <PortfolioPanel
              positions={[]}
              actions={makeActions()}
              reserves={reserves}
              claimableRewards={[]}
              claimableRewardsLoading={false}
            />
            </TooltipProvider>
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>,
    );
    expect(queryByText('Merkl Rewards')).not.toBeInTheDocument();
  });
});
