import type { MarketsResponse } from '@/types/aave'

export interface ParsedReserveId {
  chainId: number
  poolOrSpokeAddress: string
  tokenAddress: string
  hubAddress?: string
}

export function parseReserveId(reserveId: string): ParsedReserveId | null {
  if (!reserveId) return null
  const segments = reserveId.split(':')
  if (segments.length < 3 || segments.length > 4) return null

  const chainId = Number(segments[0])
  if (!Number.isInteger(chainId) || chainId <= 0) return null

  const poolOrSpokeAddress = segments[1]
  const tokenAddress = segments[2]
  const hubAddress = segments.length === 4 ? segments[3] : undefined

  return { chainId, poolOrSpokeAddress, tokenAddress, hubAddress }
}

export function enrichReservesFromId(data: MarketsResponse): void {
  for (const reserve of data.reserves) {
    const parsed = parseReserveId(reserve.reserveId)
    if (!parsed) continue
    if (parsed.hubAddress && !reserve.hubAddress) {
      reserve.hubAddress = parsed.hubAddress
      reserve.spokeAddress = parsed.poolOrSpokeAddress
    }
  }
}
