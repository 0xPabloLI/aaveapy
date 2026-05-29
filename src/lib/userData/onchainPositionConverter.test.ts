import { describe, it, expect } from 'vitest'
import {
  convertV3PositionsToWalletPositions,
  convertV4PositionsToWalletPositions,
} from './onchainPositionConverter'
import type { V3UserPosition } from './aaveV3UserClient'
import type { V4UserPosition } from './aaveV4UserClient'
import type { ReserveWithSpread } from '@/types/aave'

const WAD = 10n ** 18n

const USDC_ADDR = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as `0x${string}`
const WETH_ADDR = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' as `0x${string}`
const DAI_ADDR = '0x6B175474E89094C44Da98b954EedeAC495271d0F' as `0x${string}`

const reserves: ReserveWithSpread[] = [
  {
    marketName: 'Aave V3 Ethereum',
    chainName: 'Ethereum',
    chainId: 1,
    tokenName: 'USD Coin',
    tokenSymbol: 'USDC',
    tokenAddress: USDC_ADDR,
    reserveId: 'usdc-1',
    tokenPrice: 1,
    decimals: 6,
  },
  {
    marketName: 'Aave V3 Ethereum',
    chainName: 'Ethereum',
    chainId: 1,
    tokenName: 'Wrapped Ether',
    tokenSymbol: 'WETH',
    tokenAddress: WETH_ADDR,
    reserveId: 'weth-1',
    tokenPrice: 3000,
    decimals: 18,
  },
]

describe('convertV3PositionsToWalletPositions', () => {
  it('converts a supply-only position to a single supply WalletPosition', () => {
    const positions: V3UserPosition[] = [
      {
        chainId: 1,
        asset: USDC_ADDR,
        supplyWad: 5000n * WAD,
        stableBorrowWad: 0n,
        variableBorrowWad: 0n,
        isCollateral: true,
      },
    ]
    const result = convertV3PositionsToWalletPositions(positions, reserves)
    expect(result).toHaveLength(1)
    expect(result[0].side).toBe('supply')
    expect(result[0].amountWad).toBe(5000n * WAD)
    expect(result[0].amountUsd).toBe(5000)
    expect(result[0].reserveId).toBe('usdc-1')
    expect(result[0].source).toBe('onchain-v3')
    expect(result[0].isOrphan).toBe(false)
  })

  it('converts a position with both supply and borrow to two WalletPositions', () => {
    const positions: V3UserPosition[] = [
      {
        chainId: 1,
        asset: USDC_ADDR,
        supplyWad: 5000n * WAD,
        stableBorrowWad: 0n,
        variableBorrowWad: 2000n * WAD,
        isCollateral: true,
      },
    ]
    const result = convertV3PositionsToWalletPositions(positions, reserves)
    expect(result).toHaveLength(2)
    const supply = result.find(p => p.side === 'supply')!
    const borrow = result.find(p => p.side === 'borrow')!
    expect(supply.amountWad).toBe(5000n * WAD)
    expect(borrow.amountWad).toBe(2000n * WAD)
    expect(borrow.amountUsd).toBe(2000)
  })

  it('skips zero-amount sides', () => {
    const positions: V3UserPosition[] = [
      {
        chainId: 1,
        asset: USDC_ADDR,
        supplyWad: 0n,
        stableBorrowWad: 0n,
        variableBorrowWad: 3000n * WAD,
        isCollateral: false,
      },
    ]
    const result = convertV3PositionsToWalletPositions(positions, reserves)
    expect(result).toHaveLength(1)
    expect(result[0].side).toBe('borrow')
  })

  it('skips position with both supply and borrow at zero', () => {
    const positions: V3UserPosition[] = [
      {
        chainId: 1,
        asset: USDC_ADDR,
        supplyWad: 0n,
        stableBorrowWad: 0n,
        variableBorrowWad: 0n,
        isCollateral: false,
      },
    ]
    const result = convertV3PositionsToWalletPositions(positions, reserves)
    expect(result).toHaveLength(0)
  })

  it('marks orphan when asset not found in reserves', () => {
    const positions: V3UserPosition[] = [
      {
        chainId: 1,
        asset: DAI_ADDR,
        supplyWad: 1000n * WAD,
        stableBorrowWad: 0n,
        variableBorrowWad: 0n,
        isCollateral: true,
      },
    ]
    const result = convertV3PositionsToWalletPositions(positions, reserves)
    expect(result).toHaveLength(1)
    expect(result[0].isOrphan).toBe(true)
    expect(result[0].tokenSymbol).toBe('')
    expect(result[0].amountUsd).toBe(0)
  })

  it('handles multiple positions across different tokens', () => {
    const positions: V3UserPosition[] = [
      {
        chainId: 1,
        asset: USDC_ADDR,
        supplyWad: 5000n * WAD,
        stableBorrowWad: 0n,
        variableBorrowWad: 0n,
        isCollateral: true,
      },
      {
        chainId: 1,
        asset: WETH_ADDR,
        supplyWad: 10n * WAD,
        stableBorrowWad: 0n,
        variableBorrowWad: 3n * WAD,
        isCollateral: true,
      },
    ]
    const result = convertV3PositionsToWalletPositions(positions, reserves)
    expect(result).toHaveLength(3)
    expect(result.filter(p => p.tokenSymbol === 'USDC')).toHaveLength(1)
    expect(result.filter(p => p.tokenSymbol === 'WETH')).toHaveLength(2)
  })
})

describe('convertV4PositionsToWalletPositions', () => {
  it('converts a V4 supply position', () => {
    const positions: V4UserPosition[] = [
      {
        chainId: 1,
        spokeName: 'MAIN_SPOKE',
        reserveId: 1n,
        asset: WETH_ADDR,
        suppliedAssets: 10n * WAD,
        stableDebt: 0n,
        variableDebt: 0n,
        isCollateral: true,
      },
    ]
    const result = convertV4PositionsToWalletPositions(positions, reserves)
    expect(result).toHaveLength(1)
    expect(result[0].side).toBe('supply')
    expect(result[0].amountWad).toBe(10n * WAD)
    expect(result[0].amountUsd).toBe(30000)
    expect(result[0].source).toBe('onchain-v4')
    expect(result[0].isOrphan).toBe(false)
  })

  it('converts a V4 position with supply and borrow', () => {
    const positions: V4UserPosition[] = [
      {
        chainId: 1,
        spokeName: 'MAIN_SPOKE',
        reserveId: 1n,
        asset: WETH_ADDR,
        suppliedAssets: 5n * WAD,
        stableDebt: 2n * WAD,
        variableDebt: 1n * WAD,
        isCollateral: true,
      },
    ]
    const result = convertV4PositionsToWalletPositions(positions, reserves)
    expect(result).toHaveLength(2)
    const supply = result.find(p => p.side === 'supply')!
    const borrow = result.find(p => p.side === 'borrow')!
    expect(supply.amountWad).toBe(5n * WAD)
    expect(borrow.amountWad).toBe(3n * WAD)
  })

  it('skips V4 zero-amount sides', () => {
    const positions: V4UserPosition[] = [
      {
        chainId: 1,
        spokeName: 'MAIN_SPOKE',
        reserveId: 1n,
        asset: WETH_ADDR,
        suppliedAssets: 0n,
        stableDebt: 0n,
        variableDebt: 2n * WAD,
        isCollateral: false,
      },
    ]
    const result = convertV4PositionsToWalletPositions(positions, reserves)
    expect(result).toHaveLength(1)
    expect(result[0].side).toBe('borrow')
  })

  it('marks V4 orphan when asset not found', () => {
    const positions: V4UserPosition[] = [
      {
        chainId: 1,
        spokeName: 'MAIN_SPOKE',
        reserveId: 1n,
        asset: DAI_ADDR,
        suppliedAssets: 1000n * WAD,
        stableDebt: 0n,
        variableDebt: 0n,
        isCollateral: true,
      },
    ]
    const result = convertV4PositionsToWalletPositions(positions, reserves)
    expect(result).toHaveLength(1)
    expect(result[0].isOrphan).toBe(true)
  })
})
