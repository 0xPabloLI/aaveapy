import type { WalletPosition, WalletPositionSource } from './userData/userPositionMapper'
import type { ReserveWithSpread } from '@/types/aave'
import type { PortfolioReserveEntry, PositionSource } from '@/types/portfolio'
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
        chainId: reserve?.chainId ?? -1,
        tokenSymbol: wp.tokenSymbol,
        supply: { ...EMPTY_SIDE },
        borrow: { ...EMPTY_SIDE },
        hidden: false,
        isOrphan: wp.isOrphan,
        restrictedStatus: null,
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
