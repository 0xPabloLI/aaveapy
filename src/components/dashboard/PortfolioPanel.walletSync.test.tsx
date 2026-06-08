// @vitest-environment happy-dom
/**
 * Wallet Sync button — verifies the idle / loading / error
 * state machine for the freshness dot, disabled state, spinner, and titles.
 *
 * Decisions covered:
 *  - #20/#23 — sync button has three states with freshness dot
 *  - market-update sky dot removed; reserves identity change no longer
 *    produces a distinct state — dot falls through to age-based color
 *  - error UX recovers to idle on successful retry
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

  it('idle (never synced): button enabled, no spinner, no freshness dot', () => {
    renderPanel({ reserves: [makeReserve('USDC')], walletLoadState: 'idle' });
    const btn = screen.getByTestId('wallet-sync-button') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    expect(btn.getAttribute('data-wallet-sync-state')).toBe('idle');
    expect(btn.getAttribute('title')).toBe('Sync wallet positions');
    expect(btn.querySelector('.animate-spin')).toBeNull();
    expect(screen.queryByTestId('wallet-sync-freshness-dot')).toBeNull();
  });

  it('loading: disabled, spinner visible, no dot rendered, title says Syncing', () => {
    renderPanel({ reserves: [makeReserve('USDC')], walletLoadState: 'loading' });
    const btn = screen.getByTestId('wallet-sync-button') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute('data-wallet-sync-state')).toBe('loading');
    expect(btn.getAttribute('title')).toBe('Syncing…');
    expect(btn.querySelector('.animate-spin')).not.toBeNull();
    expect(screen.queryByTestId('wallet-sync-freshness-dot')).toBeNull();
  });

  it('loading → success: emits freshness dot and "Updated …" title (idle-synced)', () => {
    const { rerender } = renderPanel({ reserves: [makeReserve('USDC')], walletLoadState: 'loading' });
    rerender(
      <WagmiProvider config={testWagmiConfig}>
        <QueryClientProvider client={new QueryClient()}>
          <RainbowKitProvider>
            <TooltipProvider>
              <PortfolioPanel
                entries={[]}
                actions={actions}
                reserves={[makeReserve('USDC')]}
                walletLoadState="success-empty"
              />
            </TooltipProvider>
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>,
    );
    const btn = screen.getByTestId('wallet-sync-button') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    expect(btn.getAttribute('data-wallet-sync-state')).toBe('idle-synced');
    expect(btn.getAttribute('title')).toMatch(/^Updated \d+s ago$/);
    expect(screen.getByTestId('wallet-sync-freshness-dot')).toBeInTheDocument();
  });

  it('error: red dot, retry title, button still clickable', () => {
    const onWalletSync = vi.fn();
    const { rerender } = renderPanel({
      reserves: [makeReserve('USDC')], walletLoadState: 'loading', onWalletSync,
    });
    rerender(
      <WagmiProvider config={testWagmiConfig}>
        <QueryClientProvider client={new QueryClient()}>
          <RainbowKitProvider>
            <TooltipProvider>
              <PortfolioPanel
                entries={[]}
                actions={actions}
                reserves={[makeReserve('USDC')]}
                walletLoadState="error"
                onWalletSync={onWalletSync}
              />
            </TooltipProvider>
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>,
    );
    const btn = screen.getByTestId('wallet-sync-button') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    expect(btn.getAttribute('data-wallet-sync-state')).toBe('error');
    expect(btn.getAttribute('title')).toBe('Sync failed — click to retry');
    const dot = screen.getByTestId('wallet-sync-freshness-dot');
    expect(dot.className).toContain('bg-red-400');

    fireEvent.click(btn);
    expect(onWalletSync).toHaveBeenCalledTimes(1);
  });

  it('error → success recovers to idle-synced (no longer error)', () => {
    const reserves = [makeReserve('USDC')];
    const rerenderWith = (state: 'loading' | 'error' | 'success-empty') => (
      <WagmiProvider config={testWagmiConfig}>
        <QueryClientProvider client={new QueryClient()}>
          <RainbowKitProvider>
            <TooltipProvider>
              <PortfolioPanel
                entries={[]}
                actions={actions}
                reserves={reserves}
                walletLoadState={state}
              />
            </TooltipProvider>
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    );
    const { rerender } = render(rerenderWith('loading'));
    rerender(rerenderWith('error'));
    expect(screen.getByTestId('wallet-sync-button').getAttribute('data-wallet-sync-state')).toBe('error');
    rerender(rerenderWith('loading'));
    rerender(rerenderWith('success-empty'));
    const btn = screen.getByTestId('wallet-sync-button');
    expect(btn.getAttribute('data-wallet-sync-state')).toBe('idle-synced');
    expect(btn.getAttribute('title')).toMatch(/^Updated /);
  });

  it('reserves identity change after sync does not produce has-update (sky dot removed)', () => {
    const reservesA = [makeReserve('USDC')];
    const reservesB = [makeReserve('USDC')];
    const tree = (reserves: ReserveWithSpread[], walletLoadState: 'loading' | 'success-empty') => (
      <WagmiProvider config={testWagmiConfig}>
        <QueryClientProvider client={new QueryClient()}>
          <RainbowKitProvider>
            <TooltipProvider>
              <PortfolioPanel
                entries={[]}
                actions={actions}
                reserves={reserves}
                walletLoadState={walletLoadState}
              />
            </TooltipProvider>
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    );
    const { rerender } = render(tree(reservesA, 'loading'));
    rerender(tree(reservesA, 'success-empty'));
    expect(screen.getByTestId('wallet-sync-button').getAttribute('data-wallet-sync-state')).toBe('idle-synced');
    rerender(tree(reservesB, 'success-empty'));
    const btn = screen.getByTestId('wallet-sync-button');
    expect(btn.getAttribute('data-wallet-sync-state')).toBe('idle-synced');
    expect(btn.getAttribute('title')).toMatch(/^Updated /);
    expect(screen.getByTestId('wallet-sync-freshness-dot').className).toContain('bg-emerald-400');
  });
});
