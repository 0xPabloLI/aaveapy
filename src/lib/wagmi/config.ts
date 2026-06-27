import { createConfig, fallback, http } from 'wagmi'
import { injected, walletConnect } from 'wagmi/connectors'
import { WALLET_SUPPORTED_CHAINS, PUBLIC_RPC_URLS } from '../chainRegistry'
import { watchModeConnector } from './watchModeConnector'

export { WALLET_SUPPORTED_CHAINS } from '../chainRegistry'

const WALLETCONNECT_PROJECT_ID = 'aaveapy-wallet'

function chainTransport(chainId: number) {
  const urls = PUBLIC_RPC_URLS[chainId]
  if (!urls || urls.length === 0) return http()
  if (urls.length === 1) return http(urls[0])
  return fallback(urls.map((url) => http(url)))
}

export const wagmiConfig = createConfig({
  chains: WALLET_SUPPORTED_CHAINS,
  connectors: [
    injected(),
    walletConnect({ projectId: WALLETCONNECT_PROJECT_ID }),
    watchModeConnector(),
  ],
  transports: Object.fromEntries(
    WALLET_SUPPORTED_CHAINS.map((chain) => [chain.id, chainTransport(chain.id)]),
  ),
  ssr: true,
})

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}
