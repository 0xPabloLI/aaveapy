// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { MemoryRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import PortfolioPanel from './PortfolioPanel';
import { useWatchModeConnect } from '@/hooks/useWatchModeConnect';
import { features } from '@/config/features';
import type { ReserveWithSpread } from '@/types/aave';
import type { PortfolioSimulationActions, PortfolioSnapshot } from '@/types/portfolio';

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const testWagmiConfig: any = createConfig({
  chains: [mainnet],
  connectors: [],
  transports: { [mainnet.id]: http() },
  ssr: true,
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

const makeSnapshot = (label: string): PortfolioSnapshot => ({
  id: `snap-${label}`,
  label,
  createdAt: Date.now(),
  entries: [],
  summary: {
    totalSupplyUsd: 1000,
    totalBorrowUsd: 500,
    supplyUsdPerDay: 0.115,
    borrowUsdPerDay: 0.084,
    netUsdPerDay: 0.031,
    netEffectiveApy: 1.13,
  },
  positionResults: [],
});

function renderPanel(snapshots?: PortfolioSnapshot[]) {
  return render(
    <WagmiProvider config={testWagmiConfig}>
      <QueryClientProvider client={new QueryClient()}>
        <RainbowKitProvider>
          <MemoryRouter>
            <TooltipProvider>
              <PortfolioPanel
                entries={[]}
                actions={makeActions()}
                reserves={[makeReserve('USDC')]}
                snapshots={snapshots}
              />
            </TooltipProvider>
          </MemoryRouter>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>,
  );
}

describe('PortfolioPanel snapshot feature flag', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.mocked(useWatchModeConnect).mockReturnValue({
      connectWatchAddress: vi.fn(),
    });
  });

  it('should not render Save snapshot button when snapshot flag is false', () => {
    expect(features.snapshot).toBe(false);
    renderPanel();
    expect(screen.queryByLabelText(/save snapshot/i)).not.toBeInTheDocument();
  });

  it('should not render Saved Snapshots section even when snapshots exist', () => {
    expect(features.snapshot).toBe(false);
    renderPanel([makeSnapshot('A'), makeSnapshot('B')]);
    expect(screen.queryByText(/saved snapshots/i)).not.toBeInTheDocument();
  });

  it('should not render Compare button', () => {
    expect(features.snapshot).toBe(false);
    renderPanel([makeSnapshot('A'), makeSnapshot('B')]);
    expect(screen.queryByRole('button', { name: /compare/i })).not.toBeInTheDocument();
  });
});
