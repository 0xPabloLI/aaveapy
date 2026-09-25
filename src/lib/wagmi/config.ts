import { createConfig, http } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import { injectedWallet, walletConnectWallet } from './rainbowKitWallets';
import { watchModeConnector } from './watchModeConnector';

export { mainnet as WALLET_SUPPORTED_CHAINS };

// WalletConnect Cloud projectId (Reown dashboard, cloud.walletconnect.com) —
// public by design; the dashboard's domain allowlist is what guards misuse.
const WALLETCONNECT_PROJECT_ID = 'bb22b46d186e6bc48099189cc912dbe6';

/**
 * Modal-listed wallets must be created via `connectorsForWallets`: RainbowKit's
 * mobile modal only renders connectors carrying `rkDetails.isRainbowKitConnector`
 * (plain wagmi connectors leave the mobile wallet list empty; the desktop modal
 * also merges EIP-6963 connectors, so it worked without this). The factories
 * wrap the same wagmi `injected()` / `walletConnect()` connectors as before —
 * `rkDetails` is a marker overlay, not a different connector. See AAV-1282 /
 * docs/specs/aav-1282-mobile-connect-modal-rainbowkit-wallets.md.
 */
const walletModalConnectors = connectorsForWallets(
  [{ groupName: 'Recommended', wallets: [injectedWallet, walletConnectWallet] }],
  { projectId: WALLETCONNECT_PROJECT_ID, appName: 'AaveAPY' },
);

export const wagmiConfig = createConfig({
  chains: [mainnet],
  connectors: [...walletModalConnectors, watchModeConnector()],
  transports: {
    [mainnet.id]: http(),
  },
  ssr: true,
});

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig;
  }
}
