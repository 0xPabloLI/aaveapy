import type { WalletPosition, WalletPositionSource } from './userData/userPositionMapper'
import type { ReserveWithSpread } from '@/types/aave'
import type { PortfolioPosition, PositionSource } from '@/types/portfolio'
import { formatConvertedAmount } from './portfolioCalculator'

function walletSourceToPositionSource(src: WalletPositionSource): PositionSource {
  return src
}

export function convertWalletPositionsToPortfolio(
  walletPositions: WalletPosition[],
  reserves: ReserveWithSpread[],
): PortfolioPosition[] {
  const reserveLookup = new Map<string, ReserveWithSpread>()
  for (const r of reserves) {
    reserveLookup.set(r.reserveId, r)
  }

  const seen = new Set<string>()
  const result: PortfolioPosition[] = []

  for (const wp of walletPositions) {
    const positionId = `${wp.reserveId}:${wp.side}`
    if (seen.has(positionId)) continue
    seen.add(positionId)

    const reserve = reserveLookup.get(wp.reserveId)

    result.push({
      positionId,
      reserveId: wp.reserveId,
      marketName: reserve?.marketName ?? '',
      chainName: reserve?.chainName ?? '',
      tokenSymbol: wp.tokenSymbol,
      side: wp.side,
      amount: formatConvertedAmount(wp.amountUsd),
      inputMode: 'usd',
      walletValue: wp.amountUsd,
      hidden: false,
      isOrphan: wp.isOrphan,
      source: walletSourceToPositionSource(wp.source),
    })
  }

  return result
}
