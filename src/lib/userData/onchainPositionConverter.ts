import type { V3UserPosition } from './aaveV3UserClient'
import type { V4UserPosition } from './aaveV4UserClient'
import type { ReserveWithSpread } from '@/types/aave'
import type { WalletPosition } from './userPositionMapper'
import type { ReserveChainTokenMap } from '@/lib/reserveKey'
import { buildReserveLookupByChainAndToken } from '@/lib/reserveKey'
import {
  mapV3PositionToWalletPosition,
  mapV4PositionToWalletPosition,
  resolvePositionMeta,
  buildReserveMapFromReserves,
} from './userPositionMapper'

function buildSpokeNameToMarketNameMap(reserves: ReserveWithSpread[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const r of reserves) {
    if (r.spokeAddress && r.marketName) {
      const spokeKey = `${r.chainId}:${r.spokeAddress.toLowerCase()}`
      if (!map.has(spokeKey)) {
        map.set(spokeKey, r.marketName)
      }
    }
  }
  return map
}

export function convertV3PositionsToWalletPositions(
  positions: V3UserPosition[],
  lookupMap: ReserveChainTokenMap,
): WalletPosition[] {
  const result: WalletPosition[] = []

  for (const pos of positions) {
    const meta = resolvePositionMeta(pos.chainId, pos.asset, lookupMap)

    if (pos.supplyWad > 0n) {
      result.push(mapV3PositionToWalletPosition(pos, 'supply', meta))
    }

    const totalBorrow = pos.stableBorrowWad + pos.variableBorrowWad
    if (totalBorrow > 0n) {
      result.push(mapV3PositionToWalletPosition(pos, 'borrow', meta))
    }
  }

  return result
}

export function convertV4PositionsToWalletPositions(
  positions: V4UserPosition[],
  lookupMap: ReserveChainTokenMap,
): WalletPosition[] {
  const result: WalletPosition[] = []

  for (const pos of positions) {
    const meta = resolvePositionMeta(pos.chainId, pos.asset, lookupMap)

    if (pos.suppliedAssets > 0n) {
      result.push(mapV4PositionToWalletPosition(pos, 'supply', meta))
    }

    const totalDebt = pos.stableDebt + pos.variableDebt
    if (totalDebt > 0n) {
      result.push(mapV4PositionToWalletPosition(pos, 'borrow', meta))
    }
  }

  return result
}

export { buildReserveMapFromReserves, buildSpokeNameToMarketNameMap, buildReserveLookupByChainAndToken }
