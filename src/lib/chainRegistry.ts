/**
 * Chain Registry — auto-discovers all Aave chains from @aave-dao/aave-address-book.
 *
 * Zero-latency: when the address book adds a new chain, it's immediately
 * available here — no CI step, no manual registration.
 *
 * The only manual data is:
 * 1. CHAIN_RPC_URLS — curated RPC URLs per chainId (optional; chainDiscovery
 *    handles chains not listed here via wagmi/chains → chainid.network → chainlist.org)
 * 2. WAGMI_CHAINS — explicit wagmi chain imports for wallet connection
 *    (chains not imported here are still tracked but can't connect wallets)
 */

import * as ab from '@aave-dao/aave-address-book'
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
  megaeth,
  plasma,
  monad,
} from 'wagmi/chains'
import { setRegistryChecker, setStaticRpcUrlGetter, setWagmiChainRpcUrlGetter } from './userData/chainDiscovery'

// ---------------------------------------------------------------------------
// Module filtering
// ---------------------------------------------------------------------------

const TESTNET_KEYWORDS = ['Sepolia', 'Fuji', 'Testnet']
const BASE_MODULES = ['AaveV3', 'AaveV4']
const SKIPPED_CHAINS = ['AaveV3Fantom', 'AaveV3Harmony']
const ETHEREUM_SUB_POOLS = ['AaveV3EthereumEtherFi', 'AaveV3EthereumHorizon', 'AaveV3EthereumLido']

function shouldIncludeModule(name: string): boolean {
  if (BASE_MODULES.includes(name)) return false
  if (TESTNET_KEYWORDS.some((kw) => name.includes(kw))) return false
  if (SKIPPED_CHAINS.includes(name)) return false
  if (ETHEREUM_SUB_POOLS.includes(name)) return false
  return true
}

// ---------------------------------------------------------------------------
// Address book module types
// ---------------------------------------------------------------------------

interface AbModuleBase {
  CHAIN_ID: number
  POOL?: string
  SPOKES?: Record<string, string>
  HUBS?: Record<string, string>
}

interface DiscoveredEntry {
  version: 'v3' | 'v4'
  moduleName: string
  chainId: number
  pool?: string
}

// ---------------------------------------------------------------------------
// Auto-discover all Aave mainnet chains from the address book
// ---------------------------------------------------------------------------

const ENTRIES: readonly DiscoveredEntry[] = (() => {
  const result: DiscoveredEntry[] = []
  for (const [name, mod] of Object.entries(ab)) {
    if (!shouldIncludeModule(name)) continue
    const m = mod as AbModuleBase
    if (!m || typeof m.CHAIN_ID !== 'number') continue

    // V3: has POOL address
    if (typeof m.POOL === 'string' && m.POOL.startsWith('0x')) {
      result.push({ version: 'v3', moduleName: name, chainId: m.CHAIN_ID, pool: m.POOL })
      continue
    }
    // V4: has SPOKES (Hub & Spoke architecture, no single POOL)
    if (m.SPOKES && typeof m.SPOKES === 'object') {
      result.push({ version: 'v4', moduleName: name, chainId: m.CHAIN_ID })
      continue
    }
  }
  return result
})()

// ---------------------------------------------------------------------------
// Curated RPC URLs — chain-level (shared by V3 and V4 on the same chain)
// ---------------------------------------------------------------------------

/**
 * Curated public RPC URLs per chain. Optional — chains not listed here
 * fall back to runtime chainDiscovery (wagmi/chains → chainid.network → chainlist.org).
 *
 * To add RPC URLs for a new chain: add an entry here. That's it.
 */
const CHAIN_RPC_URLS: Record<number, readonly string[]> = {
  1: ['https://ethereum-rpc.publicnode.com', 'https://eth-mainnet.public.blastapi.io', 'https://eth.drpc.org', 'https://1rpc.io/eth'],
  10: ['https://public-op-mainnet.fastnode.io', 'https://optimism-rpc.publicnode.com', 'https://optimism.drpc.org', 'https://1rpc.io/op'],
  56: ['https://bsc.publicnode.com', 'https://bsc-mainnet.public.blastapi.io', 'https://1rpc.io/bnb', 'https://bsc.drpc.org'],
  100: ['https://gnosis-rpc.publicnode.com', 'https://rpc.gnosischain.com', 'https://1rpc.io/gnosis', 'https://gnosis.drpc.org', 'https://gnosis.api.onfinality.io/public'],
  137: ['https://gateway.tenderly.co/public/polygon', 'https://polygon-pokt.nodies.app', 'https://polygon-bor-rpc.publicnode.com', 'https://rpc-mainnet.matic.quiknode.pro', 'https://polygon.drpc.org', 'https://1rpc.io/matic'],
  146: ['https://rpc.soniclabs.com', 'https://sonic.drpc.org', 'https://sonic-rpc.publicnode.com'],
  196: ['https://rpc.xlayer.tech', 'https://xlayerrpc.okx.com', 'https://xlayer.drpc.org', 'https://1rpc.io/xlayer'],
  324: ['https://mainnet.era.zksync.io', 'https://zksync.drpc.org', 'https://1rpc.io/zksync2-era', 'https://zksync-era.public-rpc.com'],
  1868: ['https://soneium.drpc.org', 'https://rpc.soneium.org', 'https://soneium-rpc.publicnode.com', 'https://soneium.gateway.tenderly.co'],
  42220: ['https://celo.drpc.org', 'https://forno.celo.org', 'https://celo-mainnet.gateway.tatum.io'],
  5000: ['https://rpc.mantle.xyz', 'https://mantle.publicnode.com', 'https://mantle.drpc.org', 'https://mantle.gateway.tenderly.co'],
  8453: ['https://1rpc.io/base', 'https://base.llamarpc.com', 'https://base.publicnode.com', 'https://base-mainnet.public.blastapi.io', 'https://base.drpc.org'],
  1088: ['https://andromeda.metis.io/?owner=1088', 'https://metis-rpc.publicnode.com', 'https://metis.drpc.org', 'https://metis-andromeda.gateway.tenderly.co'],
  57073: ['https://rpc-gel.inkonchain.com', 'https://rpc-qnd.inkonchain.com', 'https://ink.drpc.org'],
  59144: ['https://1rpc.io/linea', 'https://linea.drpc.org', 'https://linea-rpc.publicnode.com', 'https://rpc.linea.build'],
  42161: ['https://arb1.arbitrum.io/rpc', 'https://1rpc.io/arb', 'https://arbitrum.drpc.org', 'https://arbitrum-one-rpc.publicnode.com'],
  43114: ['https://api.avax.network/ext/bc/C/rpc', 'https://avalanche.drpc.org', 'https://1rpc.io/avax/c', 'https://avalanche-c-chain-rpc.publicnode.com'],
  534352: ['https://rpc.scroll.io', 'https://scroll-rpc.publicnode.com', 'https://scroll.drpc.org', 'https://1rpc.io/scroll'],
  4326: ['https://mainnet.megaeth.com/rpc', 'https://megaeth.drpc.org'],
  9745: ['https://rpc.plasma.to', 'https://plasma.drpc.org', 'https://plasma.api.onfinality.io/public'],
  143: ['https://rpc.monad.xyz', 'https://monad.drpc.org'],
}

export const PUBLIC_RPC_URLS: Record<number, string[]> = CHAIN_RPC_URLS

export function getPublicRpcUrls(chainId: number): string[] {
  return CHAIN_RPC_URLS[chainId] ?? []
}

// ---------------------------------------------------------------------------
// Wagmi chain lookup — for wallet connection
// ---------------------------------------------------------------------------

const WAGMI_CHAINS_BY_ID = new Map<number, { id: number; name: string; nativeCurrency: { name: string; symbol: string; decimals: number }; rpcUrls: { default: { http: readonly string[] } } }>([
  [mainnet.id, mainnet],
  [optimism.id, optimism],
  [bsc.id, bsc],
  [gnosis.id, gnosis],
  [polygon.id, polygon],
  [sonic.id, sonic],
  [xLayer.id, xLayer],
  [zkSync.id, zkSync],
  [soneium.id, soneium],
  [celo.id, celo],
  [mantle.id, mantle],
  [base.id, base],
  [metis.id, metis],
  [linea.id, linea],
  [arbitrum.id, arbitrum],
  [avalanche.id, avalanche],
  [scroll.id, scroll],
  [ink.id, ink],
  [megaeth.id, megaeth],
  [plasma.id, plasma],
  [monad.id, monad],
])

// ---------------------------------------------------------------------------
// Derived exports
// ---------------------------------------------------------------------------

/** All chain IDs we support (deduplicated, since Ethereum has both V3 and V4) */
const allChainIds = [...new Set(ENTRIES.map((e) => e.chainId))] as const
export const AAVE_CHAIN_IDS = allChainIds
export type AaveChainId = (typeof AAVE_CHAIN_IDS)[number]

/** V3 chain IDs */
const v3ChainIds = [...new Set(ENTRIES.filter((e) => e.version === 'v3').map((e) => e.chainId))] as const
export const AAVE_V3_CHAIN_IDS = v3ChainIds

/** V4 chain IDs */
const v4ChainIds = [...new Set(ENTRIES.filter((e) => e.version === 'v4').map((e) => e.chainId))] as const
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

/** V3 pool address lookup — auto-discovered from address book */
export const V3_POOL_ADDRESSES: Record<string, string> = Object.fromEntries(
  ENTRIES
    .filter((e) => e.version === 'v3' && e.pool)
    .map((e) => [String(e.chainId), e.pool!]),
)

/** Wagmi supported chains — chains with wagmi imports (for wallet connection) */
const seenWagmi = new Set<number>()
export const WALLET_SUPPORTED_CHAINS = ENTRIES
  .filter((e) => {
    if (seenWagmi.has(e.chainId)) return false
    seenWagmi.add(e.chainId)
    return WAGMI_CHAINS_BY_ID.has(e.chainId)
  })
  .map((e) => WAGMI_CHAINS_BY_ID.get(e.chainId)!)

// ---------------------------------------------------------------------------
// Runtime discovery integration
// ---------------------------------------------------------------------------

const registryChainSetForDiscovery = new Set<number>(AAVE_CHAIN_IDS)
setRegistryChecker((chainId: number) => registryChainSetForDiscovery.has(chainId))
setStaticRpcUrlGetter((chainId: number) => CHAIN_RPC_URLS[chainId] ?? [])
setWagmiChainRpcUrlGetter((chainId: number) => {
  const chain = WAGMI_CHAINS_BY_ID.get(chainId)
  if (!chain) return []
  return [...chain.rpcUrls.default.http]
})
