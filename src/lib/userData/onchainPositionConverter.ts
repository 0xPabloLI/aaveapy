import type { V3UserPosition } from './aaveV3UserClient'
import type { V4UserPosition } from './aaveV4UserClient'
import type { ReserveWithSpread } from '@/types/aave'
import type { WalletPosition } from './userPositionMapper'
import {
  mapV3PositionToWalletPosition,
  mapV4PositionToWalletPosition,
  resolvePositionMeta,
} from './userPositionMapper'

export function convertV3PositionsToWalletPositions(
  positions: V3UserPosition[],
  reserves: ReserveWithSpread[],
): WalletPosition[] {
  const result: WalletPosition[] = []

  for (const pos of positions) {
    const meta = resolvePositionMeta(pos.asset, pos.chainId, reserves)

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
  reserves: ReserveWithSpread[],
): WalletPosition[] {
  const result: WalletPosition[] = []

  for (const pos of positions) {
    const meta = resolvePositionMeta(pos.asset, pos.chainId, reserves)

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
