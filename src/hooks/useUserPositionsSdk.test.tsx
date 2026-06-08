// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  enrichV3SupplyPositions,
  enrichV3BorrowPositions,
  enrichV4SupplyPositions,
  enrichV4BorrowPositions,
  buildV3MarketInputs,
  buildV4ChainIds,
  buildV3SdkArgs,
  buildV4SdkArgs,
  useUserPositionsSdk,
} from './useUserPositionsSdk'
import { composeReserveId } from '@/lib/reserveKey'
import { V3_POOL_ADDRESSES } from '@/lib/userData/aaveV3UserClient'
import type { ReserveWithSpread } from '@/types/aave'
import { evmAddress, chainId } from '@aave/types'
import { bumpRefetch, _resetRefetchListeners } from '@/lib/userData/refetchEvent'

// ---------- mocks (must be set up before any import that uses them) ----------

const { useWalletMock } = vi.hoisted(() => ({
  useWalletMock: vi.fn(),
}))
const { mockGapRefetch } = vi.hoisted(() => ({ mockGapRefetch: vi.fn() }))
const { mockInvalidateQueries, lastOnchainFallbackQueryKey } = vi.hoisted(() => ({
  mockInvalidateQueries: vi.fn(),
  lastOnchainFallbackQueryKey: { value: undefined as readonly unknown[] | undefined },
}))

vi.mock('./useWallet', () => ({
  useWallet: useWalletMock,
}))

vi.mock('@aave/react', () => ({
  useUserSupplies: vi.fn(() => ({ data: undefined, loading: true, error: undefined })),
  useUserBorrows: vi.fn(() => ({ data: undefined, loading: true, error: undefined })),
}))

vi.mock('@aave/react-v3', () => ({
  useUserSupplies: vi.fn(() => ({ data: undefined, loading: true, error: undefined })),
  useUserBorrows: vi.fn(() => ({ data: undefined, loading: true, error: undefined })),
}))

vi.mock('@/lib/userData/gapFallbackQuery', () => ({
  useGapFallbackQuery: vi.fn(() => ({
    data: undefined,
    isLoading: false,
    refetch: mockGapRefetch,
  })),
}))

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query')
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
    useQuery: (opts: { queryKey: readonly unknown[] }) => {
      if (Array.isArray(opts.queryKey) && opts.queryKey[0] === 'user-positions-onchain-fallback') {
        lastOnchainFallbackQueryKey.value = opts.queryKey
      }
      return {
        data: undefined,
        isLoading: false,
        isFetched: false,
        refetch: vi.fn(),
      }
    },
  }
})

const POOL = '0x87870bca3f3fd6b5bb36c0221bcc5c4c1f7c69c6' as `0x${string}`
const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' as `0x${string}`
const WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2' as `0x${string}`
const SPOKE = '0x794a61358d682efdc006d42ba3808ad9c1fa5d07' as `0x${string}`
const HUB = '0xcca852bc40e560adc3b1cc58ca5b55638ce826c9' as `0x${string}`
const USER = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e' as `0x${string}`
const ZERO = '0x0000000000000000000000000000000000000000' as `0x${string}`

function makeReserve(overrides: Partial<ReserveWithSpread> & { marketName: string; chainId: number; tokenAddress: string }): ReserveWithSpread {
  return {
    reserveId: `${overrides.chainId}:${POOL}:${overrides.tokenAddress}`,
    marketName: overrides.marketName,
    chainName: 'Ethereum',
    chainId: overrides.chainId,
    tokenName: 'Token',
    tokenSymbol: 'TKN',
    tokenAddress: overrides.tokenAddress,
    ...overrides,
  } as ReserveWithSpread
}

describe('enrichV3SupplyPositions', () => {
  it('extracts spokeAddress from market.address', () => {
    const result = enrichV3SupplyPositions([{
      market: { address: POOL, chain: { chainId: 1 } },
      currency: { address: USDC, symbol: 'USDC', decimals: 6, chainId: 1 },
      balance: { amount: { value: '100', raw: '100000000', decimals: 6 } },
      isCollateral: true,
    }])
    expect(result).toHaveLength(1)
    expect(result[0].reserve.spokeAddress).toBe(POOL)
    expect(result[0].reserve.underlyingAsset.address).toBe(USDC)
    expect(result[0].reserve.symbol).toBe('USDC')
    expect(result[0].reserve.decimals).toBe(6)
    expect(result[0].isCollateral).toBe(true)
  })

  it('constructs reserve.id via composeReserveId (lowercase consistent)', () => {
    const result = enrichV3SupplyPositions([{
      market: { address: POOL, chain: { chainId: 1 } },
      currency: { address: USDC, symbol: 'USDC', decimals: 6, chainId: 1 },
      balance: { amount: { value: '0', raw: '0', decimals: 6 } },
      isCollateral: false,
    }])
    expect(result[0].reserve.id).toBe(composeReserveId(1, POOL, USDC))
  })
})

describe('enrichV3BorrowPositions', () => {
  it('extracts spokeAddress from market.address', () => {
    const result = enrichV3BorrowPositions([{
      market: { address: POOL, chain: { chainId: 1 } },
      currency: { address: WETH, symbol: 'WETH', decimals: 18, chainId: 1 },
      debt: { amount: { value: '0.5', raw: '500000000000000000', decimals: 18 } },
    }])
    expect(result).toHaveLength(1)
    expect(result[0].reserve.spokeAddress).toBe(POOL)
    expect(result[0].reserve.underlyingAsset.address).toBe(WETH)
  })
})

describe('enrichV4SupplyPositions', () => {
  it('extracts spokeAddress, hubName, and hubAddresses from spoke', () => {
    const result = enrichV4SupplyPositions([{
      id: 'v4-supply-1',
      reserve: {
        id: 'v4-reserve',
        spoke: { address: SPOKE, chain: { chainId: 42161 }, connectedHubs: [{ hub: { name: 'Core', address: HUB } }] },
        summary: { supplied: { token: { address: USDC, info: { symbol: 'USDC', decimals: 6 } } } },
      },
      balance: { amount: { value: '500', onChainValue: 500000000n, decimals: 6 } },
      isCollateral: false,
    }])
    expect(result).toHaveLength(1)
    expect(result[0].reserve.spokeAddress).toBe(SPOKE)
    expect(result[0].reserve.hubName).toBe('Core')
    expect(result[0].reserve.hubAddresses).toEqual([HUB])
    expect(result[0].reserve.underlyingAsset.address).toBe(USDC)
  })

  it('handles missing connectedHubs (no hubName, no hubAddresses)', () => {
    const result = enrichV4SupplyPositions([{
      id: 'v4-supply-2',
      reserve: {
        id: 'v4-reserve-2',
        spoke: { address: SPOKE, chain: { chainId: 1 } },
        summary: { supplied: { token: { address: WETH, info: { symbol: 'WETH', decimals: 18 } } } },
      },
      balance: { amount: { value: '1', onChainValue: 1000000000000000000n, decimals: 18 } },
      isCollateral: true,
    }])
    expect(result[0].reserve.hubName).toBeUndefined()
    expect(result[0].reserve.hubAddresses).toBeUndefined()
  })
})

describe('enrichV4BorrowPositions', () => {
  it('extracts spokeAddress, hubName, and hubAddresses from spoke', () => {
    const result = enrichV4BorrowPositions([{
      id: 'v4-borrow-1',
      reserve: {
        id: 'v4-reserve-3',
        spoke: { address: SPOKE, chain: { chainId: 1 }, connectedHubs: [{ hub: { name: 'Plus', address: HUB } }] },
        summary: { borrowed: { token: { address: USDC, info: { symbol: 'USDC', decimals: 6 } } } },
      },
      principal: { amount: { value: '1000', onChainValue: 1000000000n, decimals: 6 } },
    }])
    expect(result).toHaveLength(1)
    expect(result[0].reserve.spokeAddress).toBe(SPOKE)
    expect(result[0].reserve.hubName).toBe('Plus')
    expect(result[0].reserve.hubAddresses).toEqual([HUB])
    expect(result[0].reserve.underlyingAsset.address).toBe(USDC)
  })
})

describe('buildV3MarketInputs', () => {
  it('returns empty for empty reserves', () => {
    expect(buildV3MarketInputs([])).toHaveLength(0)
  })

  it('builds market inputs from V3 reserves using V3_POOL_ADDRESSES', () => {
    const reserves = [makeReserve({
      marketName: 'AaveV3Ethereum',
      chainId: 1,
      tokenAddress: USDC,
    })]
    const result = buildV3MarketInputs(reserves)
    expect(result).toHaveLength(1)
    expect(String(result[0].address)).toBe(String(evmAddress(V3_POOL_ADDRESSES[1]!)))
    expect(String(result[0].chainId)).toBe(String(chainId(1)))
  })

  it('skips V4 reserves (those with spokeAddress)', () => {
    const reserves = [
      makeReserve({
        marketName: 'AaveV3Ethereum',
        chainId: 1,
        tokenAddress: USDC,
      }),
      makeReserve({
        marketName: 'AaveV4Ethereum',
        chainId: 1,
        tokenAddress: WETH,
        spokeAddress: SPOKE,
      }),
    ]
    const result = buildV3MarketInputs(reserves)
    expect(result).toHaveLength(1)
  })

  it('deduplicates by chainId:poolAddress', () => {
    const reserves = [
      makeReserve({ marketName: 'AaveV3Ethereum', chainId: 1, tokenAddress: USDC }),
      makeReserve({ marketName: 'AaveV3Ethereum', chainId: 1, tokenAddress: WETH }),
    ]
    const result = buildV3MarketInputs(reserves)
    expect(result).toHaveLength(1)
  })

  it('skips chains not in V3_POOL_ADDRESSES', () => {
    const reserves = [makeReserve({
      marketName: 'AaveV3Unknown',
      chainId: 999999,
      tokenAddress: USDC,
    })]
    expect(buildV3MarketInputs(reserves)).toHaveLength(0)
  })
})

describe('buildV4ChainIds', () => {
  it('returns empty for empty reserves', () => {
    expect(buildV4ChainIds([])).toHaveLength(0)
  })

  it('extracts unique chainIds from V4 reserves', () => {
    const reserves = [
      makeReserve({ marketName: 'AaveV4Ethereum', chainId: 1, tokenAddress: USDC, spokeAddress: SPOKE }),
      makeReserve({ marketName: 'AaveV4Ethereum', chainId: 1, tokenAddress: WETH, spokeAddress: SPOKE }),
    ]
    expect(buildV4ChainIds(reserves)).toEqual([1])
  })

  it('skips V3 reserves', () => {
    const reserves = [
      makeReserve({ marketName: 'AaveV3Ethereum', chainId: 1, tokenAddress: USDC }),
    ]
    expect(buildV4ChainIds(reserves)).toHaveLength(0)
  })

  it('returns multiple unique chainIds', () => {
    const reserves = [
      makeReserve({ marketName: 'AaveV4Ethereum', chainId: 1, tokenAddress: USDC, spokeAddress: SPOKE }),
      makeReserve({ marketName: 'AaveV4Arbitrum', chainId: 42161, tokenAddress: WETH, spokeAddress: SPOKE }),
    ]
    expect(buildV4ChainIds(reserves)).toEqual([1, 42161])
  })
})

describe('buildV3SdkArgs', () => {
  it('returns dummy args when disabled', () => {
    const result = buildV3SdkArgs(false, undefined, [])
    expect(String(result.user)).toBe(String(evmAddress(ZERO)))
    expect(result.markets).toHaveLength(1)
    expect(String(result.markets[0].address)).toBe(String(evmAddress(ZERO)))
  })

  it('returns dummy args when no market inputs', () => {
    const result = buildV3SdkArgs(true, USER, [])
    expect(String(result.user)).toBe(String(evmAddress(ZERO)))
  })

  it('returns dummy args when account is undefined despite enabled', () => {
    const marketInputs = [{ address: evmAddress(V3_POOL_ADDRESSES[1]!), chainId: chainId(1) }]
    const result = buildV3SdkArgs(true, undefined, marketInputs)
    expect(String(result.user)).toBe(String(evmAddress(ZERO)))
  })

  it('returns real args when enabled with markets', () => {
    const marketInputs = [{ address: evmAddress(V3_POOL_ADDRESSES[1]!), chainId: chainId(1) }]
    const result = buildV3SdkArgs(true, USER, marketInputs)
    expect(String(result.user)).toBe(String(evmAddress(USER)))
    expect(result.markets).toBe(marketInputs)
  })
})

describe('buildV4SdkArgs', () => {
  it('returns dummy args when disabled', () => {
    const result = buildV4SdkArgs(false, undefined, [])
    expect(String(result.query.userChains.user)).toBe(String(evmAddress(ZERO)))
    expect(result.query.userChains.chainIds).toHaveLength(1)
  })

  it('returns dummy args when no chainIds', () => {
    const result = buildV4SdkArgs(true, USER, [])
    expect(String(result.query.userChains.user)).toBe(String(evmAddress(ZERO)))
  })

  it('returns dummy args when account is undefined despite enabled', () => {
    const result = buildV4SdkArgs(true, undefined, [1])
    expect(String(result.query.userChains.user)).toBe(String(evmAddress(ZERO)))
  })

  it('returns real args when enabled with chainIds', () => {
    const result = buildV4SdkArgs(true, USER, [1, 42161])
    expect(String(result.query.userChains.user)).toBe(String(evmAddress(USER)))
    expect(result.query.userChains.chainIds.map(String)).toEqual([String(chainId(1)), String(chainId(42161))])
  })
})

// ---------- refetchEvent subscription (S3) ----------

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('useUserPositionsSdk - refetchEvent subscription (S3, AAV-679)', () => {
  beforeEach(() => {
    _resetRefetchListeners()
    mockInvalidateQueries.mockClear()
    mockGapRefetch.mockClear()
    lastOnchainFallbackQueryKey.value = undefined
    useWalletMock.mockReturnValue({
      address: USER,
      isConnected: true,
      isWatchMode: false,
    })
  })

  it('invalidates the onchain-fallback query when refetchEvent is bumped', () => {
    const { unmount } = renderHook(
      () => useUserPositionsSdk([], {}, {}),
      { wrapper },
    )

    bumpRefetch('watch-reentry')

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['user-positions-onchain-fallback', USER],
    })
    unmount()
  })

  it('also refetches the gap-fallback query when refetchEvent is bumped', () => {
    const { unmount } = renderHook(
      () => useUserPositionsSdk([], {}, {}),
      { wrapper },
    )

    bumpRefetch('button')

    expect(mockGapRefetch).toHaveBeenCalledTimes(1)
    unmount()
  })

  it('uses the no-wallet fallback key when no address is connected', () => {
    useWalletMock.mockReturnValue({
      address: undefined,
      isConnected: false,
      isWatchMode: false,
    })

    const { unmount } = renderHook(
      () => useUserPositionsSdk([], {}, {}),
      { wrapper },
    )

    bumpRefetch('watch-reentry')

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['user-positions-onchain-fallback', 'no-wallet'],
    })
    unmount()
  })

  it('does not fire the callback after unmount', () => {
    const { unmount } = renderHook(
      () => useUserPositionsSdk([], {}, {}),
      { wrapper },
    )
    unmount()

    bumpRefetch('watch-reentry')
    expect(mockInvalidateQueries).not.toHaveBeenCalled()
    expect(mockGapRefetch).not.toHaveBeenCalled()
  })
})
