import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchGapPositions } from '@/lib/userData/gapFallbackQuery'
import type { GapChainIds } from '@/lib/userData/gapChainComputation'
import type { WalletPosition } from '@/lib/userData/userPositionMapper'
import type { ReserveWithSpread } from '@/types/aave'
import type { V3AssetsByMarket } from '@/lib/userData/aaveV3UserClient'

vi.mock('@/lib/userData/aaveV3UserClient', () => ({
  getV3UserPositionsMultiChain: vi.fn(),
  V3_POOL_ADDRESSES: {},
}))

vi.mock('@/lib/userData/aaveV4UserClient', () => ({
  getV4UserPositionsAllSpokes: vi.fn(),
  V4_SPOKE_ADDRESSES: {},
}))

import { getV3UserPositionsMultiChain } from '@/lib/userData/aaveV3UserClient'
import { getV4UserPositionsAllSpokes } from '@/lib/userData/aaveV4UserClient'

const mockV3Positions = (chainId: number, assets: `0x${string}`[]): WalletPosition[] =>
  assets.map((asset, i) => ({
    reserveId: `gap-v3-${chainId}-${i}`,
    chainId,
    asset,
    tokenSymbol: `TK${i}`,
    side: 'supply' as const,
    amountWad: 100n,
    amountUsd: 100,
    isCollateral: true,
    source: 'gap-v3' as const,
    isOrphan: false,
  }))

const mockV4Positions = (chainId: number, assets: `0x${string}`[]): WalletPosition[] =>
  assets.map((asset, i) => ({
    reserveId: `gap-v4-${chainId}-${i}`,
    chainId,
    asset,
    tokenSymbol: `TK${i}`,
    side: 'supply' as const,
    amountWad: 200n,
    amountUsd: 200,
    isCollateral: true,
    source: 'gap-v4' as const,
    isOrphan: false,
  }))

const EMPTY_RESERVES: ReserveWithSpread[] = []
const EMPTY_V3_ASSETS: Record<string, V3AssetsByMarket> = {}
const EMPTY_V4_RESERVES: Record<string, { reserveId: bigint; asset: `0x${string}` }[]> = {}
const TEST_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`

beforeEach(() => {
  vi.mocked(getV3UserPositionsMultiChain).mockReset()
  vi.mocked(getV4UserPositionsAllSpokes).mockReset()
})

describe('fetchGapPositions', () => {
  it('returns empty when no gap chains', async () => {
    const gapChainIds: GapChainIds = { v3Gap: [], v4Gap: [] }
    const result = await fetchGapPositions({
      gapChainIds,
      address: TEST_ADDRESS,
      reserves: EMPTY_RESERVES,
      v3AssetsByMarket: EMPTY_V3_ASSETS,
      v4ReservesBySpoke: EMPTY_V4_RESERVES,
    })
    expect(result.positions).toEqual([])
    expect(result.failedSources).toEqual([])
  })

  it('fetches V3 gap positions only for gap chain markets', async () => {
    const gapChainId = 4326
    const gapChainIds: GapChainIds = { v3Gap: [gapChainId], v4Gap: [] }
    const v3AssetsByMarket: Record<string, V3AssetsByMarket> = {
      'AaveV3Eth-Chain1': { chainId: 1, assets: ['0xaaa' as `0x${string}`] },
      'AaveV3Eth-Chain4326': { chainId: gapChainId, assets: ['0xbbb' as `0x${string}`] },
    }

    vi.mocked(getV3UserPositionsMultiChain).mockResolvedValue({
      results: [{ positions: [], accountSummary: null }],
      errors: [],
    })

    const result = await fetchGapPositions({
      gapChainIds,
      address: TEST_ADDRESS,
      reserves: EMPTY_RESERVES,
      v3AssetsByMarket,
      v4ReservesBySpoke: EMPTY_V4_RESERVES,
    })

    expect(getV3UserPositionsMultiChain).toHaveBeenCalledTimes(1)
    const calledAssets = vi.mocked(getV3UserPositionsMultiChain).mock.calls[0][1]
    expect(Object.keys(calledAssets)).toEqual(['AaveV3Eth-Chain4326'])
    expect(calledAssets['AaveV3Eth-Chain4326'].chainId).toBe(gapChainId)
  })

  it('fetches V4 gap positions for each gap chainId', async () => {
    const gapChainId = 9745
    const gapChainIds: GapChainIds = { v3Gap: [], v4Gap: [gapChainId] }

    vi.mocked(getV4UserPositionsAllSpokes).mockResolvedValue({
      results: [{ positions: [], accountSummaries: [] }],
      errors: [],
    })

    await fetchGapPositions({
      gapChainIds,
      address: TEST_ADDRESS,
      reserves: EMPTY_RESERVES,
      v3AssetsByMarket: EMPTY_V3_ASSETS,
      v4ReservesBySpoke: { Spoke1: [{ reserveId: 1n, asset: '0xccc' as `0x${string}` }] },
    })

    expect(getV4UserPositionsAllSpokes).toHaveBeenCalledWith(
      gapChainId,
      TEST_ADDRESS,
      expect.anything(),
    )
  })

  it('combines V3 and V4 gap results', async () => {
    const v3GapChainId = 4326
    const v4GapChainId = 9745
    const gapChainIds: GapChainIds = { v3Gap: [v3GapChainId], v4Gap: [v4GapChainId] }
    const v3AssetsByMarket: Record<string, V3AssetsByMarket> = {
      'AaveV3Eth-Chain4326': { chainId: v3GapChainId, assets: ['0xbbb' as `0x${string}`] },
    }

    vi.mocked(getV3UserPositionsMultiChain).mockResolvedValue({
      results: [{ positions: [], accountSummary: null }],
      errors: [],
    })
    vi.mocked(getV4UserPositionsAllSpokes).mockResolvedValue({
      results: [{ positions: [], accountSummaries: [] }],
      errors: [],
    })

    await fetchGapPositions({
      gapChainIds,
      address: TEST_ADDRESS,
      reserves: EMPTY_RESERVES,
      v3AssetsByMarket,
      v4ReservesBySpoke: { Spoke1: [{ reserveId: 1n, asset: '0xccc' as `0x${string}` }] },
    })

    expect(getV3UserPositionsMultiChain).toHaveBeenCalledTimes(1)
    expect(getV4UserPositionsAllSpokes).toHaveBeenCalledTimes(1)
  })

  it('records V3 per-chain errors in failedSources', async () => {
    const gapChainIds: GapChainIds = { v3Gap: [4326], v4Gap: [] }
    const v3AssetsByMarket: Record<string, V3AssetsByMarket> = {
      'AaveV3Eth-Chain4326': { chainId: 4326, assets: ['0xbbb' as `0x${string}`] },
    }

    vi.mocked(getV3UserPositionsMultiChain).mockResolvedValue({
      results: [],
      errors: [{ chainId: 4326, error: new Error('rpc failed') }],
    })

    const result = await fetchGapPositions({
      gapChainIds,
      address: TEST_ADDRESS,
      reserves: EMPTY_RESERVES,
      v3AssetsByMarket,
      v4ReservesBySpoke: EMPTY_V4_RESERVES,
    })

    expect(result.failedSources).toContain('gap-v3-chain-4326')
  })

  it('records V3 timeout as top-level failed source', async () => {
    const gapChainIds: GapChainIds = { v3Gap: [4326], v4Gap: [] }
    const v3AssetsByMarket: Record<string, V3AssetsByMarket> = {
      'AaveV3Eth-Chain4326': { chainId: 4326, assets: ['0xbbb' as `0x${string}`] },
    }

    vi.mocked(getV3UserPositionsMultiChain).mockRejectedValue(new Error('onchain-v3 timed out'))

    const result = await fetchGapPositions({
      gapChainIds,
      address: TEST_ADDRESS,
      reserves: EMPTY_RESERVES,
      v3AssetsByMarket,
      v4ReservesBySpoke: EMPTY_V4_RESERVES,
    })

    expect(result.failedSources).toContain('gap-v3')
  })

  it('records V4 per-chain errors in failedSources', async () => {
    const gapChainIds: GapChainIds = { v3Gap: [], v4Gap: [9745] }

    vi.mocked(getV4UserPositionsAllSpokes).mockResolvedValue({
      results: [],
      errors: [{ chainId: 9745, spokeName: 'Spoke1', error: new Error('rpc failed') }],
    })

    const result = await fetchGapPositions({
      gapChainIds,
      address: TEST_ADDRESS,
      reserves: EMPTY_RESERVES,
      v3AssetsByMarket: EMPTY_V3_ASSETS,
      v4ReservesBySpoke: { Spoke1: [{ reserveId: 1n, asset: '0xccc' as `0x${string}` }] },
    })

    expect(result.failedSources).toContain('gap-v4-chain-9745-spoke-Spoke1')
  })

  it('records V4 rejection as per-chain failed source', async () => {
    const gapChainIds: GapChainIds = { v3Gap: [], v4Gap: [9745] }

    vi.mocked(getV4UserPositionsAllSpokes).mockRejectedValue(new Error('onchain-v4-chain-9745 timed out'))

    const result = await fetchGapPositions({
      gapChainIds,
      address: TEST_ADDRESS,
      reserves: EMPTY_RESERVES,
      v3AssetsByMarket: EMPTY_V3_ASSETS,
      v4ReservesBySpoke: { Spoke1: [{ reserveId: 1n, asset: '0xccc' as `0x${string}` }] },
    })

    expect(result.failedSources).toContain('gap-v4-chain-9745')
  })

  it('skips V3 when no gap V3 assets match v3AssetsByMarket', async () => {
    const gapChainIds: GapChainIds = { v3Gap: [4326], v4Gap: [] }
    const v3AssetsByMarket: Record<string, V3AssetsByMarket> = {
      'AaveV3Eth-Chain1': { chainId: 1, assets: ['0xaaa' as `0x${string}`] },
    }

    const result = await fetchGapPositions({
      gapChainIds,
      address: TEST_ADDRESS,
      reserves: EMPTY_RESERVES,
      v3AssetsByMarket,
      v4ReservesBySpoke: EMPTY_V4_RESERVES,
    })

    expect(getV3UserPositionsMultiChain).not.toHaveBeenCalled()
    expect(result.positions).toEqual([])
  })
})
