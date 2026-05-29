import type { WalletPosition } from './userData/userPositionMapper'
import type { ReserveWithSpread } from '@/types/aave'
import type { PortfolioPosition } from '@/types/portfolio'

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
      amount: String(wp.amountUsd),
      inputMode: 'usd',
      walletValue: wp.amountUsd,
      hidden: false,
      isOrphan: wp.isOrphan,
    })
  }

  return result
}
