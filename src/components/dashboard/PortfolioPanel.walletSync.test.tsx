// @vitest-environment happy-dom
/**
 * Wallet Sync button — verifies the idle / loading states
 * for the download-from-wallet button.
 *
 * After simplification the button is a manual trigger (Download icon)
 * with a spinner while loading. No freshness dot or age-based color.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { TooltipProvider } from '@/components/ui/tooltip';
import PortfolioPanel from './PortfolioPanel';
import { useWatchModeConnect } from '@/hooks/useWatchModeConnect';
import { useWallet } from '@/hooks/useWallet';
import type { ReserveWithSpread } from '@/types/aave';
import type { PortfolioSimulationActions } from '@/types/portfolio';

vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('sonner', () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() } }));
vi.mock('@/hooks/useWatchModeConnect');
vi.mock('@/hooks/useWallet');
vi.mock('wagmi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
    useAccount: () => ({ address: '0xabc', isConnected: true }),
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
  supplied: '0', supplyCap: '0', borrowCap: '0',
  utilizationPct: 0, optimalUtilization: 80,
  slopeBelowOptimal: 4, slopeAboveOptimal: 60,
  baseBorrowRate: 0, protocolFee: 10,
  supplyApy: 0, borrowApy: 0,
  supplyDisabled: false, borrowDisabled: false,
  supplyIncentives: [], borrowIncentives: [],
  meritSupplys: [], meritBorrows: [],
  merklSupplys: [], merklBorrows: [],
  brevisSupplys: [], brevisBorrows: [],
});

const actions: PortfolioSimulationActions = {
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
};

function renderPanel(props: {
  reserves: ReserveWithSpread[];
  walletLoadState?: 'idle' | 'loading' | 'success' | 'success-empty' | 'error';
  onWalletSync?: () => void;
}) {
  return render(
    <WagmiProvider config={testWagmiConfig}>
      <QueryClientProvider client={new QueryClient()}>
        <RainbowKitProvider>
          <TooltipProvider>
            <PortfolioPanel
              entries={[]}
              actions={actions}
              reserves={props.reserves}
              walletLoadState={props.walletLoadState}
              onWalletSync={props.onWalletSync}
            />
          </TooltipProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>,
  );
}

describe('PortfolioPanel — Wallet Sync button states', () => {
  beforeEach(() => {
    vi.mocked(useWatchModeConnect).mockReturnValue({ connectWatchAddress: vi.fn() });
     
    vi.mocked(useWallet).mockReturnValue({
      address: '0xabc', isConnected: true, isWatchMode: false,
      disconnect: vi.fn(),
    } as unknown as ReturnType<typeof useWallet>);
  });
  afterEach(() => cleanup());

  it('idle: button enabled with Download icon, no spinner', () => {
    renderPanel({ reserves: [makeReserve('USDC')], walletLoadState: 'idle' });
    const btn = screen.getByTestId('wallet-sync-button') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    expect(btn.getAttribute('title')).toBe('Import from wallet');
    expect(btn.querySelector('.animate-spin')).toBeNull();
  });

  it('loading: disabled, spinner visible, title says Importing', () => {
    renderPanel({ reserves: [makeReserve('USDC')], walletLoadState: 'loading' });
    const btn = screen.getByTestId('wallet-sync-button') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute('title')).toBe('Importing…');
    expect(btn.querySelector('.animate-spin')).not.toBeNull();
  });

  it('clicking idle button calls onWalletSync', () => {
    const onWalletSync = vi.fn();
    renderPanel({ reserves: [makeReserve('USDC')], walletLoadState: 'idle', onWalletSync });
    fireEvent.click(screen.getByTestId('wallet-sync-button'));
    expect(onWalletSync).toHaveBeenCalledTimes(1);
  });
});
