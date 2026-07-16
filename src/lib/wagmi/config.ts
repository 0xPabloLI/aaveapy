import { createConfig, http } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { injected, walletConnect } from 'wagmi/connectors'
import { watchModeConnector } from './watchModeConnector'

export { mainnet as WALLET_SUPPORTED_CHAINS }

const WALLETCONNECT_PROJECT_ID = 'aaveapy-wallet'

export const wagmiConfig = createConfig({
  chains: [mainnet],
  connectors: [
    injected(),
    walletConnect({ projectId: WALLETCONNECT_PROJECT_ID }),
    watchModeConnector(),
  ],
  transports: {
    [mainnet.id]: http(),
  },
  ssr: true,
})

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}
