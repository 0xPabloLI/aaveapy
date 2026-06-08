import { describe, expect, it } from 'vitest'

import {
  MAX_PORTFOLIO_AMOUNT_SIG_DIGITS,
  countSignificantDigits,
  formatPortfolioAmount,
} from './portfolioAmountFormat'
import { formatConvertedAmount } from './portfolioCalculator'
import { convertWalletPositionsToPortfolio } from './walletPositionToPortfolio'
import { mergePositions } from './portfolioMerger'
import type { WalletPosition } from './userData/userPositionMapper'
import type { ReserveWithSpread } from '@/types/aave'

/**
 * Single source of truth: every portfolio entry path must format amount
 * strings through `formatPortfolioAmount`. These tests cover the formatter
 * itself and every caller (import, merger, back-compat alias) so a new
 * entry point can't accidentally leak >8-sig-digit floats.
 */

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

// ---- Caller coverage: every entry path → ≤ 8 sig digits ---------------- //

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
    const out = convertWalletPositionsToPortfolio(wallet, reserves)
    expectAllClipped(out.map((p) => p.amount), 'walletPositionToPortfolio')
  })

  it('merger refresh does not regress precision (no manual edits)', () => {
    const first = convertWalletPositionsToPortfolio(wallet, reserves)
    const merged = mergePositions({ current: first, incoming: first })
    expectAllClipped(merged.map((p) => p.amount), 'mergePositions')
    // And the merger must not mutate a fresh wallet-tracking row.
    for (const m of merged) {
      const ref = first.find((p) => p.positionId === m.positionId)!
      expect(m.amount).toBe(ref.amount)
    }
  })

  it('manual edits survive the merger (and remain clipped where unedited)', () => {
    const first = convertWalletPositionsToPortfolio(wallet, reserves)
    const edited = first.map((p) =>
      p.reserveId === 'r-weth' ? { ...p, amount: '1234.5678' } : p,
    )
    const merged = mergePositions({ current: edited, incoming: first })
    const weth = merged.find((p) => p.reserveId === 'r-weth')!
    expect(weth.amount).toBe('1234.5678')
    const gho = merged.find((p) => p.reserveId === 'r-gho')!
    expect(countSignificantDigits(gho.amount)).toBeLessThanOrEqual(MAX_PORTFOLIO_AMOUNT_SIG_DIGITS)
  })
})
