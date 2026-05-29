// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import PortfolioPanel from './PortfolioPanel';
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

vi.mock('wagmi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
    useAccount: () => ({ address: undefined, isConnected: false }),
  };
});

const testWagmiConfig = createConfig({
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

  it('renders search input when panel mounts', () => {
    const reserves = [makeReserve('USDC'), makeReserve('USDT')];
    render(
      <WagmiProvider config={testWagmiConfig}>
        <QueryClientProvider client={new QueryClient()}>
          <RainbowKitProvider>
            <PortfolioPanel
              positions={[]}
              actions={makeActions()}
              reserves={reserves}
            />
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>,
    );
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
  });

  it('calls addPosition with supply and borrow sides when token is added from search', () => {
    const reserves = [makeReserve('USDC')];
    const actions = makeActions();
    render(
      <WagmiProvider config={testWagmiConfig}>
        <QueryClientProvider client={new QueryClient()}>
          <RainbowKitProvider>
            <PortfolioPanel
              positions={[]}
              actions={actions}
              reserves={reserves}
            />
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
            <PortfolioPanel
              positions={positions}
              actions={makeActions()}
              reserves={reserves}
            />
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
            <PortfolioPanel
              positions={[]}
              actions={makeActions()}
              reserves={reserves}
            />
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>,
    );
    expect(container.innerHTML).not.toContain('position-results');
  });
});
