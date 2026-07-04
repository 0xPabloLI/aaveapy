import { describe, it, expect } from 'vitest'
import { convertWalletPositionsToEntries } from './walletPositionToPortfolio'
import type { WalletPosition } from './userData/userPositionMapper'
import type { ReserveWithSpread } from '@/types/aave'

const makeReserve = (overrides: Partial<ReserveWithSpread> & { reserveId: string; chainId: number }): ReserveWithSpread => ({
  marketName: 'AaveV3Ethereum',
  chainName: 'Ethereum',
  tokenName: 'USDC',
  tokenSymbol: 'USDC',
  tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  supplyApy: 2,
  borrowApy: 3,
  tokenPrice: 1,
  decimals: 6,
  ...overrides,
})

const makeWalletPos = (overrides: Partial<WalletPosition> & { reserveId: string; chainId: number; side: 'supply' | 'borrow' }): WalletPosition => ({
  asset: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  tokenSymbol: 'USDC',
  amountWad: 1000000000000000000n,
  amountUsd: 1000,
  isCollateral: true,
  source: 'onchain-v3',
  isOrphan: false,
  ...overrides,
})

const reserves: ReserveWithSpread[] = [
  makeReserve({ reserveId: 'eth-usdc-v3', chainId: 1, marketName: 'AaveV3Ethereum', chainName: 'Ethereum', tokenSymbol: 'USDC' }),
  makeReserve({ reserveId: 'arb-usdc-v3', chainId: 42161, marketName: 'AaveV3Arbitrum', chainName: 'Arbitrum', tokenSymbol: 'USDC' }),
  makeReserve({ reserveId: 'eth-usdc-v4', chainId: 1, marketName: 'AaveV4Ethereum', chainName: 'Ethereum', tokenSymbol: 'USDC', spokeAddress: '0xV4Spoke' }),
]

describe('convertWalletPositionsToEntries', () => {
  it('maps a single supply position to one entry', () => {
    const wallet: WalletPosition[] = [
      makeWalletPos({ reserveId: 'eth-usdc-v3', chainId: 1, side: 'supply', amountUsd: 5000 }),
    ]
    const result = convertWalletPositionsToEntries(wallet, reserves)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      reserveId: 'eth-usdc-v3',
      marketName: 'AaveV3Ethereum',
      chainName: 'Ethereum',
      chainId: 1,
      tokenSymbol: 'USDC',
      supply: { amount: '5000', inputMode: 'usd', walletValue: 5000, source: 'onchain-v3' },
      borrow: { amount: '', inputMode: 'usd', walletValue: null },
      hidden: false,
      isOrphan: false,
      restrictedStatus: null,
    })
  })

  it('maps a borrow position', () => {
    const wallet: WalletPosition[] = [
      makeWalletPos({ reserveId: 'arb-usdc-v3', chainId: 42161, side: 'borrow', amountUsd: 200 }),
    ]
    const result = convertWalletPositionsToEntries(wallet, reserves)
    expect(result).toHaveLength(1)
    expect(result[0].borrow.amount).toBe('200')
    expect(result[0].borrow.walletValue).toBe(200)
    expect(result[0].supply.walletValue).toBeNull()
  })

  it('maps multiple positions across chains', () => {
    const wallet: WalletPosition[] = [
      makeWalletPos({ reserveId: 'eth-usdc-v3', chainId: 1, side: 'supply', amountUsd: 1000 }),
      makeWalletPos({ reserveId: 'arb-usdc-v3', chainId: 42161, side: 'borrow', amountUsd: 500 }),
      makeWalletPos({ reserveId: 'eth-usdc-v4', chainId: 1, side: 'supply', amountUsd: 3000 }),
    ]
    const result = convertWalletPositionsToEntries(wallet, reserves)
    expect(result).toHaveLength(3)
    expect(result.map(e => e.reserveId)).toEqual(['eth-usdc-v3', 'arb-usdc-v3', 'eth-usdc-v4'])
    expect(result[2].marketName).toBe('AaveV4Ethereum')
  })

  it('merges supply+borrow for same reserveId into one entry', () => {
    const wallet: WalletPosition[] = [
      makeWalletPos({ reserveId: 'eth-usdc-v3', chainId: 1, side: 'supply', amountUsd: 1000 }),
      makeWalletPos({ reserveId: 'eth-usdc-v3', chainId: 1, side: 'borrow', amountUsd: 500 }),
    ]
    const result = convertWalletPositionsToEntries(wallet, reserves)
    expect(result).toHaveLength(1)
    expect(result[0].supply.walletValue).toBe(1000)
    expect(result[0].borrow.walletValue).toBe(500)
  })

  it('handles orphan position (reserveId not in reserves)', () => {
    const wallet: WalletPosition[] = [
      makeWalletPos({ reserveId: 'unknown-reserve', chainId: 1, side: 'supply', amountUsd: 100, isOrphan: true }),
    ]
    const result = convertWalletPositionsToEntries(wallet, reserves)
    expect(result).toHaveLength(1)
    expect(result[0].isOrphan).toBe(true)
    expect(result[0].marketName).toBe('')
    expect(result[0].chainName).toBe('')
  })

  it('handles position with amountUsd = 0', () => {
    const wallet: WalletPosition[] = [
      makeWalletPos({ reserveId: 'eth-usdc-v3', chainId: 1, side: 'supply', amountUsd: 0, amountWad: 0n }),
    ]
    const result = convertWalletPositionsToEntries(wallet, reserves)
    expect(result[0].supply.amount).toBe('0')
    expect(result[0].supply.walletValue).toBe(0)
  })

  it('returns empty array for empty wallet positions', () => {
    const result = convertWalletPositionsToEntries([], reserves)
    expect(result).toEqual([])
  })

  it('formats fractional amountUsd correctly', () => {
    const wallet: WalletPosition[] = [
      makeWalletPos({ reserveId: 'eth-usdc-v3', chainId: 1, side: 'supply', amountUsd: 1234.5678 }),
    ]
    const result = convertWalletPositionsToEntries(wallet, reserves)
    expect(result[0].supply.amount).toBe('1234.5678')
    expect(result[0].supply.walletValue).toBeCloseTo(1234.5678, 4)
  })

  it('passes source through from WalletPosition', () => {
    const wallet: WalletPosition[] = [
      makeWalletPos({ reserveId: 'eth-usdc-v3', chainId: 1, side: 'supply', source: 'sdk' }),
    ]
    const result = convertWalletPositionsToEntries(wallet, reserves)
    expect(result[0].supply.source).toBe('sdk')
  })

  it('preserves onchain-v4 source', () => {
    const wallet: WalletPosition[] = [
      makeWalletPos({ reserveId: 'eth-usdc-v4', chainId: 1, side: 'supply', source: 'onchain-v4' }),
    ]
    const result = convertWalletPositionsToEntries(wallet, reserves)
    expect(result[0].supply.source).toBe('onchain-v4')
  })
})
