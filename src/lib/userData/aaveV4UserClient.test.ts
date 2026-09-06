import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  V4_SPOKE_ADDRESSES,
  V4_HUB_ADDRESSES,
  getV4SpokeAddresses,
  getV4HubAddresses,
  V4UserPosition,
  V4AccountSummary,
  V4OnchainResult,
  V4OnchainResponse,
  SPOKE_ABI,
  getV4UserPositionsOnChain,
  getV4UserPositionsAllSpokes,
  type V4ReserveInfo,
} from './aaveV4UserClient'
import { createPublicClient } from 'viem'
import { createClientWithRpcRotation } from './rpcResilience'
import { getAllRpcUrls } from './chainDiscovery'

vi.mock('./chainDiscovery', () => ({
  getAllRpcUrls: vi.fn().mockReturnValue([]),
}))

vi.mock('viem', () => ({
  createPublicClient: vi.fn(),
  http: vi.fn(() => 'mocked-transport'),
}))

describe('AAV-456 Slice 1: V4 address mapping + ABI types', () => {
  it('V4_SPOKE_ADDRESSES includes Ethereum (1)', () => {
    const chainIds = Object.keys(V4_SPOKE_ADDRESSES).map(Number)
    expect(chainIds).toContain(1)
  })

  it('V4_SPOKE_ADDRESSES[1] contains non-oracle spokes', () => {
    const spokes = V4_SPOKE_ADDRESSES[1]
    expect(spokes.length).toBeGreaterThanOrEqual(10)
    const names = spokes.map((s) => s.name)
    expect(names).toContain('MAIN_SPOKE')
    expect(names).toContain('BLUECHIP_SPOKE')
    expect(names).toContain('ETHENA_CORRELATED_SPOKE')
    expect(names).toContain('ETHENA_ECOSYSTEM_SPOKE')
    expect(names).toContain('FOREX_SPOKE')
    expect(names).toContain('GOLD_SPOKE')
    expect(names).toContain('LOMBARD_BTC_SPOKE')
    expect(names).toContain('ETHERFI_ESPOKE')
    expect(names).toContain('KELP_ESPOKE')
    expect(names).toContain('LIDO_ESPOKE')
  })

  it('V4_SPOKE_ADDRESSES[1] excludes oracle spokes', () => {
    const spokes = V4_SPOKE_ADDRESSES[1]
    const names = spokes.map((s) => s.name)
    for (const name of names) {
      expect(name).not.toMatch(/_ORACLE$/)
    }
  })

  it('V4_SPOKE_ADDRESSES[1] excludes treasury spoke', () => {
    const spokes = V4_SPOKE_ADDRESSES[1]
    const names = spokes.map((s) => s.name)
    expect(names).not.toContain('TREASURY_SPOKE')
  })

  it('each spoke has valid address format', () => {
    for (const chainIdStr of Object.keys(V4_SPOKE_ADDRESSES)) {
      const spokes = V4_SPOKE_ADDRESSES[Number(chainIdStr)]
      for (const spoke of spokes) {
        expect(spoke.address).toMatch(/^0x[0-9a-fA-F]{40}$/)
      }
    }
  })

  it('V4_HUB_ADDRESSES includes Ethereum (1)', () => {
    const chainIds = Object.keys(V4_HUB_ADDRESSES).map(Number)
    expect(chainIds).toContain(1)
  })

  it('V4_HUB_ADDRESSES[1] (Ethereum) has at least 3 hubs', () => {
    const hubs = V4_HUB_ADDRESSES[1]
    expect(hubs).toBeDefined()
    expect(hubs.length).toBeGreaterThanOrEqual(3)
    const names = hubs.map((h) => h.name)
    expect(names).toContain('CORE_HUB')
    expect(names).toContain('PLUS_HUB')
    expect(names).toContain('PRIME_HUB')
  })

  it('getV4SpokeAddresses returns spokes for known chain, undefined for unknown', () => {
    expect(getV4SpokeAddresses(1)).toBeDefined()
    expect(getV4SpokeAddresses(1)!.length).toBeGreaterThanOrEqual(10)
    expect(getV4SpokeAddresses(137)).toBeUndefined()
  })

  it('getV4HubAddresses returns hubs for known chain, undefined for unknown', () => {
    expect(getV4HubAddresses(1)).toBeDefined()
    expect(getV4HubAddresses(1)!.length).toBeGreaterThanOrEqual(3)
    expect(getV4HubAddresses(42161)).toBeUndefined()
  })

  it('SPOKE_ABI has required view functions', () => {
    const functionNames = SPOKE_ABI.filter((e) => e.type === 'function').map((e: { name: string }) => e.name)
    expect(functionNames).toContain('getUserSuppliedAssets')
    expect(functionNames).toContain('getUserDebt')
    expect(functionNames).toContain('getUserReserveStatus')
    expect(functionNames).toContain('getUserAccountData')
  })

  it('V4UserPosition type is correct shape', () => {
    const pos: V4UserPosition = {
      chainId: 1,
      spokeName: 'MAIN_SPOKE',
      reserveId: 0n,
      asset: '0x0000000000000000000000000000000000000000' as `0x${string}`,
      suppliedAssets: 100n,
      stableDebt: 0n,
      variableDebt: 50n,
      isCollateral: true,
    }
    expect(pos.chainId).toBe(1)
    expect(pos.spokeName).toBe('MAIN_SPOKE')
  })

  it('V4AccountSummary type is correct shape', () => {
    const summary: V4AccountSummary = {
      chainId: 1,
      spokeName: 'MAIN_SPOKE',
      spokeAddress: MAIN_SPOKE.address,
      healthFactor: 2000000000000000000n,
      totalCollateralValue: 1000000000000000000n,
      totalDebtValueRay: 500000000000000000n,
    }
    expect(summary.chainId).toBe(1)
    expect(summary.healthFactor).toBeGreaterThan(0n)
  })

  it('V4OnchainResult and V4OnchainResponse types are correct', () => {
    const result: V4OnchainResult = { positions: [], accountSummaries: [] }
    expect(result.positions).toEqual([])
    const response: V4OnchainResponse = { results: [], errors: [] }
    expect(response.errors).toEqual([])
  })
})

function makeMockClient(multicallResult: unknown[]) {
  const mockMulticall = vi.fn().mockResolvedValue(multicallResult)
  const client = {
    multicall: mockMulticall,
  } as unknown as Parameters<typeof getV4UserPositionsOnChain>[5]
  return { client, mockMulticall }
}

const USER = '0x1111111111111111111111111111111111111111' as `0x${string}`
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' as `0x${string}`
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as `0x${string}`
const MAIN_SPOKE = getV4SpokeAddresses(1)!.find((s) => s.name === 'MAIN_SPOKE')!

describe('AAV-456 Slice 2: getV4UserPositionsOnChain', () => {
  it('returns positions for reserves with non-zero balances', async () => {
    const { client } = makeMockClient([
      { status: 'success', result: 1000n * 10n ** 18n },
      { status: 'success', result: [0n, 500n * 10n ** 18n] },
      { status: 'success', result: [true, true] },
      { status: 'success', result: 0n },
      { status: 'success', result: [0n, 0n] },
      { status: 'success', result: [false, false] },
      {
        status: 'success',
        result: {
          riskPremium: 0n,
          avgCollateralFactor: 8000n,
          healthFactor: 1000000000000000000n,
          totalCollateralValue: 1000n * 10n ** 18n,
          totalDebtValueRay: 500n * 10n ** 27n,
          activeCollateralCount: 1n,
          borrowCount: 1n,
        },
      },
    ])

    const reserves: V4ReserveInfo[] = [
      { reserveId: 0n, asset: WETH },
      { reserveId: 1n, asset: USDC },
    ]

    const result = await getV4UserPositionsOnChain(1, 'MAIN_SPOKE', MAIN_SPOKE.address, USER, reserves, client)

    expect(result.positions).toHaveLength(1)
    expect(result.positions[0]).toEqual({
      chainId: 1,
      spokeName: 'MAIN_SPOKE',
      reserveId: 0n,
      asset: WETH,
      suppliedAssets: 1000n * 10n ** 18n,
      stableDebt: 0n,
      variableDebt: 500n * 10n ** 18n,
      isCollateral: true,
    })
    expect(result.accountSummaries).toHaveLength(1)
    expect(result.accountSummaries[0].healthFactor).toBe(1000000000000000000n)
  })

  it('skips zero-balance reserves', async () => {
    const { client } = makeMockClient([
      { status: 'success', result: 0n },
      { status: 'success', result: [0n, 0n] },
      { status: 'success', result: [false, false] },
      {
        status: 'success',
        result: {
          riskPremium: 0n,
          avgCollateralFactor: 0n,
          healthFactor: 0n,
          totalCollateralValue: 0n,
          totalDebtValueRay: 0n,
          activeCollateralCount: 0n,
          borrowCount: 0n,
        },
      },
    ])

    const result = await getV4UserPositionsOnChain(
      1, 'MAIN_SPOKE', MAIN_SPOKE.address, USER,
      [{ reserveId: 0n, asset: WETH }],
      client,
    )
    expect(result.positions).toHaveLength(0)
  })

  it('skips failed multicall entries', async () => {
    const { client } = makeMockClient([
      { status: 'failure', result: undefined },
      { status: 'failure', result: undefined },
      { status: 'failure', result: undefined },
      {
        status: 'success',
        result: {
          riskPremium: 0n,
          avgCollateralFactor: 0n,
          healthFactor: 0n,
          totalCollateralValue: 0n,
          totalDebtValueRay: 0n,
          activeCollateralCount: 0n,
          borrowCount: 0n,
        },
      },
    ])

    const result = await getV4UserPositionsOnChain(
      1, 'MAIN_SPOKE', MAIN_SPOKE.address, USER,
      [{ reserveId: 0n, asset: WETH }],
      client,
    )
    expect(result.positions).toHaveLength(0)
  })

  it('returns empty positions when no client available', async () => {
    const result = await getV4UserPositionsOnChain(
      999999, 'MAIN_SPOKE', MAIN_SPOKE.address, USER,
      [{ reserveId: 0n, asset: WETH }],
    )
    expect(result.positions).toHaveLength(0)
    expect(result.accountSummaries).toHaveLength(0)
  })

  it('returns empty accountSummaries when getUserAccountData fails', async () => {
    const { client } = makeMockClient([
      { status: 'success', result: 100n * 10n ** 18n },
      { status: 'success', result: [0n, 0n] },
      { status: 'success', result: [true, false] },
      { status: 'failure', result: undefined },
    ])

    const result = await getV4UserPositionsOnChain(
      1, 'MAIN_SPOKE', MAIN_SPOKE.address, USER,
      [{ reserveId: 0n, asset: WETH }],
      client,
    )
    expect(result.positions).toHaveLength(1)
    expect(result.accountSummaries).toHaveLength(0)
  })

  it('handles partial multicall failures (some reserves succeed, some fail)', async () => {
    const { client } = makeMockClient([
      { status: 'success', result: 100n * 10n ** 18n },
      { status: 'success', result: [0n, 0n] },
      { status: 'success', result: [true, false] },
      { status: 'failure', result: undefined },
      { status: 'failure', result: undefined },
      { status: 'failure', result: undefined },
      {
        status: 'success',
        result: {
          riskPremium: 0n,
          avgCollateralFactor: 8000n,
          healthFactor: 1500000000000000000n,
          totalCollateralValue: 100n * 10n ** 18n,
          totalDebtValueRay: 0n,
          activeCollateralCount: 1n,
          borrowCount: 0n,
        },
      },
    ])

    const reserves: V4ReserveInfo[] = [
      { reserveId: 0n, asset: WETH },
      { reserveId: 1n, asset: USDC },
    ]

    const result = await getV4UserPositionsOnChain(1, 'MAIN_SPOKE', MAIN_SPOKE.address, USER, reserves, client)
    expect(result.positions).toHaveLength(1)
    expect(result.positions[0].asset).toBe(WETH)
    expect(result.accountSummaries).toHaveLength(1)
  })
})

describe('AAV-456 Slice 3: getV4UserPositionsAllSpokes', () => {
  it('returns empty for unknown chain', async () => {
    const result = await getV4UserPositionsAllSpokes(999999, USER, {})
    expect(result.results).toHaveLength(0)
    expect(result.errors).toHaveLength(0)
  })

  it('filters spokes with no reserves', async () => {
    const result = await getV4UserPositionsAllSpokes(1, USER, {
      MAIN_SPOKE: [{ reserveId: 0n, asset: WETH }],
    })
    expect(result.results.length + result.errors.length).toBe(1)
  })

  it('skips spokes not in reservesBySpoke', async () => {
    const result = await getV4UserPositionsAllSpokes(1, USER, {})
    expect(result.results).toHaveLength(0)
  })
})

describe('createClientWithRpcRotation', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns null for chain with no RPC URLs', async () => {
    vi.mocked(getAllRpcUrls).mockReturnValue([])
    const result = await createClientWithRpcRotation(999991)
    expect(result).toBeNull()
  })

  it('returns a client for a known chain', async () => {
    vi.mocked(getAllRpcUrls).mockReturnValue(['https://eth.drpc.org'])
    vi.mocked(createPublicClient).mockReturnValue({
      getChainId: vi.fn().mockResolvedValue(1),
    } as unknown as ReturnType<typeof createPublicClient>)
    const result = await createClientWithRpcRotation(1)
    expect(result).not.toBeNull()
  })
})
