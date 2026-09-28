import { createConnector, type CreateConnectorFn } from 'wagmi';
import { injected, mock, walletConnect, type InjectedParameters } from 'wagmi/connectors';
import type { EIP1193Provider } from 'viem';
import { type RainbowKitWalletConnectParameters, type Wallet } from '@rainbow-me/rainbowkit';

/**
 * Local RainbowKit wallet factories for the modal-listed connectors.
 *
 * Why local copies instead of `@rainbow-me/rainbowkit/wallets`: the barrel
 * statically imports `gemini` from wagmi/connectors, and @wagmi/connectors 8.x
 * (wagmi 3.6.16) no longer exports it — importing the barrel fails BOTH the
 * production build (rolldown "Missing export") and Vitest. Only these two
 * factories are needed (AAV-1282); they mirror RainbowKit 2.2.11's
 * `injectedWallet` / `walletConnectWallet` dist behavior exactly (provider
 * detection, WC instance sharing, server-side mock). Migrate back to the
 * barrel if the upstream incompatibility is ever fixed.
 *
 * IDs and names match RainbowKit's own (`injected` / "Browser Wallet",
 * `walletConnect` / "WalletConnect") so wagmi persistence, reconnect scoring
 * and modal rendering stay identical. `connectorsForWallets` (main entry, no
 * barrel involved) injects the `rkDetails` marker that RainbowKit's mobile
 * modal requires. See docs/specs/aav-1282-mobile-connect-modal-rainbowkit-wallets.md.
 */

type WalletDetails = Parameters<Wallet['createConnector']>[0];

/** WalletConnect metadata is computed by `connectorsForWallets` from appName. */
type WalletConnectWalletOptions = {
  projectId: string;
  options?: RainbowKitWalletConnectParameters;
};

const INJECTED_WALLET_ICON =
  'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2228%22%20height%3D%2228%22%20fill%3D%22none%22%3E%3Cpath%20fill%3D%22%23fff%22%20d%3D%22M0%200h28v28H0z%22%2F%3E%3Crect%20width%3D%2220%22%20height%3D%2216%22%20x%3D%224%22%20y%3D%226%22%20fill%3D%22url(%23a)%22%20rx%3D%223.5%22%2F%3E%3Cpath%20fill%3D%22%230E76FD%22%20d%3D%22M16%2014a3%203%200%200%201%203-3h4.4c.56%200%20.84%200%201.054.109a1%201%200%200%201%20.437.437C25%2011.76%2025%2012.04%2025%2012.6v2.8c0%20.56%200%20.84-.109%201.054a1%201%200%200%201-.437.437C24.24%2017%2023.96%2017%2023.4%2017H19a3%203%200%200%201-3-3Z%22%2F%3E%3Ccircle%20cx%3D%2219%22%20cy%3D%2214%22%20r%3D%221.25%22%20fill%3D%22%23A3D7FF%22%2F%3E%3Cdefs%3E%3ClinearGradient%20id%3D%22a%22%20x1%3D%2214%22%20x2%3D%2214%22%20y1%3D%226%22%20y2%3D%2222%22%20gradientUnits%3D%22userSpaceOnUse%22%3E%3Cstop%20stop-color%3D%22%23174299%22%2F%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23001E59%22%2F%3E%3C%2FlinearGradient%3E%3C%2Fdefs%3E%3C%2Fsvg%3E';

const WALLETCONNECT_WALLET_ICON =
  'data:image/svg+xml,%3Csvg%20width%3D%2228%22%20height%3D%2228%22%20viewBox%3D%220%200%2028%2028%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%0A%3Crect%20width%3D%2228%22%20height%3D%2228%22%20fill%3D%22%233B99FC%22%2F%3E%0A%3Cpath%20d%3D%22M8.38969%2010.3739C11.4882%207.27538%2016.5118%207.27538%2019.6103%2010.3739L19.9832%2010.7468C20.1382%2010.9017%2020.1382%2011.1529%2019.9832%2011.3078L18.7076%2012.5835C18.6301%2012.6609%2018.5045%2012.6609%2018.4271%2012.5835L17.9139%2012.0703C15.7523%209.9087%2012.2477%209.9087%2010.0861%2012.0703L9.53655%2012.6198C9.45909%2012.6973%209.3335%2012.6973%209.25604%2012.6198L7.98039%2011.3442C7.82547%2011.1893%207.82547%2010.9381%207.98039%2010.7832L8.38969%2010.3739ZM22.2485%2013.012L23.3838%2014.1474C23.5387%2014.3023%2023.5387%2014.5535%2023.3838%2014.7084L18.2645%2019.8277C18.1096%2019.9827%2017.8584%2019.9827%2017.7035%2019.8277C17.7035%2019.8277%2017.7035%2019.8277%2017.7035%2019.8277L14.0702%2016.1944C14.0314%2016.1557%2013.9686%2016.1557%2013.9299%2016.1944C13.9299%2016.1944%2013.9299%2016.1944%2013.9299%2016.1944L10.2966%2019.8277C10.1417%2019.9827%209.89053%2019.9827%209.73561%2019.8278C9.7356%2019.8278%209.7356%2019.8277%209.7356%2019.8277L4.61619%2014.7083C4.46127%2014.5534%204.46127%2014.3022%204.61619%2014.1473L5.75152%2013.012C5.90645%2012.857%206.15763%2012.857%206.31255%2013.012L9.94595%2016.6454C9.98468%2016.6841%2010.0475%2016.6841%2010.0862%2016.6454C10.0862%2016.6454%2010.0862%2016.6454%2010.0862%2016.6454L13.7194%2013.012C13.8743%2012.857%2014.1255%2012.857%2014.2805%2013.012C14.2805%2013.012%2014.2805%2013.012%2014.2805%2013.012L17.9139%2016.6454C17.9526%2016.6841%2018.0154%2016.6841%2018.0541%2016.6454L21.6874%2013.012C21.8424%2012.8571%2022.0936%2012.8571%2022.2485%2013.012Z%22%20fill%3D%22white%22%2F%3E%0A%3C%2Fsvg%3E%0A';

// --- WalletConnect instance sharing (mirrors getOrCreateWalletConnectInstance) ---

const isServer = typeof window === 'undefined';
const walletConnectInstances = new Map<string, CreateConnectorFn>();

function getOrCreateWalletConnectInstance({
  projectId,
  walletConnectParameters,
  walletDetails,
}: {
  projectId: string;
  walletConnectParameters?: RainbowKitWalletConnectParameters;
  walletDetails: WalletDetails;
}): CreateConnectorFn {
  // Server render / node test env has no wallet runtime — wagmi's mock keeps
  // config creation side-effect free (RainbowKit parity).
  if (isServer) {
    const mockAddress = '0x0000000000000000000000000000000000000000';
    return mock({ accounts: [mockAddress] });
  }

  // `customStoragePrefix` is accepted by the WC relay client at runtime but
  // is not surfaced by wagmi's WalletConnectParameters type — carry it via an
  // intersection (RainbowKit parity: clientOne = modal twin, clientTwo = list).
  type WalletConnectConfig = NonNullable<Parameters<typeof walletConnect>[0]> & { customStoragePrefix?: string };

  let config: WalletConnectConfig = {
    telemetryEnabled: false, // Disable analytics by default
    ...(walletConnectParameters ?? {}),
    projectId,
    // Required. Otherwise the WalletConnect modal (Web3Modal) will popup
    // during connection for a wallet.
    showQrModal: false,
  };
  if (walletDetails.rkDetails.showQrModal) {
    config = { ...config, showQrModal: true };
  }
  if (!('customStoragePrefix' in config)) {
    config = {
      ...config,
      // Distinct prefixes keep the modal-twin connector and the regular one
      // from sharing WC relay clients.
      customStoragePrefix: walletDetails.rkDetails.isWalletConnectModalConnector ? 'clientOne' : 'clientTwo',
    };
  }

  const serializedConfig = JSON.stringify(config);
  const sharedWalletConnector = walletConnectInstances.get(serializedConfig);
  if (sharedWalletConnector) return sharedWalletConnector;

  const newWalletConnectInstance = walletConnect(config);
  walletConnectInstances.set(serializedConfig, newWalletConnectInstance);
  return newWalletConnectInstance;
}

// --- Wallet factories (CreateWalletFn shape: invoked by connectorsForWallets) ---

/** wagmi's Target['provider'] slot — the detected window provider fits structurally. */
type WagmiTargetProvider = NonNullable<Extract<NonNullable<InjectedParameters['target']>, { id: string }>['provider']>;

type WindowWithEthereum = { ethereum?: EIP1193Provider & { providers?: EIP1193Provider[] } };

/**
 * Mirrors getInjectedProvider({}) with no flag/namespace: multi-provider
 * runners (providers array) use the first provider, otherwise window.ethereum.
 * Detected once at config-creation time — the init script (real wallet or e2e
 * mock) always runs before the lazy wallet chunk loads.
 */
function getInjectedProvider(): WindowWithEthereum['ethereum'] {
  if (typeof window === 'undefined') return undefined;
  const windowProvider = (window as unknown as WindowWithEthereum).ethereum;
  const { providers } = windowProvider ?? {};
  if (Array.isArray(providers) && providers.length > 0) return providers[0];
  return windowProvider;
}

export const injectedWallet = (): Wallet => ({
  id: 'injected',
  name: 'Browser Wallet',
  iconUrl: INJECTED_WALLET_ICON,
  iconBackground: '#fff',
  createConnector: (walletDetails) => {
    const provider = getInjectedProvider();
    // Pinning the detected provider (target) skips wagmi's EIP-6963 discovery
    // for this connector — RainbowKit parity: the modal lists the entry
    // regardless and connects straight to the window provider.
    const injectedConfig: InjectedParameters = provider
      ? {
          target: () => ({
            id: walletDetails.rkDetails.id,
            name: walletDetails.rkDetails.name,
            provider: provider as WagmiTargetProvider,
          }),
        }
      : {};
    return createConnector((config) => ({
      ...injected(injectedConfig)(config),
      ...walletDetails,
    }));
  },
});

export const walletConnectWallet = ({ projectId, options }: WalletConnectWalletOptions): Wallet => ({
  id: 'walletConnect',
  name: 'WalletConnect',
  iconUrl: WALLETCONNECT_WALLET_ICON,
  iconBackground: '#3b99fc',
  qrCode: { getUri: (uri) => uri },
  createConnector: (walletDetails) =>
    createConnector((config) => ({
      ...getOrCreateWalletConnectInstance({ projectId, walletConnectParameters: options, walletDetails })(config),
      ...walletDetails,
    })),
});
