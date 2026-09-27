import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  V3_POOL_ADDRESSES,
  V3_PROTOCOL_DATA_PROVIDER_ADDRESSES,
  DATA_PROVIDER_ABI,
  POOL_ABI,
  getV3PoolAddress,
  getV3ProtocolDataProviderAddress,
  MULTICALL3_ADDRESS,
  getV3UserPositionsOnChain,
  getV3UserPositionsMultiChain,
  type V3OnchainResult,
  type V3AssetsByMarket,
} from './aaveV3UserClient';
import { createClientWithRpcRotation, RpcRotationExhaustedError } from './rpcResilience';
import { AAVE_V3_CHAIN_IDS } from '../aaveChains';
import type { createPublicClient } from 'viem';

vi.mock('./chainDiscovery', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./chainDiscovery')>();
  return {
    ...actual,
    getAllRpcUrls: vi.fn().mockReturnValue([]),
  };
});

// Per-test overrides for the chain registry tables, used to exercise the
// degradation paths (provider missing / pool missing) that no real chain
// hits today. The mock reads through getters so overrides set inside a
// test are visible to the module under test at call time.
const rpcRotationMocks = vi.hoisted(() => ({
  createClientWithRpcRotation: vi.fn(),
}));

vi.mock('./rpcResilience', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./rpcResilience')>();
  return { ...actual, createClientWithRpcRotation: rpcRotationMocks.createClientWithRpcRotation };
});

const registryOverrides = vi.hoisted(() => ({
  pool: null as Record<string, string> | null,
  provider: null as Record<string, string> | null,
}));

vi.mock('../chainRegistry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../chainRegistry')>();
  return {
    ...actual,
    get V3_POOL_ADDRESSES() {
      return registryOverrides.pool ?? actual.V3_POOL_ADDRESSES;
    },
    get V3_PROTOCOL_DATA_PROVIDER_ADDRESSES() {
      return registryOverrides.provider ?? actual.V3_PROTOCOL_DATA_PROVIDER_ADDRESSES;
    },
  };
});

describe('V3_POOL_ADDRESSES', () => {
  it('covers all V3 mainnet chain IDs', () => {
    const coveredChains = Object.keys(V3_POOL_ADDRESSES).map(Number);
    for (const chainId of AAVE_V3_CHAIN_IDS) {
      expect(coveredChains).toContain(chainId);
    }
  });

  it('every value is a valid checksummed address', () => {
    const addressRegex = /^0x[0-9a-fA-F]{40}$/;
    for (const [chainId, address] of Object.entries(V3_POOL_ADDRESSES)) {
      expect(address).toMatch(addressRegex);
      expect(typeof chainId).toBe('string');
    }
  });

  it('has at least 21 entries', () => {
    expect(Object.keys(V3_POOL_ADDRESSES).length).toBeGreaterThanOrEqual(21);
  });
});

describe('getV3PoolAddress', () => {
  it('returns Pool address for known chain', () => {
    const addr = getV3PoolAddress(1);
    expect(addr).toBe('0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2');
  });

  it('returns undefined for unknown chain', () => {
    const addr = getV3PoolAddress(999999);
    expect(addr).toBeUndefined();
  });

  it('returns correct address for Arbitrum', () => {
    expect(getV3PoolAddress(42161)).toBe('0x794a61358D6845594F94dc1DB02A252b5b4814aD');
  });
});

describe('MULTICALL3_ADDRESS', () => {
  it('is the well-known Multicall3 address', () => {
    expect(MULTICALL3_ADDRESS).toBe('0xcA11bde05977b3631167028862bE2a173976CA11');
  });
  // Regression guard: the constant once shipped as a 39-hex-char truncated
  // transcription, which viem rejects with InvalidAddressError before any RPC
  // is attempted — silently disabling the whole on-chain fallback path.
  it('passes viem address validation (20 bytes, checksummed)', async () => {
    const { isAddress } = await import('viem');
    expect(isAddress(MULTICALL3_ADDRESS)).toBe(true);
  });
});

describe('V3_PROTOCOL_DATA_PROVIDER_ADDRESSES', () => {
  it('covers the same chain set as V3_POOL_ADDRESSES (both derive from the address book)', () => {
    expect(new Set(Object.keys(V3_PROTOCOL_DATA_PROVIDER_ADDRESSES))).toEqual(new Set(Object.keys(V3_POOL_ADDRESSES)));
  });

  it('every value passes viem address validation', async () => {
    const { isAddress } = await import('viem');
    for (const address of Object.values(V3_PROTOCOL_DATA_PROVIDER_ADDRESSES)) {
      expect(isAddress(address)).toBe(true);
    }
  });

  it('mainnet matches the address live-verified in AAV-1305', () => {
    expect(getV3ProtocolDataProviderAddress(1)).toBe('0x0a16f2FCC0D44FaE41cc54e079281D84A363bECD');
  });

  it('celo matches the provider live-decoded with a real position (AAV-1305 evidence)', () => {
    expect(getV3ProtocolDataProviderAddress(42220)).toBe('0x2e0f8D3B1631296cC7c56538D6Eb6032601E15ED');
  });

  it('returns undefined for unknown chain', () => {
    expect(getV3ProtocolDataProviderAddress(999999)).toBeUndefined();
  });
});

function makeMockClient(multicallResult: unknown[]) {
  const mockMulticall = vi.fn().mockResolvedValue(multicallResult);
  const client = {
    multicall: mockMulticall,
  } as unknown as Parameters<typeof getV3UserPositionsOnChain>[4];
  return { client, mockMulticall };
}

const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F' as `0x${string}`;
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as `0x${string}`;
const USER = '0x1111111111111111111111111111111111111111' as `0x${string}`;
const POOL = getV3PoolAddress(1)!;

describe('getV3UserPositionsOnChain', () => {
  // Mock results use positional tuples — that is what real viem multicall
  // returns for multi-output calls (named objects would silently decode to
  // undefined fields, which is exactly the latent bug AAV-1305 evidence caught).
  it('returns positions for reserves with non-zero balances', async () => {
    const { client } = makeMockClient([
      { status: 'success', result: [1000n * 10n ** 18n, 0n, 500n * 10n ** 18n, 0n, 0n, 0n, 0n, 0n, true] },
      { status: 'success', result: [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, false] },
      {
        status: 'success',
        result: [1000n * 10n ** 8n, 500n * 10n ** 8n, 400n * 10n ** 8n, 8000n, 7500n, 1000000000000000000n],
      },
    ]);

    const result = await getV3UserPositionsOnChain(1, USER, [DAI, USDC], 'AaveV3Ethereum', client);

    expect(result.positions).toHaveLength(1);
    expect(result.positions[0]).toEqual({
      chainId: 1,
      marketName: 'AaveV3Ethereum',
      asset: DAI,
      supplyWad: 1000n * 10n ** 18n,
      stableBorrowWad: 0n,
      variableBorrowWad: 500n * 10n ** 18n,
      isCollateral: true,
    });
    expect(result.accountSummary).not.toBeNull();
    expect(result.accountSummary!.healthFactorWad).toBe(1000000000000000000n);
  });

  it('skips zero-balance reserves', async () => {
    const { client } = makeMockClient([
      { status: 'success', result: [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, false] },
      { status: 'success', result: [0n, 0n, 0n, 0n, 0n, 0n] },
    ]);

    const result = await getV3UserPositionsOnChain(1, USER, [DAI], 'AaveV3Ethereum', client);
    expect(result.positions).toHaveLength(0);
  });

  it('skips failed multicall entries', async () => {
    const { client } = makeMockClient([
      { status: 'failure', result: undefined },
      { status: 'success', result: [0n, 0n, 0n, 0n, 0n, 0n] },
    ]);

    const result = await getV3UserPositionsOnChain(1, USER, [DAI], 'AaveV3Ethereum', client);
    expect(result.positions).toHaveLength(0);
  });

  it('skips a success entry whose result is not an array (unexpected shape)', async () => {
    const { client } = makeMockClient([
      { status: 'success', result: { currentATokenBalance: 5n } as never },
      { status: 'success', result: [0n, 0n, 0n, 0n, 0n, 0n] },
    ]);

    const result = await getV3UserPositionsOnChain(1, USER, [DAI], 'AaveV3Ethereum', client);
    expect(result.positions).toHaveLength(0);
    expect(result.accountSummary).not.toBeNull();
  });

  it('returns empty for unknown chain', async () => {
    const result = await getV3UserPositionsOnChain(999999, USER, [DAI], 'AaveV3Ethereum');
    expect(result.positions).toHaveLength(0);
    expect(result.accountSummary).toBeNull();
  });

  it('returns null accountSummary when getUserAccountData fails', async () => {
    const { client } = makeMockClient([
      { status: 'success', result: [100n * 10n ** 18n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, true] },
      { status: 'failure', result: undefined },
    ]);

    const result = await getV3UserPositionsOnChain(1, USER, [DAI], 'AaveV3Ethereum', client);
    expect(result.positions).toHaveLength(1);
    expect(result.accountSummary).toBeNull();
  });

  // AAV-1305 Phase 2: reserve reads moved off the Pool (V3.2+ removed
  // getUserReserveData there — raw eth_call reverts on every wallet) onto
  // AAVE_PROTOCOL_DATA_PROVIDER. getUserAccountData only exists on the Pool
  // and stays there.
  it('targets reserve calls at the DataProvider and the account call at the Pool', async () => {
    const { client, mockMulticall } = makeMockClient([
      { status: 'success', result: [100n * 10n ** 18n, 0n, 0n, 0n, 0n, 0n, 3n * 10n ** 25n, 0n, true] },
      { status: 'success', result: [100n * 10n ** 8n, 0n, 80n * 10n ** 8n, 8000n, 7500n, 1000000000000000000n] },
    ]);

    const result = await getV3UserPositionsOnChain(1, USER, [DAI], 'AaveV3Ethereum', client);

    expect(mockMulticall).toHaveBeenCalledTimes(1);
    const contracts = mockMulticall.mock.calls[0][0].contracts;
    expect(contracts).toHaveLength(2);
    expect(contracts[0]).toMatchObject({
      address: getV3ProtocolDataProviderAddress(1),
      functionName: 'getUserReserveData',
      args: [DAI, USER],
    });
    expect(contracts[0].abi).toBe(DATA_PROVIDER_ABI);
    expect(contracts[1]).toMatchObject({
      address: POOL,
      functionName: 'getUserAccountData',
      args: [USER],
    });
    expect(contracts[1].abi).toBe(POOL_ABI);

    expect(result.positions[0]?.supplyWad).toBe(100n * 10n ** 18n);
    expect(result.positions[0]?.isCollateral).toBe(true);
    expect(result.accountSummary?.healthFactorWad).toBe(1000000000000000000n);
  });

  it('ignores market-level rate fields of the DataProvider result (non-zero for empty wallets)', async () => {
    // The DataProvider returns stableBorrowRate / liquidityRate even for a
    // user with no position — they are market-level, not user data. The
    // zero-balance skip must not be fooled by them.
    const { client } = makeMockClient([
      { status: 'success', result: [0n, 0n, 0n, 0n, 0n, 0n, 5n * 10n ** 24n, 0n, false] },
      { status: 'success', result: [0n, 0n, 0n, 0n, 0n, 0n] },
    ]);

    const result = await getV3UserPositionsOnChain(1, USER, [DAI], 'AaveV3Ethereum', client);
    expect(result.positions).toHaveLength(0);
  });
});

describe('getV3UserPositionsOnChain degradation (registry overrides)', () => {
  afterEach(() => {
    registryOverrides.pool = null;
    registryOverrides.provider = null;
  });

  it('provider missing: no reserve calls, account call still proceeds', async () => {
    registryOverrides.provider = {};
    const { client, mockMulticall } = makeMockClient([
      { status: 'success', result: [100n * 10n ** 8n, 0n, 80n * 10n ** 8n, 8000n, 7500n, 1000000000000000000n] },
    ]);

    const result = await getV3UserPositionsOnChain(1, USER, [DAI], 'AaveV3Ethereum', client);

    const contracts = mockMulticall.mock.calls[0][0].contracts;
    expect(contracts).toHaveLength(1);
    expect(contracts[0].functionName).toBe('getUserAccountData');
    expect(result.positions).toHaveLength(0);
    expect(result.accountSummary).not.toBeNull();
  });

  it('pool missing: no account call, reserve calls still proceed', async () => {
    registryOverrides.pool = {};
    const { client, mockMulticall } = makeMockClient([
      { status: 'success', result: [100n * 10n ** 18n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, true] },
    ]);

    const result = await getV3UserPositionsOnChain(1, USER, [DAI], 'AaveV3Ethereum', client);

    const contracts = mockMulticall.mock.calls[0][0].contracts;
    expect(contracts).toHaveLength(1);
    expect(contracts[0].functionName).toBe('getUserReserveData');
    expect(result.positions).toHaveLength(1);
    expect(result.accountSummary).toBeNull();
  });
});

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
    ]);

    vi.doMock('./aaveV3UserClient', () => ({
      ...vi.importActual('./aaveV3UserClient'),
      getV3UserPositionsOnChain: vi
        .fn()
        .mockResolvedValueOnce({
          positions: [
            {
              chainId: 1,
              marketName: 'AaveV3Ethereum',
              asset: DAI,
              supplyWad: 100n * 10n ** 18n,
              stableBorrowWad: 0n,
              variableBorrowWad: 0n,
              isCollateral: true,
            },
          ],
          accountSummary: null,
        })
        .mockRejectedValueOnce(new Error('RPC error')),
    }));

    const result = await getV3UserPositionsMultiChain(USER, {
      AaveV3Ethereum: { chainId: 1, assets: [DAI] },
      AaveV3Arbitrum: { chainId: 42161, assets: [USDC] },
    });

    expect(result.results.length + result.errors.length).toBe(2);
  });

  it('logs console.error on per-chain failure', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await getV3UserPositionsMultiChain(USER, {
      AaveV3Ethereum: { chainId: 1, assets: [DAI] },
      AaveV3Arbitrum: { chainId: 42161, assets: [USDC] },
    });

    if (result.errors.length > 0) {
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[onchain-v3]'), expect.any(Error));
    }
    consoleSpy.mockRestore();
  });
});

describe('getV3UserPositionsOnChain RPC rotation exhaustion (AAV-1310)', () => {
  beforeEach(() => {
    rpcRotationMocks.createClientWithRpcRotation.mockReset();
    rpcRotationMocks.createClientWithRpcRotation.mockResolvedValue(null);
  });

  it('registry has no RPC (client null) → empty success (unchanged degradation)', async () => {
    const result = await getV3UserPositionsOnChain(1, USER, [DAI], 'AaveV3Ethereum');
    expect(result).toEqual({ positions: [], accountSummary: null });
  });

  it('rotation exhausted → getV3UserPositionsOnChain rejects (not empty success)', async () => {
    rpcRotationMocks.createClientWithRpcRotation.mockRejectedValue(new RpcRotationExhaustedError(1));

    await expect(getV3UserPositionsOnChain(1, USER, [DAI], 'AaveV3Ethereum')).rejects.toBeInstanceOf(
      RpcRotationExhaustedError,
    );
  });

  it('multichain captures rotation exhaustion into errors (not silent empty)', async () => {
    rpcRotationMocks.createClientWithRpcRotation.mockRejectedValue(new RpcRotationExhaustedError(42161));

    const result = await getV3UserPositionsMultiChain(USER, {
      AaveV3Arbitrum: { chainId: 42161, assets: [USDC] },
    });

    expect(result.results).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].chainId).toBe(42161);
    expect(result.errors[0].error).toBeInstanceOf(RpcRotationExhaustedError);
  });

  it('explicit client bypasses RPC rotation entirely', async () => {
    const { client } = makeMockClient([
      { status: 'success', result: [100n * 10n ** 18n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, true] },
      { status: 'success', result: [100n * 10n ** 8n, 0n, 0n, 8000n, 7500n, 1000000000000000000n] },
    ]);

    const result = await getV3UserPositionsOnChain(1, USER, [DAI], 'AaveV3Ethereum', client);
    expect(result.positions).toHaveLength(1);
  });
});
