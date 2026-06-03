import type { ReserveWithSpread } from '@/types/aave'
import { getProtocolVersion } from '@/lib/protocolVersion'

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

export interface V3AssetsByMarket {
  chainId: number
  assets: `0x${string}`[]
}

export function deriveV3AssetsByMarket(
  reserves: ReserveWithSpread[],
): Record<string, V3AssetsByMarket> {
  const map = new Map<string, { chainId: number; assets: Set<string> }>()

  for (const r of reserves) {
    if (getProtocolVersion(r.marketName) === 'v4') continue
    const existing = map.get(r.marketName)
    if (existing) {
      existing.assets.add(r.tokenAddress)
    } else {
      map.set(r.marketName, { chainId: r.chainId, assets: new Set([r.tokenAddress]) })
    }
  }

  const result: Record<string, V3AssetsByMarket> = {}
  for (const [marketName, { chainId, assets }] of map) {
    result[marketName] = { chainId, assets: [...assets] as `0x${string}`[] }
  }
  return result
}

export function deriveV4ReservesBySpoke(
  reserves: ReserveWithSpread[],
): Record<string, { reserveId: bigint; asset: `0x${string}` }[]> {
  const map = new Map<string, { reserveId: bigint; asset: `0x${string}` }[]>()

  for (const r of reserves) {
    if (getProtocolVersion(r.marketName) !== 'v4') continue
    const reserveId = decodeV4ReserveId(r.aaveProReserveId)
    if (reserveId === null) continue

    const spokeName = r.spokeName
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
