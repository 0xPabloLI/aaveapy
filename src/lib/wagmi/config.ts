import { createConfig, fallback, http } from 'wagmi'
import {
  mainnet,
  optimism,
  bsc,
  gnosis,
  polygon,
  sonic,
  xLayer,
  zkSync,
  soneium,
  celo,
  mantle,
  base,
  metis,
  linea,
  arbitrum,
  avalanche,
  scroll,
} from 'wagmi/chains'
import { injected, walletConnect } from 'wagmi/connectors'
import { PUBLIC_RPC_URLS } from '../publicRpcUrls'
import { watchModeConnector } from './watchModeConnector'

const WALLETCONNECT_PROJECT_ID = 'aaveapy-wallet'

export const WALLET_SUPPORTED_CHAINS = [
  mainnet,
  optimism,
  bsc,
  gnosis,
  polygon,
  sonic,
  xLayer,
  zkSync,
  soneium,
  celo,
  mantle,
  base,
  metis,
  linea,
  arbitrum,
  avalanche,
  scroll,
] as const

function chainTransport(chainId: number) {
  const urls = PUBLIC_RPC_URLS[chainId as keyof typeof PUBLIC_RPC_URLS]
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
