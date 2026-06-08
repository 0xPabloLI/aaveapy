import { describe, expect, it } from 'vitest'

import {
  MAX_PORTFOLIO_AMOUNT_SIG_DIGITS,
  countSignificantDigits,
  formatPortfolioAmount,
} from './portfolioAmountFormat'
import { formatConvertedAmount } from './portfolioCalculator'
import { convertWalletPositionsToEntries } from './walletPositionToPortfolio'
import type { WalletPosition } from './userData/userPositionMapper'
import type { ReserveWithSpread } from '@/types/aave'

const NOISY: number[] = [
  0,
  1,
  9.999999999,
  12.3456789012,
  Number('1737.4839284729384'),
  0.000123456789,
  98765432.123456,
  Number('-412.91827361827361'),
]

describe('formatPortfolioAmount', () => {
  it('returns "" for non-finite input', () => {
    expect(formatPortfolioAmount(Number.NaN)).toBe('')
    expect(formatPortfolioAmount(Number.POSITIVE_INFINITY)).toBe('')
  })

  it('returns "0" for zero (no decimals)', () => {
    expect(formatPortfolioAmount(0)).toBe('0')
  })

  it('clips every noisy float to ≤ MAX_PORTFOLIO_AMOUNT_SIG_DIGITS sig digits', () => {
    for (const v of NOISY) {
      const out = formatPortfolioAmount(v)
      expect(
        countSignificantDigits(out),
        `value=${v} → "${out}"`,
      ).toBeLessThanOrEqual(MAX_PORTFOLIO_AMOUNT_SIG_DIGITS)
    }
  })

  it('strips trailing zeros / decimal point', () => {
    expect(formatPortfolioAmount(10)).toBe('10')
    expect(formatPortfolioAmount(10.5)).toBe('10.5')
    expect(formatPortfolioAmount(100.0)).toBe('100')
  })

  it('is idempotent — formatting an already-formatted value yields the same string', () => {
    for (const v of NOISY) {
      const first = formatPortfolioAmount(v)
      const reparsed = Number(first)
      if (Number.isFinite(reparsed)) {
        expect(formatPortfolioAmount(reparsed)).toBe(first)
      }
    }
  })

  it('legacy alias `formatConvertedAmount` resolves to the same implementation', () => {
    expect(formatConvertedAmount).toBe(formatPortfolioAmount)
  })
})

const reserves = [
  { reserveId: 'r-weth', marketName: 'M', chainName: 'C', tokenPrice: 3500 } as unknown as ReserveWithSpread,
  { reserveId: 'r-gho', marketName: 'M', chainName: 'C', tokenPrice: 1 } as unknown as ReserveWithSpread,
]

const wallet: WalletPosition[] = [
  { reserveId: 'r-weth', side: 'supply', tokenSymbol: 'WETH', amountUsd: Number('1737.4839284729384'), isOrphan: false, source: 'sdk' } as unknown as WalletPosition,
  { reserveId: 'r-gho', side: 'borrow', tokenSymbol: 'GHO', amountUsd: Number('412.91827361827361'), isOrphan: false, source: 'sdk' } as unknown as WalletPosition,
]

function expectAllClipped(values: string[], label: string) {
  for (const v of values) {
    expect(
      countSignificantDigits(v),
      `${label}: "${v}" within ${MAX_PORTFOLIO_AMOUNT_SIG_DIGITS} sig digits`,
    ).toBeLessThanOrEqual(MAX_PORTFOLIO_AMOUNT_SIG_DIGITS)
  }
}

describe('Portfolio amount entry paths use formatPortfolioAmount', () => {
  it('wallet → portfolio conversion clips amounts', () => {
    const out = convertWalletPositionsToEntries(wallet, reserves)
    expectAllClipped(out.flatMap(e => [e.supply.amount, e.borrow.amount].filter(a => a !== '')), 'walletPositionToEntries')
  })
})
