import type { V3UserPosition } from './aaveV3UserClient'
import type { V4UserPosition } from './aaveV4UserClient'
import type { ReserveWithSpread } from '@/types/aave'
import type { ReserveMap, ReserveChainTokenMap } from '@/lib/reserveKey'
import { buildReserveMap, toChainTokenKey } from '@/lib/reserveKey'

export type WalletPositionSource = 'onchain-v3' | 'onchain-v4' | 'sdk'

export interface WalletPosition {
  reserveId: string
  chainId: number
  asset: `0x${string}`
  tokenSymbol: string
  side: 'supply' | 'borrow'
  amountWad: bigint
  amountUsd: number
  isCollateral: boolean
  source: WalletPositionSource
  isOrphan: boolean
}

export interface PositionMeta {
  reserveId: string | undefined
  tokenSymbol: string
  tokenPrice: number
  decimals: number
}

const WAD = 10n ** 18n

function wadToHuman(wad: bigint): number {
  return Number(wad / WAD) + Number(wad % WAD) / Number(WAD)
}

export function mapV3PositionToWalletPosition(
  pos: V3UserPosition,
  side: 'supply' | 'borrow',
  meta: PositionMeta,
): WalletPosition {
  const amountWad = side === 'supply'
    ? pos.supplyWad
    : pos.stableBorrowWad > 0n
      ? pos.stableBorrowWad + pos.variableBorrowWad
      : pos.variableBorrowWad

  const isOrphan = meta.reserveId === undefined

  return {
    reserveId: meta.reserveId ?? '',
    chainId: pos.chainId,
    asset: pos.asset,
    tokenSymbol: meta.tokenSymbol,
    side,
    amountWad,
    amountUsd: wadToHuman(amountWad) * meta.tokenPrice,
    isCollateral: pos.isCollateral,
    source: 'onchain-v3',
    isOrphan,
  }
}

export function mapV4PositionToWalletPosition(
  pos: V4UserPosition,
  side: 'supply' | 'borrow',
  meta: PositionMeta,
): WalletPosition {
  const amountWad = side === 'supply'
    ? pos.suppliedAssets
    : pos.stableDebt + pos.variableDebt

  const isOrphan = meta.reserveId === undefined

  return {
    reserveId: meta.reserveId ?? '',
    chainId: pos.chainId,
    asset: pos.asset,
    tokenSymbol: meta.tokenSymbol,
    side,
    amountWad,
    amountUsd: wadToHuman(amountWad) * meta.tokenPrice,
    isCollateral: pos.isCollateral,
    source: 'onchain-v4',
    isOrphan,
  }
}

const ORPHAN_META: PositionMeta = {
  reserveId: undefined,
  tokenSymbol: '',
  tokenPrice: 0,
  decimals: 0,
}

/**
 * Resolve position metadata by (chainId, tokenAddress) using O(1) Map lookup.
 *
 * This is the correct lookup strategy because both chainId and tokenAddress
 * are available in all data sources (SDK, onchain, backend) and are
 * semantically stable — unlike reserveId whose format varies by source.
 */
export function resolvePositionMeta(
  chainId: number,
  tokenAddress: string,
  lookupMap: ReserveChainTokenMap,
): PositionMeta {
  const key = toChainTokenKey(chainId, tokenAddress)
  const reserve = lookupMap.get(key)
  if (!reserve) return ORPHAN_META
  return {
    reserveId: reserve.reserveId,
    tokenSymbol: reserve.tokenSymbol,
    tokenPrice: reserve.tokenPrice ?? 0,
    decimals: reserve.decimals ?? 18,
  }
}

/** Convenience: build a ReserveMap from a flat array. */
export const buildReserveMapFromReserves = buildReserveMap
