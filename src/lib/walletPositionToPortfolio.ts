import type { WalletPosition, WalletPositionSource } from './userData/userPositionMapper'
import type { ReserveWithSpread } from '@/types/aave'
import type { PortfolioPosition, PortfolioReserveEntry, PositionSource } from '@/types/portfolio'
import { formatConvertedAmount } from './portfolioCalculator'

function walletSourceToPositionSource(src: WalletPositionSource): PositionSource {
  return src
}

const EMPTY_SIDE = { amount: '', inputMode: 'usd' as const, walletValue: null }

export function convertWalletPositionsToEntries(
  walletPositions: WalletPosition[],
  reserves: ReserveWithSpread[],
): PortfolioReserveEntry[] {
  const reserveLookup = new Map<string, ReserveWithSpread>()
  for (const r of reserves) {
    reserveLookup.set(r.reserveId, r)
  }

  const entryMap = new Map<string, PortfolioReserveEntry>()

  for (const wp of walletPositions) {
    const reserve = reserveLookup.get(wp.reserveId)
    let entry = entryMap.get(wp.reserveId)
    if (!entry) {
      entry = {
        reserveId: wp.reserveId,
        marketName: reserve?.marketName ?? '',
        chainName: reserve?.chainName ?? '',
        tokenSymbol: wp.tokenSymbol,
        supply: { ...EMPTY_SIDE },
        borrow: { ...EMPTY_SIDE },
        hidden: false,
        isOrphan: wp.isOrphan,
      }
    }
    const source = walletSourceToPositionSource(wp.source)
    entry = {
      ...entry,
      [wp.side]: {
        amount: formatConvertedAmount(wp.amountUsd),
        inputMode: 'usd' as const,
        walletValue: wp.amountUsd,
        source,
      },
    }
    entryMap.set(wp.reserveId, entry)
  }

  return Array.from(entryMap.values())
}

/** @deprecated Use convertWalletPositionsToEntries instead. */
export function convertWalletPositionsToPortfolio(
  walletPositions: WalletPosition[],
  reserves: ReserveWithSpread[],
): PortfolioPosition[] {
  const entries = convertWalletPositionsToEntries(walletPositions, reserves)
  return entries.flatMap((e) => {
    const makePos = (side: 'supply' | 'borrow', s: PortfolioReserveEntry['supply']): PortfolioPosition => ({
      positionId: `${e.reserveId}::${side}`,
      reserveId: e.reserveId,
      marketName: e.marketName,
      chainName: e.chainName,
      tokenSymbol: e.tokenSymbol,
      side,
      amount: s.amount,
      inputMode: s.inputMode,
      walletValue: s.walletValue,
      hidden: e.hidden,
      isOrphan: e.isOrphan,
      source: s.source,
    })
    const sides: PortfolioPosition[] = []
    if (e.supply.walletValue !== null || e.supply.amount !== '') sides.push(makePos('supply', e.supply))
    if (e.borrow.walletValue !== null || e.borrow.amount !== '') sides.push(makePos('borrow', e.borrow))
    if (sides.length === 0) {
      sides.push(makePos('supply', e.supply))
      sides.push(makePos('borrow', e.borrow))
    }
    return sides
  })
}
