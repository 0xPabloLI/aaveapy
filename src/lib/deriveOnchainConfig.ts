import type { ReserveWithSpread } from '@/types/aave'
import { V4_SPOKE_ADDRESSES } from '@/lib/userData/aaveV4UserClient'

function lookupSpokeName(chainId: number, spokeAddress: string): string | null {
  const spokes = V4_SPOKE_ADDRESSES[chainId]
  if (!spokes) return null
  const spoke = spokes.find(s => s.address.toLowerCase() === spokeAddress.toLowerCase())
  return spoke?.name ?? null
}

export function decodeV4ReserveId(aaveProReserveId?: string): bigint | null {
  if (!aaveProReserveId) return null
  try {
    const decoded = atob(aaveProReserveId)
    const separatorIdx = decoded.indexOf('::')
    if (separatorIdx === -1) return null
    const numericPart = decoded.slice(0, separatorIdx)
    const reserveId = BigInt(numericPart)
    return reserveId
  } catch {
    return null
  }
}

export function deriveV3AssetsByChain(
  reserves: ReserveWithSpread[],
): Record<number, `0x${string}`[]> {
  const map = new Map<number, Set<string>>()

  for (const r of reserves) {
    if (r.spokeAddress) continue
    const assets = map.get(r.chainId) ?? new Set<string>()
    assets.add(r.tokenAddress)
    map.set(r.chainId, assets)
  }

  const result: Record<number, `0x${string}`[]> = {}
  for (const [chainId, assets] of map) {
    result[chainId] = [...assets] as `0x${string}`[]
  }
  return result
}

export function deriveV4ReservesBySpoke(
  reserves: ReserveWithSpread[],
): Record<string, { reserveId: bigint; asset: `0x${string}` }[]> {
  const map = new Map<string, { reserveId: bigint; asset: `0x${string}` }[]>()

  for (const r of reserves) {
    if (!r.spokeAddress) continue
    const reserveId = decodeV4ReserveId(r.aaveProReserveId)
    if (reserveId === null) continue

    const spokeName = lookupSpokeName(r.chainId, r.spokeAddress)
    if (!spokeName) continue

    const entries = map.get(spokeName) ?? []
    entries.push({ reserveId, asset: r.tokenAddress as `0x${string}` })
    map.set(spokeName, entries)
  }

  const result: Record<string, { reserveId: bigint; asset: `0x${string}` }[]> = {}
  for (const [name, entries] of map) {
    result[name] = entries
  }
  return result
}
