import { describe, it, expect, vi } from 'vitest'
import {
  V3_POOL_ADDRESSES,
  getV3PoolAddress,
  MULTICALL3_ADDRESS,
  getV3UserPositionsOnChain,
  getV3UserPositionsMultiChain,
  type V3OnchainResult,
  type V3AssetsByMarket,
} from './aaveV3UserClient'
import { createClientWithRpcRotation } from './rpcResilience'
import { AAVE_V3_CHAIN_IDS } from '../aaveChains'
import type { createPublicClient } from 'viem'

vi.mock('./chainDiscovery', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./chainDiscovery')>()
  return {
    ...actual,
    getAllRpcUrls: vi.fn().mockReturnValue([]),
  }
})

describe('V3_POOL_ADDRESSES', () => {
  it('covers all V3 mainnet chain IDs', () => {
    const coveredChains = Object.keys(V3_POOL_ADDRESSES).map(Number)
    for (const chainId of AAVE_V3_CHAIN_IDS) {
      expect(coveredChains).toContain(chainId)
    }
  })

  it('every value is a valid checksummed address', () => {
    const addressRegex = /^0x[0-9a-fA-F]{40}$/
    for (const [chainId, address] of Object.entries(V3_POOL_ADDRESSES)) {
      expect(address).toMatch(addressRegex)
      expect(typeof chainId).toBe('string')
    }
  })

  it('has at least 21 entries', () => {
    expect(Object.keys(V3_POOL_ADDRESSES).length).toBeGreaterThanOrEqual(21)
  })
})

describe('getV3PoolAddress', () => {
  it('returns Pool address for known chain', () => {
    const addr = getV3PoolAddress(1)
    expect(addr).toBe('0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2')
  })

  it('returns undefined for unknown chain', () => {
    const addr = getV3PoolAddress(999999)
    expect(addr).toBeUndefined()
  })

  it('returns correct address for Arbitrum', () => {
    expect(getV3PoolAddress(42161)).toBe(
      '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
    )
  })
})

describe('MULTICALL3_ADDRESS', () => {
  it('is the well-known Multicall3 address', () => {
    expect(MULTICALL3_ADDRESS).toBe(
      '0xcA11bde05977b7Ac6400656eDA8769A2C45a8c3',
    )
  })
})

function makeMockClient(multicallResult: unknown[]) {
  const mockMulticall = vi.fn().mockResolvedValue(multicallResult)
  const client = {
    multicall: mockMulticall,
  } as unknown as Parameters<typeof getV3UserPositionsOnChain>[4]
  return { client, mockMulticall }
}

const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F' as `0x${string}`
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as `0x${string}`
const USER = '0x1111111111111111111111111111111111111111' as `0x${string}`
const POOL = getV3PoolAddress(1)!

describe('getV3UserPositionsOnChain', () => {
  it('returns positions for reserves with non-zero balances', async () => {
    const { client } = makeMockClient([
      {
        status: 'success',
        result: {
          currentATokenBalance: 1000n * 10n ** 18n,
          currentStableDebt: 0n,
          currentVariableDebt: 500n * 10n ** 18n,
          scaledVariableDebt: 0n,
          usageAsCollateralEnabled: true,
        },
      },
      {
        status: 'success',
        result: {
          currentATokenBalance: 0n,
          currentStableDebt: 0n,
          currentVariableDebt: 0n,
          scaledVariableDebt: 0n,
          usageAsCollateralEnabled: false,
        },
      },
      {
        status: 'success',
        result: {
          totalCollateralBase: 1000n * 10n ** 8n,
          totalDebtBase: 500n * 10n ** 8n,
          availableBorrowsBase: 400n * 10n ** 8n,
          currentLiquidationThreshold: 8000n,
          ltv: 7500n,
          healthFactor: 1000000000000000000n,
        },
      },
    ])

    const result = await getV3UserPositionsOnChain(1, USER, [DAI, USDC], 'AaveV3Ethereum', client)

    expect(result.positions).toHaveLength(1)
    expect(result.positions[0]).toEqual({
      chainId: 1,
      marketName: 'AaveV3Ethereum',
      asset: DAI,
      supplyWad: 1000n * 10n ** 18n,
      stableBorrowWad: 0n,
      variableBorrowWad: 500n * 10n ** 18n,
      isCollateral: true,
    })
    expect(result.accountSummary).not.toBeNull()
    expect(result.accountSummary!.healthFactorWad).toBe(1000000000000000000n)
  })

  it('skips zero-balance reserves', async () => {
    const { client } = makeMockClient([
      {
        status: 'success',
        result: {
          currentATokenBalance: 0n,
          currentStableDebt: 0n,
          currentVariableDebt: 0n,
          scaledVariableDebt: 0n,
          usageAsCollateralEnabled: false,
        },
      },
      {
        status: 'success',
        result: {
          totalCollateralBase: 0n,
          totalDebtBase: 0n,
          availableBorrowsBase: 0n,
          currentLiquidationThreshold: 0n,
          ltv: 0n,
          healthFactor: 0n,
        },
      },
    ])

    const result = await getV3UserPositionsOnChain(1, USER, [DAI], 'AaveV3Ethereum', client)
    expect(result.positions).toHaveLength(0)
  })

  it('skips failed multicall entries', async () => {
    const { client } = makeMockClient([
      { status: 'failure', result: undefined },
      {
        status: 'success',
        result: {
          totalCollateralBase: 0n,
          totalDebtBase: 0n,
          availableBorrowsBase: 0n,
          currentLiquidationThreshold: 0n,
          ltv: 0n,
          healthFactor: 0n,
        },
      },
    ])

    const result = await getV3UserPositionsOnChain(1, USER, [DAI], 'AaveV3Ethereum', client)
    expect(result.positions).toHaveLength(0)
  })

  it('returns empty for unknown chain', async () => {
    const result = await getV3UserPositionsOnChain(999999, USER, [DAI], 'AaveV3Ethereum')
    expect(result.positions).toHaveLength(0)
    expect(result.accountSummary).toBeNull()
  })

  it('returns null accountSummary when getUserAccountData fails', async () => {
    const { client } = makeMockClient([
      {
        status: 'success',
        result: {
          currentATokenBalance: 100n * 10n ** 18n,
          currentStableDebt: 0n,
          currentVariableDebt: 0n,
          scaledVariableDebt: 0n,
          usageAsCollateralEnabled: true,
        },
      },
      { status: 'failure', result: undefined },
    ])

    const result = await getV3UserPositionsOnChain(1, USER, [DAI], 'AaveV3Ethereum', client)
    expect(result.positions).toHaveLength(1)
    expect(result.accountSummary).toBeNull()
  })
})

describe('getV3UserPositionsMultiChain', () => {
  it('returns results and errors from multi-chain query', async () => {
    const { client } = makeMockClient([
      {
        status: 'success',
        result: {
          currentATokenBalance: 100n * 10n ** 18n,
          currentStableDebt: 0n,
          currentVariableDebt: 0n,
          scaledVariableDebt: 0n,
          usageAsCollateralEnabled: true,
        },
      },
      {
        status: 'success',
        result: {
          totalCollateralBase: 100n * 10n ** 8n,
          totalDebtBase: 0n,
          availableBorrowsBase: 80n * 10n ** 8n,
          currentLiquidationThreshold: 8000n,
          ltv: 7500n,
          healthFactor: 1000000000000000000n,
        },
      },
    ])

    vi.doMock('./aaveV3UserClient', () => ({
      ...vi.importActual('./aaveV3UserClient'),
      getV3UserPositionsOnChain: vi
        .fn()
        .mockResolvedValueOnce({
          positions: [{ chainId: 1, marketName: 'AaveV3Ethereum', asset: DAI, supplyWad: 100n * 10n ** 18n, stableBorrowWad: 0n, variableBorrowWad: 0n, isCollateral: true }],
          accountSummary: null,
        })
        .mockRejectedValueOnce(new Error('RPC error')),
    }))

    const result = await getV3UserPositionsMultiChain(USER, {
      'AaveV3Ethereum': { chainId: 1, assets: [DAI] },
      'AaveV3Arbitrum': { chainId: 42161, assets: [USDC] },
    })

    expect(result.results.length + result.errors.length).toBe(2)
  })

  it('logs console.error on per-chain failure', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await getV3UserPositionsMultiChain(USER, {
      'AaveV3Ethereum': { chainId: 1, assets: [DAI] },
      'AaveV3Arbitrum': { chainId: 42161, assets: [USDC] },
    })

    if (result.errors.length > 0) {
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[onchain-v3]'),
        expect.any(Error),
      )
    }
    consoleSpy.mockRestore()
  })
})

describe('createClientWithRpcRotation (V3)', () => {
  it('returns null for chain with no RPC URLs', async () => {
    const result = await createClientWithRpcRotation(999991)
    expect(result).toBeNull()
  })
})
