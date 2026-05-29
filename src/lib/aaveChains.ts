export const AAVE_V3_CHAIN_IDS = [
  1, 42161, 43114, 56, 8453, 42220, 100, 59144, 5000,
  1088, 10, 137, 534352, 1868, 146, 196, 324,
] as const

export const AAVE_V4_CHAIN_IDS = [1] as const

const v3Set = new Set<number>(AAVE_V3_CHAIN_IDS)
const v4Set = new Set<number>(AAVE_V4_CHAIN_IDS)

export function isAaveMainnetChain(chainId: number): boolean {
  return v3Set.has(chainId) || v4Set.has(chainId)
}

export function getAaveProtocolVersion(
  chainId: number,
): 'v3' | 'v4' | null {
  if (v4Set.has(chainId)) return 'v4'
  if (v3Set.has(chainId)) return 'v3'
  return null
}
