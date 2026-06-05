/**
 * Chain Registry — Single Source of Truth for all Aave chain configuration.
 *
 * Add a new chain here; everything else (RPC URLs, wagmi chains, V3/V4 pools,
 * protocol version detection) is derived automatically.
 *
 * CI (`scripts/check-chain-registry-upstream.mjs`) fails when @aave-dao/aave-address-book
 * exposes a new mainnet pool that isn't registered here.
 */

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
  ink,
} from 'wagmi/chains'
import {
  AaveV3Ethereum,
  AaveV3Optimism,
  AaveV3BNB,
  AaveV3Gnosis,
  AaveV3Polygon,
  AaveV3Sonic,
  AaveV3XLayer,
  AaveV3ZkSync,
  AaveV3Soneium,
  AaveV3Celo,
  AaveV3Mantle,
  AaveV3Base,
  AaveV3Metis,
  AaveV3InkWhitelabel,
  AaveV3Linea,
  AaveV3Arbitrum,
  AaveV3Avalanche,
  AaveV3Scroll,
  AaveV4Ethereum,
} from '@aave-dao/aave-address-book'
import { setRegistryChecker, setStaticRpcUrlGetter } from './userData/chainDiscovery'

interface AbModule {
  CHAIN_ID: number
  POOL: string
}

interface ChainEntry {
  abModule: AbModule
  wagmiChain: { id: number; name: string }
  publicRpcUrls: string[]
}

/**
 * All Aave chain deployments we support.
 *
 * To add a new chain:
 * 1. Import the address book module from @aave-dao/aave-address-book
 * 2. Import the corresponding chain from wagmi/chains
 * 3. Add an entry here with public RPC URLs
 *
 * That's it — V3/V4 classification, pool addresses, RPC URLs, and wagmi config
 * are all derived automatically.
 */
const ENTRIES: readonly ChainEntry[] = [
  { abModule: AaveV3Ethereum, wagmiChain: mainnet, publicRpcUrls: ['https://ethereum-rpc.publicnode.com', 'https://eth-mainnet.public.blastapi.io', 'https://eth.drpc.org', 'https://1rpc.io/eth'] },
  { abModule: AaveV3Optimism, wagmiChain: optimism, publicRpcUrls: ['https://public-op-mainnet.fastnode.io', 'https://optimism-rpc.publicnode.com', 'https://optimism.drpc.org', 'https://1rpc.io/op'] },
  { abModule: AaveV3BNB, wagmiChain: bsc, publicRpcUrls: ['https://bsc.publicnode.com', 'https://bsc-mainnet.public.blastapi.io', 'https://1rpc.io/bnb', 'https://bsc.drpc.org'] },
  { abModule: AaveV3Gnosis, wagmiChain: gnosis, publicRpcUrls: ['https://gnosis-rpc.publicnode.com', 'https://rpc.gnosischain.com', 'https://1rpc.io/gnosis', 'https://gnosis.drpc.org', 'https://gnosis.api.onfinality.io/public'] },
  { abModule: AaveV3Polygon, wagmiChain: polygon, publicRpcUrls: ['https://gateway.tenderly.co/public/polygon', 'https://polygon-pokt.nodies.app', 'https://polygon-bor-rpc.publicnode.com', 'https://rpc-mainnet.matic.quiknode.pro', 'https://polygon.drpc.org', 'https://1rpc.io/matic'] },
  { abModule: AaveV3Sonic, wagmiChain: sonic, publicRpcUrls: ['https://rpc.soniclabs.com', 'https://sonic.drpc.org', 'https://sonic-rpc.publicnode.com'] },
  { abModule: AaveV3XLayer, wagmiChain: xLayer, publicRpcUrls: ['https://rpc.xlayer.tech', 'https://xlayerrpc.okx.com', 'https://xlayer.drpc.org', 'https://1rpc.io/xlayer'] },
  { abModule: AaveV3ZkSync, wagmiChain: zkSync, publicRpcUrls: ['https://mainnet.era.zksync.io', 'https://zksync.drpc.org', 'https://1rpc.io/zksync2-era', 'https://zksync-era.public-rpc.com'] },
  { abModule: AaveV3Soneium, wagmiChain: soneium, publicRpcUrls: ['https://soneium.drpc.org', 'https://rpc.soneium.org', 'https://soneium-rpc.publicnode.com', 'https://soneium.gateway.tenderly.co'] },
  { abModule: AaveV3Celo, wagmiChain: celo, publicRpcUrls: ['https://celo.drpc.org', 'https://forno.celo.org', 'https://celo-mainnet.gateway.tatum.io'] },
  { abModule: AaveV3Mantle, wagmiChain: mantle, publicRpcUrls: ['https://rpc.mantle.xyz', 'https://mantle.publicnode.com', 'https://mantle.drpc.org', 'https://mantle.gateway.tenderly.co'] },
  { abModule: AaveV3Base, wagmiChain: base, publicRpcUrls: ['https://1rpc.io/base', 'https://base.llamarpc.com', 'https://base.publicnode.com', 'https://base-mainnet.public.blastapi.io', 'https://base.drpc.org'] },
  { abModule: AaveV3Metis, wagmiChain: metis, publicRpcUrls: ['https://andromeda.metis.io/?owner=1088', 'https://metis-rpc.publicnode.com', 'https://metis.drpc.org', 'https://metis-andromeda.gateway.tenderly.co'] },
  { abModule: AaveV3InkWhitelabel, wagmiChain: ink, publicRpcUrls: ['https://rpc-gel.inkonchain.com', 'https://rpc-qnd.inkonchain.com', 'https://ink.drpc.org'] },
  { abModule: AaveV3Linea, wagmiChain: linea, publicRpcUrls: ['https://1rpc.io/linea', 'https://linea.drpc.org', 'https://linea-rpc.publicnode.com', 'https://rpc.linea.build'] },
  { abModule: AaveV3Arbitrum, wagmiChain: arbitrum, publicRpcUrls: ['https://arb1.arbitrum.io/rpc', 'https://1rpc.io/arb', 'https://arbitrum.drpc.org', 'https://arbitrum-one-rpc.publicnode.com'] },
  { abModule: AaveV3Avalanche, wagmiChain: avalanche, publicRpcUrls: ['https://api.avax.network/ext/bc/C/rpc', 'https://avalanche.drpc.org', 'https://1rpc.io/avax/c', 'https://avalanche-c-chain-rpc.publicnode.com'] },
  { abModule: AaveV3Scroll, wagmiChain: scroll, publicRpcUrls: ['https://rpc.scroll.io', 'https://scroll-rpc.publicnode.com', 'https://scroll.drpc.org', 'https://1rpc.io/scroll'] },
  { abModule: AaveV4Ethereum, wagmiChain: mainnet, publicRpcUrls: [] },
] as const

// ---- Derived exports ----

function isV4(entry: ChainEntry): boolean {
  return entry.abModule === (AaveV4Ethereum as unknown as AbModule)
}

/** All chain IDs we support (deduplicated, since Ethereum has both V3 and V4) */
const allChainIds = [...new Set(ENTRIES.map((e) => e.abModule.CHAIN_ID))] as const
export const AAVE_CHAIN_IDS = allChainIds
export type AaveChainId = (typeof AAVE_CHAIN_IDS)[number]

/** V3 chain IDs */
const v3ChainIds = [...new Set(ENTRIES.filter((e) => !isV4(e)).map((e) => e.abModule.CHAIN_ID))] as const
export const AAVE_V3_CHAIN_IDS = v3ChainIds

/** V4 chain IDs */
const v4ChainIds = [...new Set(ENTRIES.filter(isV4).map((e) => e.abModule.CHAIN_ID))] as const
export const AAVE_V4_CHAIN_IDS = v4ChainIds

const v3Set = new Set<number>(AAVE_V3_CHAIN_IDS)
const v4Set = new Set<number>(AAVE_V4_CHAIN_IDS)

export function isAaveMainnetChain(chainId: number): boolean {
  return v3Set.has(chainId) || v4Set.has(chainId)
}

export function getAaveProtocolVersion(chainId: number): 'v3' | 'v4' | null {
  if (v4Set.has(chainId)) return 'v4'
  if (v3Set.has(chainId)) return 'v3'
  return null
}

/** V3 pool address lookup — derived from address book modules */
export const V3_POOL_ADDRESSES: Record<string, string> = Object.fromEntries(
  ENTRIES.filter((e) => !isV4(e)).map((e) => [String(e.abModule.CHAIN_ID), e.abModule.POOL]),
)

/** Public RPC URLs map — skip V4 entries (share chainId with V3 and have no RPC URLs of their own) */
export const PUBLIC_RPC_URLS: Record<number, string[]> = Object.fromEntries(
  ENTRIES.filter((e) => !isV4(e) && e.publicRpcUrls.length > 0).map((e) => [e.abModule.CHAIN_ID, e.publicRpcUrls]),
)

export function getPublicRpcUrls(chainId: number): string[] {
  return PUBLIC_RPC_URLS[chainId] ?? []
}

/** Wagmi supported chains array — derived from registry entries (deduplicated) */
const seenWagmi = new Set<number>()
export const WALLET_SUPPORTED_CHAINS = ENTRIES
  .filter((e) => {
    if (seenWagmi.has(e.abModule.CHAIN_ID)) return false
    seenWagmi.add(e.abModule.CHAIN_ID)
    return true
  })
  .map((e) => e.wagmiChain) as typeof ENTRIES extends readonly { wagmiChain: infer W }[]
    ? readonly W[]
    : never

// ---- Runtime discovery integration ----

// Register the checker so chainDiscovery can detect unregistered chains
// without circular imports
const registryChainSetForDiscovery = new Set<number>(AAVE_CHAIN_IDS)
setRegistryChecker((chainId: number) => registryChainSetForDiscovery.has(chainId))
setStaticRpcUrlGetter((chainId: number) => PUBLIC_RPC_URLS[chainId] ?? [])
