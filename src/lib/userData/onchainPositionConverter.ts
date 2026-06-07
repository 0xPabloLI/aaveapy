import type { V3UserPosition } from './aaveV3UserClient'
import type { V4UserPosition } from './aaveV4UserClient'
import type { ReserveWithSpread } from '@/types/aave'
import type { WalletPosition, WalletPositionSource } from './userPositionMapper'
import type { ReserveChainTokenMap } from '@/lib/reserveKey'
import { buildReserveLookupByChainAndToken } from '@/lib/reserveKey'
import {
  mapV3PositionToWalletPosition,
  mapV4PositionToWalletPosition,
  resolvePositionMeta,
  buildReserveMapFromReserves,
} from './userPositionMapper'

export function convertV3PositionsToWalletPositions(
  positions: V3UserPosition[],
  lookupMap: ReserveChainTokenMap,
  source: WalletPositionSource,
): WalletPosition[] {
  const result: WalletPosition[] = []

  for (const pos of positions) {
    const meta = resolvePositionMeta(pos.chainId, pos.asset, lookupMap)

    if (pos.supplyWad > 0n) {
      result.push(mapV3PositionToWalletPosition(pos, 'supply', meta, source))
    }

    const totalBorrow = pos.stableBorrowWad + pos.variableBorrowWad
    if (totalBorrow > 0n) {
      result.push(mapV3PositionToWalletPosition(pos, 'borrow', meta, source))
    }
  }

  return result
}

export function convertV4PositionsToWalletPositions(
  positions: V4UserPosition[],
  lookupMap: ReserveChainTokenMap,
  source: WalletPositionSource,
): WalletPosition[] {
  const result: WalletPosition[] = []

  for (const pos of positions) {
    const meta = resolvePositionMeta(pos.chainId, pos.asset, lookupMap)

    if (pos.suppliedAssets > 0n) {
      result.push(mapV4PositionToWalletPosition(pos, 'supply', meta, source))
    }

    const totalDebt = pos.stableDebt + pos.variableDebt
    if (totalDebt > 0n) {
      result.push(mapV4PositionToWalletPosition(pos, 'borrow', meta, source))
    }
  }

  return result
}

export { buildReserveMapFromReserves, buildReserveLookupByChainAndToken }
