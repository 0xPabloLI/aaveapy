import { describe, expect, it } from 'vitest'

import { mergePositions } from './portfolioMerger'
import { convertWalletPositionsToPortfolio } from './walletPositionToPortfolio'
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
  // Intentionally noisy floats that, prior to the fix, came out as raw
  // 15-digit strings like "1737.4839284729384".
  { reserveId: 'r-weth', side: 'supply', tokenSymbol: 'WETH', amountUsd: Number('1737.4839284729384'), isOrphan: false, source: 'sdk' } as unknown as WalletPosition,
  { reserveId: 'r-gho', side: 'borrow', tokenSymbol: 'GHO', amountUsd: Number('412.91827361827361'), isOrphan: false, source: 'sdk' } as unknown as WalletPosition,
]

describe('Wallet sync precision', () => {
  it('initial wallet → portfolio conversion clips to ≤8 significant digits', () => {
    const converted = convertWalletPositionsToPortfolio(wallet, reserves)
    for (const p of converted) {
      expect(p.amount).toBe(formatConvertedAmount(p.walletValue!))
      expect(significantDigits(p.amount)).toBeLessThanOrEqual(MAX_SIG_DIGITS)
    }
  })

  it('re-syncing wallet positions keeps amount precision identical to first render', () => {
    const first = convertWalletPositionsToPortfolio(wallet, reserves)
    // Simulate a second wallet sync round-trip (no manual edits in between).
    const second = convertWalletPositionsToPortfolio(wallet, reserves)
    const merged = mergePositions({ current: first, incoming: second })
    for (const p of merged) {
      expect(significantDigits(p.amount)).toBeLessThanOrEqual(MAX_SIG_DIGITS)
      const ref = first.find((f) => f.positionId === p.positionId)!
      expect(p.amount).toBe(ref.amount)
    }
  })

  it('preserves manually-edited amounts across wallet re-sync (no precision drift, no clobber)', () => {
    const first = convertWalletPositionsToPortfolio(wallet, reserves)
    // Manual edit on the WETH row.
    const edited = first.map((p) =>
      p.reserveId === 'r-weth' && p.side === 'supply' ? { ...p, amount: '1000' } : p,
    )
    const merged = mergePositions({ current: edited, incoming: first })
    const weth = merged.find((p) => p.reserveId === 'r-weth' && p.side === 'supply')!
    expect(weth.amount).toBe('1000') // manual edit preserved
    const gho = merged.find((p) => p.reserveId === 'r-gho' && p.side === 'borrow')!
    expect(significantDigits(gho.amount)).toBeLessThanOrEqual(MAX_SIG_DIGITS)
  })
})
