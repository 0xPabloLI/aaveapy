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
import { MemoryRouter } from 'react-router-dom';
import PortfolioPanel from './PortfolioPanel';
import { useWatchModeConnect } from '@/hooks/useWatchModeConnect';
import { useWallet } from '@/hooks/useWallet';
import type { ReserveWithSpread } from '@/types/aave';
import type { PortfolioSimulationActions } from '@/hooks/usePortfolioSimulation';

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
  supplied: '0',
  supplyCap: '0',
  borrowCap: '0',
  utilizationPct: 0,
  optimalUtilization: 80,
  slopeBelowOptimal: 4,
  slopeAboveOptimal: 60,
  baseBorrowRate: 0,
  protocolFee: 10,
  supplyApy: 0,
  borrowApy: 0,
  supplyDisabled: false,
  borrowDisabled: false,
  supplyIncentives: [],
  borrowIncentives: [],
  merklSupplys: [],
  merklBorrows: [],
  brevisSupplys: [],
  brevisBorrows: [],
});

const actions: PortfolioSimulationActions = {
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
};

function renderPanel(props: {
  reserves: ReserveWithSpread[];
  walletLoadState?: 'idle' | 'loading' | 'success' | 'success-empty' | 'error';
  failedSources?: string[];
  onWalletSync?: () => void;
}) {
  return render(
    <MemoryRouter>
      <WagmiProvider config={testWagmiConfig}>
        <QueryClientProvider client={new QueryClient()}>
          <RainbowKitProvider>
            <TooltipProvider>
              <PortfolioPanel
                entries={[]}
                actions={actions}
                reserves={props.reserves}
                walletLoadState={props.walletLoadState}
                failedSources={props.failedSources}
                onWalletSync={props.onWalletSync}
              />
            </TooltipProvider>
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </MemoryRouter>,
  );
}

describe('PortfolioPanel — Wallet Sync button states', () => {
  beforeEach(() => {
    vi.mocked(useWatchModeConnect).mockReturnValue({ connectWatchAddress: vi.fn() });

    vi.mocked(useWallet).mockReturnValue({
      address: '0xabc',
      isConnected: true,
      isWatchMode: false,
      disconnect: vi.fn(),
    } as unknown as ReturnType<typeof useWallet>);
  });
  afterEach(() => cleanup());

  it('idle: button enabled with CloudDownload icon, no spinner', () => {
    renderPanel({ reserves: [makeReserve('USDC')], walletLoadState: 'idle' });
    const btn = screen.getByTestId('wallet-sync-button') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    expect(btn.getAttribute('title')).toBe('Force sync');
    expect(btn.querySelector('.animate-spin')).toBeNull();
  });

  it('loading: disabled, spinner visible, title says Syncing', () => {
    renderPanel({ reserves: [makeReserve('USDC')], walletLoadState: 'loading' });
    const btn = screen.getByTestId('wallet-sync-button') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute('title')).toBe('Syncing…');
    expect(btn.querySelector('.animate-spin')).not.toBeNull();
  });

  it('clicking idle button calls onWalletSync', () => {
    const onWalletSync = vi.fn();
    renderPanel({ reserves: [makeReserve('USDC')], walletLoadState: 'idle', onWalletSync });
    fireEvent.click(screen.getByTestId('wallet-sync-button'));
    expect(onWalletSync).toHaveBeenCalledTimes(1);
  });
});

/**
 * AAV-1315 — partial degradation must be visible. `walletLoadState` maps
 * `partial` onto `'success'` (the enum is unchanged by contract), so the
 * notice keys off `failedSources`, which the hook already merges and dedupes.
 */
describe('PortfolioPanel — wallet partial degradation notice', () => {
  let infoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.mocked(useWatchModeConnect).mockReturnValue({ connectWatchAddress: vi.fn() });
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    vi.mocked(useWallet).mockReturnValue({
      address: '0xabc',
      isConnected: true,
      isWatchMode: false,
      disconnect: vi.fn(),
    } as unknown as ReturnType<typeof useWallet>);
  });
  afterEach(() => {
    infoSpy.mockRestore();
    cleanup();
  });

  it('P1 success with no failed sources shows no notice', () => {
    renderPanel({ reserves: [makeReserve('USDC')], walletLoadState: 'success', failedSources: [] });

    expect(screen.queryByTestId('wallet-partial-notice')).toBeNull();
  });

  it('P2 partial sync renders the fixed conclusion with the raw labels kept for diagnostics', () => {
    const failedSources = ['onchain-v3-chain-42220', 'sdk-v4'];
    renderPanel({ reserves: [makeReserve('USDC')], walletLoadState: 'success', failedSources });

    const notice = screen.getByTestId('wallet-partial-notice');
    expect(notice.textContent).toBe('Wallet data incomplete');
    expect(notice.className).toContain('ds-text-amber-600');
    expect(notice.getAttribute('role')).toBe('status');
    expect(notice.getAttribute('title')).toBeNull();
    expect(notice.getAttribute('data-failed-sources')).toBe('onchain-v3-chain-42220,sdk-v4');
    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy).toHaveBeenCalledWith('[wallet-sync] incomplete sources:', 'onchain-v3-chain-42220,sdk-v4');
  });

  it('P3 a fallback-only failure set does not notify because the data was recovered', () => {
    renderPanel({ reserves: [makeReserve('USDC')], walletLoadState: 'success', failedSources: ['sdk-v3-fallback'] });

    expect(screen.queryByTestId('wallet-partial-notice')).toBeNull();
  });

  it('P3b the notice stays when a fallback marker sits next to a real read failure', () => {
    renderPanel({
      reserves: [makeReserve('USDC')],
      walletLoadState: 'success',
      failedSources: ['sdk-v3-fallback', 'gap-v3-chain-10'],
    });

    expect(screen.getByTestId('wallet-partial-notice').textContent).toBe('Wallet data incomplete');
  });

  it('P4 a full failure keeps the existing error text without stacking the notice', () => {
    renderPanel({ reserves: [makeReserve('USDC')], walletLoadState: 'error', failedSources: ['sdk-v3', 'sdk-v4'] });

    expect(screen.getByText('Wallet sync failed')).not.toBeNull();
    expect(screen.queryByTestId('wallet-partial-notice')).toBeNull();
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it('P5 idle renders neither the status row nor the notice', () => {
    renderPanel({ reserves: [makeReserve('USDC')], walletLoadState: 'idle', failedSources: ['sdk-v3'] });

    // M5 is "the whole status row is not rendered", so assert every row variant is absent.
    expect(screen.queryByText('Syncing…')).toBeNull();
    expect(screen.queryByText('Wallet has no positions')).toBeNull();
    expect(screen.queryByText('Wallet sync failed')).toBeNull();
    expect(screen.queryByTestId('wallet-partial-notice')).toBeNull();
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it('P6 loading keeps Syncing as the only status line', () => {
    renderPanel({ reserves: [makeReserve('USDC')], walletLoadState: 'loading', failedSources: ['sdk-v3'] });

    expect(screen.getByText('Syncing…')).not.toBeNull();
    expect(screen.queryByTestId('wallet-partial-notice')).toBeNull();
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it('P7 an empty wallet shows the empty text and no degradation notice', () => {
    renderPanel({ reserves: [makeReserve('USDC')], walletLoadState: 'success-empty', failedSources: [] });

    expect(screen.getByText('Wallet has no positions')).not.toBeNull();
    expect(screen.queryByTestId('wallet-partial-notice')).toBeNull();
  });
});
