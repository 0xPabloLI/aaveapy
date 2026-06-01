import type { ReserveWithSpread } from '@/types/aave'
import type { WalletPosition, PositionMeta, WalletPositionSource } from './userPositionMapper'
import type { ReserveChainTokenMap } from '@/lib/reserveKey'
import { resolvePositionMeta } from './userPositionMapper'
import { buildReserveLookupByChainAndToken } from '@/lib/reserveKey'

const WAD = 10n ** 18n

function decimalToWad(value: string, decimals: number): bigint {
  if (!value || value.trim() === '') return 0n
  const negative = value.startsWith('-')
  const abs = negative ? value.slice(1) : value
  const [intPart, fracPart = ''] = abs.split('.')
  if (!intPart && !fracPart) return 0n
  const paddedFrac = (fracPart + '0'.repeat(18)).slice(0, 18)
  const wadValue = BigInt(intPart || '0') * WAD + BigInt(paddedFrac || '0')
  return negative ? -wadValue : wadValue
}

interface SdkSupplyPosition {
  reserve: {
    id: string
    symbol: string
    decimals: number
    underlyingAsset: { address: `0x${string}`; chain: { id: string } }
  }
  balance: { amount: { value: string; onChainValue: bigint; decimals: number } }
  isCollateral: boolean
}

interface SdkBorrowPosition {
  reserve: {
    id: string
    symbol: string
    decimals: number
    underlyingAsset: { address: `0x${string}`; chain: { id: string } }
  }
  debt: { amount: { value: string; onChainValue: bigint; decimals: number } }
}

function extractChainId(chainIdStr: string): number {
  const id = Number(chainIdStr)
  return Number.isInteger(id) ? id : -1
}

function toSafeUsd(value: string, tokenPrice: number): number {
  const raw = parseFloat(value) * tokenPrice
  return Number.isFinite(raw) ? raw : 0
}

function sdkSupplyToWalletPosition(
  supply: SdkSupplyPosition,
  lookupMap: ReserveChainTokenMap,
  source: WalletPositionSource,
): WalletPosition {
  const asset = supply.reserve.underlyingAsset.address
  const chainId = extractChainId(supply.reserve.underlyingAsset.chain.id)
  const meta: PositionMeta = resolvePositionMeta(chainId, asset, lookupMap)

  const onChainValue = supply.balance.amount.onChainValue
  const amountWad = onChainValue !== undefined && onChainValue !== null
    ? onChainValue
    : decimalToWad(supply.balance.amount.value, supply.balance.amount.decimals)

  const isOrphan = meta.reserveId === undefined

  return {
    reserveId: meta.reserveId ?? supply.reserve.id ?? '',
    chainId,
    asset,
    tokenSymbol: meta.tokenSymbol || supply.reserve.symbol,
    side: 'supply',
    amountWad,
    amountUsd: toSafeUsd(supply.balance.amount.value, meta.tokenPrice),
    isCollateral: supply.isCollateral,
    source,
    isOrphan,
  }
}

function sdkBorrowToWalletPosition(
  borrow: SdkBorrowPosition,
  lookupMap: ReserveChainTokenMap,
  source: WalletPositionSource,
): WalletPosition {
  const asset = borrow.reserve.underlyingAsset.address
  const chainId = extractChainId(borrow.reserve.underlyingAsset.chain.id)
  const meta: PositionMeta = resolvePositionMeta(chainId, asset, lookupMap)

  const onChainValue = borrow.debt.amount.onChainValue
  const amountWad = onChainValue !== undefined && onChainValue !== null
    ? onChainValue
    : decimalToWad(borrow.debt.amount.value, borrow.debt.amount.decimals)

  const isOrphan = meta.reserveId === undefined

  return {
    reserveId: meta.reserveId ?? borrow.reserve.id ?? '',
    chainId,
    asset,
    tokenSymbol: meta.tokenSymbol || borrow.reserve.symbol,
    side: 'borrow',
    amountWad,
    amountUsd: toSafeUsd(borrow.debt.amount.value, meta.tokenPrice),
    isCollateral: false,
    source,
    isOrphan,
  }
}

export function convertSdkSuppliesToWalletPositions(
  supplies: SdkSupplyPosition[],
  lookupMap: ReserveChainTokenMap,
  source: WalletPositionSource = 'sdk',
): WalletPosition[] {
  return supplies.map(s => sdkSupplyToWalletPosition(s, lookupMap, source))
}

export function convertSdkBorrowsToWalletPositions(
  borrows: SdkBorrowPosition[],
  lookupMap: ReserveChainTokenMap,
  source: WalletPositionSource = 'sdk',
): WalletPosition[] {
  return borrows.map(b => sdkBorrowToWalletPosition(b, lookupMap, source))
}

export { buildReserveLookupByChainAndToken }
export type { SdkSupplyPosition, SdkBorrowPosition }
