export const AAVE_CHAIN_IDS = [
  1, 10, 56, 100, 137, 146, 196, 324, 1868, 42220,
  5000, 8453, 1088, 59144, 42161, 43114, 534352,
] as const

export type AaveChainId = (typeof AAVE_CHAIN_IDS)[number]

export const PUBLIC_RPC_URLS: Record<AaveChainId, string[]> = {
  1: [
    'https://ethereum-rpc.publicnode.com',
    'https://eth-mainnet.public.blastapi.io',
    'https://eth.drpc.org',
    'https://1rpc.io/eth',
  ],
  10: [
    'https://public-op-mainnet.fastnode.io',
    'https://optimism-rpc.publicnode.com',
    'https://optimism.drpc.org',
    'https://1rpc.io/op',
  ],
  56: [
    'https://bsc.publicnode.com',
    'https://bsc-mainnet.public.blastapi.io',
    'https://1rpc.io/bnb',
    'https://bsc.drpc.org',
  ],
  100: [
    'https://gnosis-rpc.publicnode.com',
    'https://rpc.gnosischain.com',
    'https://1rpc.io/gnosis',
    'https://gnosis.drpc.org',
    'https://gnosis.api.onfinality.io/public',
  ],
  137: [
    'https://gateway.tenderly.co/public/polygon',
    'https://polygon-pokt.nodies.app',
    'https://polygon-bor-rpc.publicnode.com',
    'https://rpc-mainnet.matic.quiknode.pro',
    'https://polygon.drpc.org',
    'https://1rpc.io/matic',
  ],
  146: [
    'https://rpc.soniclabs.com',
    'https://sonic.drpc.org',
    'https://sonic-rpc.publicnode.com',
  ],
  196: [
    'https://rpc.xlayer.tech',
    'https://xlayerrpc.okx.com',
    'https://xlayer.drpc.org',
    'https://1rpc.io/xlayer',
  ],
  324: [
    'https://mainnet.era.zksync.io',
    'https://zksync.drpc.org',
    'https://1rpc.io/zksync2-era',
    'https://zksync-era.public-rpc.com',
  ],
  1868: [
    'https://soneium.drpc.org',
    'https://rpc.soneium.org',
    'https://soneium-rpc.publicnode.com',
    'https://soneium.gateway.tenderly.co',
  ],
  42220: [
    'https://celo.drpc.org',
    'https://forno.celo.org',
    'https://celo-mainnet.gateway.tatum.io',
  ],
  5000: [
    'https://rpc.mantle.xyz',
    'https://mantle.publicnode.com',
    'https://mantle.drpc.org',
    'https://mantle.gateway.tenderly.co',
  ],
  8453: [
    'https://1rpc.io/base',
    'https://base.llamarpc.com',
    'https://base.publicnode.com',
    'https://base-mainnet.public.blastapi.io',
    'https://base.drpc.org',
  ],
  1088: [
    'https://andromeda.metis.io/?owner=1088',
    'https://metis-rpc.publicnode.com',
    'https://metis.drpc.org',
    'https://metis-andromeda.gateway.tenderly.co',
  ],
  59144: [
    'https://1rpc.io/linea',
    'https://linea.drpc.org',
    'https://linea-rpc.publicnode.com',
    'https://rpc.linea.build',
  ],
  42161: [
    'https://arb1.arbitrum.io/rpc',
    'https://1rpc.io/arb',
    'https://arbitrum.drpc.org',
    'https://arbitrum-one-rpc.publicnode.com',
  ],
  43114: [
    'https://api.avax.network/ext/bc/C/rpc',
    'https://avalanche.drpc.org',
    'https://1rpc.io/avax/c',
    'https://avalanche-c-chain-rpc.publicnode.com',
  ],
  534352: [
    'https://rpc.scroll.io',
    'https://scroll-rpc.publicnode.com',
    'https://scroll.drpc.org',
    'https://1rpc.io/scroll',
  ],
}

export function getPublicRpcUrls(chainId: number): string[] {
  return PUBLIC_RPC_URLS[chainId as AaveChainId] ?? []
}
