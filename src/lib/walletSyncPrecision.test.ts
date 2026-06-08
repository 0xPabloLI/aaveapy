import { describe, expect, it } from 'vitest'

import { convertWalletPositionsToEntries } from './walletPositionToPortfolio'
import { formatConvertedAmount } from './portfolioCalculator'
import type { WalletPosition } from './userData/userPositionMapper'
import type { ReserveWithSpread } from '@/types/aave'

const MAX_SIG_DIGITS = 8

function significantDigits(raw: string): number {
  const cleaned = raw.replace(/,/g, '').replace(/^[-+]/, '')
  if (!/^\d*(\.\d*)?$/.test(cleaned) || cleaned === '' || cleaned === '.') return 0
  const [intPart = '', fracPart = ''] = cleaned.split('.')
  const digits = (intPart + fracPart).replace(/^0+/, '')
  const trimmed = fracPart ? digits.replace(/0+$/, '') : digits
  return trimmed.length
}

const reserves = [
  { reserveId: 'r-weth', marketName: 'M', chainName: 'C' } as unknown as ReserveWithSpread,
  { reserveId: 'r-gho', marketName: 'M', chainName: 'C' } as unknown as ReserveWithSpread,
]

const wallet: WalletPosition[] = [
  { reserveId: 'r-weth', side: 'supply', tokenSymbol: 'WETH', amountUsd: Number('1737.4839284729384'), isOrphan: false, source: 'sdk' } as unknown as WalletPosition,
  { reserveId: 'r-gho', side: 'borrow', tokenSymbol: 'GHO', amountUsd: Number('412.91827361827361'), isOrphan: false, source: 'sdk' } as unknown as WalletPosition,
]

describe('Wallet sync precision', () => {
  it('initial wallet → portfolio conversion clips to ≤8 significant digits', () => {
    const converted = convertWalletPositionsToEntries(wallet, reserves)
    const amounts = converted.flatMap(e => [e.supply.amount, e.borrow.amount].filter(a => a !== ''))
    for (const amt of amounts) {
      expect(significantDigits(amt)).toBeLessThanOrEqual(MAX_SIG_DIGITS)
    }
  })

  it('re-syncing wallet positions keeps amount precision identical to first render', () => {
    const first = convertWalletPositionsToEntries(wallet, reserves)
    const second = convertWalletPositionsToEntries(wallet, reserves)
    for (const e2 of second) {
      const ref = first.find(e => e.reserveId === e2.reserveId)!
      expect(e2.supply.amount).toBe(ref.supply.amount)
      expect(e2.borrow.amount).toBe(ref.borrow.amount)
    }
  })
})
