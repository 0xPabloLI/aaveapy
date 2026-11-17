import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AaveV4Ethereum, AaveV4EthereumSentoraCurated } from '@aave-dao/aave-address-book';
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
  unionV4ModuleAddresses,
  type V4ModuleSource,
  type V4ReserveInfo,
} from './aaveV4UserClient';
import { createPublicClient } from 'viem';
import { createRpcClientPool, RpcRotationExhaustedError } from './rpcResilience';
import { MulticallAllCallsFailedError } from './multicallFailure';
import { getAllRpcUrls } from './chainDiscovery';
import { deriveV4ReservesBySpoke } from '@/lib/deriveOnchainConfig';
import { toV4SpokeKey } from '@/lib/reserveKey';
import type { ReserveWithSpread } from '@/types/aave';

vi.mock('./chainDiscovery', () => ({
  getAllRpcUrls: vi.fn().mockReturnValue([]),
}));

const rpcRotationMocks = vi.hoisted(() => ({
  createClientWithRpcRotation: vi.fn(),
  readWithRpcRotation: vi.fn(),
}));

vi.mock('./rpcResilience', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./rpcResilience')>();
  return {
    ...actual,
    createClientWithRpcRotation: rpcRotationMocks.createClientWithRpcRotation,
    readWithRpcRotation: rpcRotationMocks.readWithRpcRotation,
  };
});

vi.mock('viem', () => ({
  createPublicClient: vi.fn(),
  http: vi.fn(() => 'mocked-transport'),
}));

describe('AAV-456 Slice 1: V4 address mapping + ABI types', () => {
  it('V4_SPOKE_ADDRESSES includes Ethereum (1)', () => {
    const chainIds = Object.keys(V4_SPOKE_ADDRESSES).map(Number);
    expect(chainIds).toContain(1);
  });

  it('V4_SPOKE_ADDRESSES[1] contains non-oracle spokes', () => {
    const spokes = V4_SPOKE_ADDRESSES[1];
    expect(spokes.length).toBeGreaterThanOrEqual(10);
    const rawNames = spokes.map((s) => s.rawName);
    expect(rawNames).toContain('MAIN_SPOKE');
    expect(rawNames).toContain('BLUECHIP_SPOKE');
    expect(rawNames).toContain('ETHENA_CORRELATED_SPOKE');
    expect(rawNames).toContain('ETHENA_ECOSYSTEM_SPOKE');
    expect(rawNames).toContain('FOREX_SPOKE');
    expect(rawNames).toContain('GOLD_SPOKE');
    expect(rawNames).toContain('LOMBARD_BTC_SPOKE');
    expect(rawNames).toContain('ETHERFI_ESPOKE');
    expect(rawNames).toContain('KELP_ESPOKE');
    expect(rawNames).toContain('LIDO_ESPOKE');
  });

  it('V4_SPOKE_ADDRESSES[1] excludes oracle spokes', () => {
    const spokes = V4_SPOKE_ADDRESSES[1];
    for (const spoke of spokes) {
      expect(spoke.rawName).not.toMatch(/_ORACLE$/);
      expect(spoke.name).not.toMatch(/_ORACLE$/);
    }
  });

  it('V4_SPOKE_ADDRESSES[1] excludes treasury spoke', () => {
    const spokes = V4_SPOKE_ADDRESSES[1];
    const rawNames = spokes.map((s) => s.rawName);
    expect(rawNames).not.toContain('TREASURY_SPOKE');
  });

  it('each spoke has valid address format', () => {
    for (const chainIdStr of Object.keys(V4_SPOKE_ADDRESSES)) {
      const spokes = V4_SPOKE_ADDRESSES[Number(chainIdStr)];
      for (const spoke of spokes) {
        expect(spoke.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
      }
    }
  });

  // Regression: the address book can ship several modules for one chain — a base
  // module plus curated variants (AaveV4Ethereum and AaveV4EthereumSentoraCurated
  // are both CHAIN_ID 1). Spreading them into one Record<chainId, …> let whichever
  // was enumerated last win, so adding the Sentora module in 4.74.0 silently
  // replaced Ethereum's 27 spokes with its 7 and V4 positions on Ethereum went
  // undiscovered. The base module must win, whatever the enumeration order.
  it('is not shadowed by a curated module for the same chain', () => {
    const rawNames = V4_SPOKE_ADDRESSES[1].map((s) => s.rawName);
    // Spokes that exist only on AaveV4Ethereum, not on the Sentora variant.
    for (const baseOnly of ['MAIN_SPOKE', 'ETHENA_CORRELATED_SPOKE', 'GOLD_SPOKE', 'LIDO_ESPOKE']) {
      expect(rawNames).toContain(baseOnly);
    }
  });

  // AAV-1356 #2/#3: curated modules are unioned, not skipped. The Sentora module
  // deploys RLUSD/OUSD spokes and a second BLUECHIP_SPOKE under the same raw key
  // as the base module. Both entries must survive; only the diagnostic label is
  // disambiguated with the module name.
  it('includes curated-module spokes alongside the base module', () => {
    const spokes = V4_SPOKE_ADDRESSES[1];
    const rawNames = spokes.map((s) => s.rawName);
    expect(rawNames).toContain('RLUSD_YIELD_SPOKE');
    expect(rawNames).toContain('OUSD_YIELD_SPOKE');
    expect(spokes.map(addressKey)).toContain(AaveV4EthereumSentoraCurated.SPOKES.RLUSD_YIELD_SPOKE.toLowerCase());
  });

  // The payload's 17th Ethereum spoke (`Gold Correlated`,
  // 0x115af1c2db26cd8eca3f29055e4e424af4edf616) only exists in AaveV4Ethereum from
  // 4.77.6 onward. Without the bump the union still left it unqueryable.
  it('includes the PAXG_PAXOS_ESPOKE spoke added in 4.77.6', () => {
    expect(V4_SPOKE_ADDRESSES[1].map(addressKey)).toContain(AaveV4Ethereum.SPOKES.PAXG_PAXOS_ESPOKE.toLowerCase());
  });

  it('keeps both same-named BLUECHIP spokes and prefixes only the collision', () => {
    const bluechips = V4_SPOKE_ADDRESSES[1].filter((s) => s.rawName === 'BLUECHIP_SPOKE');
    expect(bluechips).toHaveLength(2);
    expect(bluechips.map((s) => s.name).sort()).toEqual([
      'AaveV4Ethereum:BLUECHIP_SPOKE',
      'AaveV4EthereumSentoraCurated:BLUECHIP_SPOKE',
    ]);
    expect(bluechips.map(addressKey).sort()).toEqual(
      [
        AaveV4Ethereum.SPOKES.BLUECHIP_SPOKE.toLowerCase(),
        AaveV4EthereumSentoraCurated.SPOKES.BLUECHIP_SPOKE.toLowerCase(),
      ].sort(),
    );

    const main = V4_SPOKE_ADDRESSES[1].find((s) => s.rawName === 'MAIN_SPOKE')!;
    expect(main.name).toBe('MAIN_SPOKE');
  });

  // deriveV4ReservesBySpoke (src/lib/deriveOnchainConfig.ts) keys a Map by spoke
  // ADDRESS since AAV-1356, so two spokes sharing a name no longer conflate their
  // reserves. The join relies on address uniqueness; the failure labels rely on
  // diagnostic-label uniqueness.
  it('every spoke diagnostic label is unique within its chain', () => {
    for (const chainIdStr of Object.keys(V4_SPOKE_ADDRESSES)) {
      const names = V4_SPOKE_ADDRESSES[Number(chainIdStr)].map((s) => s.name);
      expect(new Set(names).size, `chain ${chainIdStr}`).toBe(names.length);
    }
  });

  it('every spoke address is unique within its chain', () => {
    for (const chainIdStr of Object.keys(V4_SPOKE_ADDRESSES)) {
      const addresses = V4_SPOKE_ADDRESSES[Number(chainIdStr)].map(addressKey);
      expect(new Set(addresses).size, `chain ${chainIdStr}`).toBe(addresses.length);
    }
  });

  it('V4_HUB_ADDRESSES includes Ethereum (1)', () => {
    const chainIds = Object.keys(V4_HUB_ADDRESSES).map(Number);
    expect(chainIds).toContain(1);
  });

  it('V4_HUB_ADDRESSES[1] (Ethereum) has at least 3 hubs', () => {
    const hubs = V4_HUB_ADDRESSES[1];
    expect(hubs).toBeDefined();
    expect(hubs.length).toBeGreaterThanOrEqual(3);
    const rawNames = hubs.map((h) => h.rawName);
    expect(rawNames).toContain('CORE_HUB');
    expect(rawNames).toContain('PLUS_HUB');
    expect(rawNames).toContain('PRIME_HUB');
  });

  it('unions hubs across modules', () => {
    expect(V4_HUB_ADDRESSES[1].map((h) => h.rawName)).toContain('SENTORA_HUB');
    for (const chainIdStr of Object.keys(V4_HUB_ADDRESSES)) {
      const addresses = V4_HUB_ADDRESSES[Number(chainIdStr)].map(addressKey);
      expect(new Set(addresses).size, `chain ${chainIdStr}`).toBe(addresses.length);
    }
  });

  it('getV4SpokeAddresses returns spokes for known chain, undefined for unknown', () => {
    expect(getV4SpokeAddresses(1)).toBeDefined();
    expect(getV4SpokeAddresses(1)!.length).toBeGreaterThanOrEqual(10);
    expect(getV4SpokeAddresses(137)).toBeUndefined();
  });

  it('getV4HubAddresses returns hubs for known chain, undefined for unknown', () => {
    expect(getV4HubAddresses(1)).toBeDefined();
    expect(getV4HubAddresses(1)!.length).toBeGreaterThanOrEqual(3);
    expect(getV4HubAddresses(42161)).toBeUndefined();
  });

  it('unions modules by address instead of picking one', () => {
    const map = unionV4ModuleAddresses([
      moduleOf('AaveV4EthereumSentoraCurated', { RLUSD_YIELD_SPOKE: address('aa') }),
      moduleOf('AaveV4Ethereum', { MAIN_SPOKE: address('bb'), BLUECHIP_SPOKE: address('cc') }),
    ]);

    expect(
      map
        .get(1)!
        .spokes.map((s) => s.rawName)
        .sort(),
    ).toEqual(['BLUECHIP_SPOKE', 'MAIN_SPOKE', 'RLUSD_YIELD_SPOKE']);
  });

  it('dedupes the same address across modules', () => {
    const map = unionV4ModuleAddresses([
      moduleOf('AaveV4Z', { SHARED: address('aa') }),
      moduleOf('AaveV4A', { SHARED: address('aa'), OTHER: address('bb') }),
    ]);

    const spokes = map.get(1)!.spokes;
    expect(spokes).toHaveLength(2);
    expect(spokes.find((s) => s.rawName === 'SHARED')!.name).toBe('SHARED');
  });

  it('is independent of module enumeration order', () => {
    const a = { name: 'AaveV4A', CHAIN_ID: 1, SPOKES: { ALIAS: address('aa') }, HUBS: {} };
    const z = { name: 'AaveV4Z', CHAIN_ID: 1, SPOKES: { ORIGINAL: address('aa') }, HUBS: {} };

    const forward = unionV4ModuleAddresses([a, z]).get(1)!.spokes;
    const reverse = unionV4ModuleAddresses([z, a]).get(1)!.spokes;

    expect(forward).toEqual(reverse);
    expect(forward.map((s) => s.rawName)).toEqual(['ALIAS']);
  });

  it('filters oracle/treasury spokes and skips malformed addresses', () => {
    const map = unionV4ModuleAddresses([
      {
        name: 'AaveV4A',
        CHAIN_ID: 1,
        SPOKES: {
          MAIN_SPOKE: address('11'),
          MAIN_SPOKE_ORACLE: address('22'),
          TREASURY_SPOKE: address('33'),
          BAD: 'not-an-address',
        },
        HUBS: {},
      },
    ]);

    expect(map.get(1)!.spokes.map((s) => s.rawName)).toEqual(['MAIN_SPOKE']);
  });

  it('returns an empty map for no modules, empty arrays for an empty module, and keeps spokes without hubs', () => {
    expect(unionV4ModuleAddresses([]).size).toBe(0);
    expect(unionV4ModuleAddresses([{ name: 'AaveV4Empty', CHAIN_ID: 1, SPOKES: {}, HUBS: {} }]).get(1)).toEqual({
      spokes: [],
      hubs: [],
    });
    expect(
      unionV4ModuleAddresses([{ name: 'AaveV4NoHubs', CHAIN_ID: 1, SPOKES: { MAIN_SPOKE: address('aa') } }]).get(1),
    ).toEqual({
      spokes: [{ name: 'MAIN_SPOKE', rawName: 'MAIN_SPOKE', address: address('aa') }],
      hubs: [],
    });
  });

  it('keeps the same raw key independent across chains', () => {
    const map = unionV4ModuleAddresses([
      { name: 'AaveV4A', CHAIN_ID: 1, SPOKES: { MAIN_SPOKE: address('11') }, HUBS: {} },
      { name: 'AaveV4B', CHAIN_ID: 2, SPOKES: { MAIN_SPOKE: address('22') }, HUBS: {} },
    ]);

    expect(map.get(1)!.spokes[0].name).toBe('MAIN_SPOKE');
    expect(map.get(2)!.spokes[0].name).toBe('MAIN_SPOKE');
  });

  it('SPOKE_ABI has required view functions', () => {
    const functionNames = SPOKE_ABI.filter((e) => e.type === 'function').map((e: { name: string }) => e.name);
    expect(functionNames).toContain('getUserSuppliedAssets');
    expect(functionNames).toContain('getUserDebt');
    expect(functionNames).toContain('getUserReserveStatus');
    expect(functionNames).toContain('getUserAccountData');
  });

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
    };
    expect(pos.chainId).toBe(1);
    expect(pos.spokeName).toBe('MAIN_SPOKE');
  });

  it('V4AccountSummary type is correct shape', () => {
    const summary: V4AccountSummary = {
      chainId: 1,
      spokeName: 'MAIN_SPOKE',
      spokeAddress: MAIN_SPOKE.address,
      healthFactor: 2000000000000000000n,
      totalCollateralValue: 1000000000000000000n,
      totalDebtValueRay: 500000000000000000n,
    };
    expect(summary.chainId).toBe(1);
    expect(summary.healthFactor).toBeGreaterThan(0n);
  });

  it('V4OnchainResult and V4OnchainResponse types are correct', () => {
    const result: V4OnchainResult = { positions: [], accountSummaries: [] };
    expect(result.positions).toEqual([]);
    const response: V4OnchainResponse = { results: [], errors: [] };
    expect(response.errors).toEqual([]);
  });
});

function makeMockClient(multicallResult: unknown[]) {
  const mockMulticall = vi.fn().mockResolvedValue(multicallResult);
  const client = {
    multicall: mockMulticall,
  } as unknown as Parameters<typeof getV4UserPositionsOnChain>[5];
  return { client, mockMulticall };
}

const USER = '0x1111111111111111111111111111111111111111' as `0x${string}`;
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' as `0x${string}`;
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as `0x${string}`;
const MAIN_SPOKE = getV4SpokeAddresses(1)!.find((s) => s.name === 'MAIN_SPOKE')!;

/** The join key `deriveV4ReservesBySpoke` produces and this module looks up (AAV-1356). */
const addressKey = (entry: { address: string }) => entry.address.toLowerCase();

/** Synthetic address-book entries for the pure union tests. */
const address = (byte: string) => `0x${byte.repeat(20)}` as `0x${string}`;
const moduleOf = (
  name: string,
  spokes: Record<string, string>,
  hubs: Record<string, string> = {},
  chainId = 1,
): V4ModuleSource => ({ name, CHAIN_ID: chainId, SPOKES: spokes, HUBS: hubs });

/** The API's display form of an address-book raw key: `MAIN_SPOKE` -> `Main`. */
const displayNameOf = (rawKey: string) =>
  rawKey
    .replace(/_SPOKE$|_ESPOKE$/, '')
    .split('_')
    .map((word) => word[0] + word.slice(1).toLowerCase())
    .join(' ');

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
    ]);

    const reserves: V4ReserveInfo[] = [
      { reserveId: 0n, asset: WETH },
      { reserveId: 1n, asset: USDC },
    ];

    const result = await getV4UserPositionsOnChain(1, 'MAIN_SPOKE', MAIN_SPOKE.address, USER, reserves, client);

    expect(result.positions).toHaveLength(1);
    expect(result.positions[0]).toEqual({
      chainId: 1,
      spokeName: 'MAIN_SPOKE',
      reserveId: 0n,
      asset: WETH,
      suppliedAssets: 1000n * 10n ** 18n,
      stableDebt: 0n,
      variableDebt: 500n * 10n ** 18n,
      isCollateral: true,
    });
    expect(result.accountSummaries).toHaveLength(1);
    expect(result.accountSummaries[0].healthFactor).toBe(1000000000000000000n);
  });

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
    ]);

    const result = await getV4UserPositionsOnChain(
      1,
      'MAIN_SPOKE',
      MAIN_SPOKE.address,
      USER,
      [{ reserveId: 0n, asset: WETH }],
      client,
    );
    expect(result.positions).toHaveLength(0);
  });

  it('skips failed multicall entries', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { client } = makeMockClient([
      { status: 'failure', result: undefined },
      { status: 'failure', result: undefined },
      { status: 'failure', result: undefined },
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
    ]);

    const result = await getV4UserPositionsOnChain(
      1,
      'MAIN_SPOKE',
      MAIN_SPOKE.address,
      USER,
      [
        { reserveId: 0n, asset: WETH },
        { reserveId: 1n, asset: USDC },
      ],
      client,
    );
    expect(result.positions).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('1/2 reserves had failed reads'));
    warnSpy.mockRestore();
  });

  it('returns empty positions when no client available', async () => {
    const result = await getV4UserPositionsOnChain(999999, 'MAIN_SPOKE', MAIN_SPOKE.address, USER, [
      { reserveId: 0n, asset: WETH },
    ]);
    expect(result.positions).toHaveLength(0);
    expect(result.accountSummaries).toHaveLength(0);
  });

  it('returns empty accountSummaries when getUserAccountData fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { client } = makeMockClient([
      { status: 'success', result: 100n * 10n ** 18n },
      { status: 'success', result: [0n, 0n] },
      { status: 'success', result: [true, false] },
      { status: 'failure', result: undefined },
    ]);

    const result = await getV4UserPositionsOnChain(
      1,
      'MAIN_SPOKE',
      MAIN_SPOKE.address,
      USER,
      [{ reserveId: 0n, asset: WETH }],
      client,
    );
    expect(result.positions).toHaveLength(1);
    expect(result.accountSummaries).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('account-level read failed'));
    warnSpy.mockRestore();
  });

  it('handles partial multicall failures (some reserves succeed, some fail)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
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
    ]);

    const reserves: V4ReserveInfo[] = [
      { reserveId: 0n, asset: WETH },
      { reserveId: 1n, asset: USDC },
    ];

    const result = await getV4UserPositionsOnChain(1, 'MAIN_SPOKE', MAIN_SPOKE.address, USER, reserves, client);
    expect(result.positions).toHaveLength(1);
    expect(result.positions[0].asset).toBe(WETH);
    expect(result.accountSummaries).toHaveLength(1);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('1/2 reserves had failed reads'));
    warnSpy.mockRestore();
  });
});

describe('getV4UserPositionsOnChain multicall failure semantics (AAV-1314)', () => {
  const FAILED_READ = { status: 'failure', result: undefined } as const;
  const ACCOUNT_OK = {
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
  } as const;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    rpcRotationMocks.createClientWithRpcRotation.mockReset();
    rpcRotationMocks.readWithRpcRotation.mockReset();
  });

  it('rejects when every reserve read fails (even if the account call succeeds)', async () => {
    const { client } = makeMockClient([FAILED_READ, FAILED_READ, FAILED_READ, ACCOUNT_OK]);

    await expect(
      getV4UserPositionsOnChain(1, 'MAIN_SPOKE', MAIN_SPOKE.address, USER, [{ reserveId: 0n, asset: WETH }], client),
    ).rejects.toBeInstanceOf(MulticallAllCallsFailedError);
  });

  it('reports chain, spoke and attempted call count on the thrown error', async () => {
    const { client } = makeMockClient([FAILED_READ, FAILED_READ, FAILED_READ, ACCOUNT_OK]);

    await expect(
      getV4UserPositionsOnChain(1, 'MAIN_SPOKE', MAIN_SPOKE.address, USER, [{ reserveId: 0n, asset: WETH }], client),
    ).rejects.toMatchObject({ chainId: 1, scope: 'MAIN_SPOKE', attemptedCalls: 3 });
  });

  it('keeps successful positions and warns on a partial failure', async () => {
    const { client } = makeMockClient([
      { status: 'success', result: 100n * 10n ** 18n },
      { status: 'success', result: [0n, 0n] },
      { status: 'success', result: [true, false] },
      FAILED_READ,
      FAILED_READ,
      FAILED_READ,
      ACCOUNT_OK,
    ]);

    const result = await getV4UserPositionsOnChain(
      1,
      'MAIN_SPOKE',
      MAIN_SPOKE.address,
      USER,
      [
        { reserveId: 0n, asset: WETH },
        { reserveId: 1n, asset: USDC },
      ],
      client,
    );

    expect(result.positions).toHaveLength(1);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('1/2 reserves had failed reads'));
  });

  it('does not count a reserve with only 2 of 3 successful calls as read', async () => {
    const { client } = makeMockClient([
      { status: 'success', result: 100n * 10n ** 18n },
      FAILED_READ, // debt read fails
      { status: 'success', result: [true, false] },
      { status: 'success', result: 1n },
      { status: 'success', result: [0n, 0n] },
      { status: 'success', result: [true, false] },
      ACCOUNT_OK,
    ]);

    const result = await getV4UserPositionsOnChain(
      1,
      'MAIN_SPOKE',
      MAIN_SPOKE.address,
      USER,
      [
        { reserveId: 0n, asset: WETH },
        { reserveId: 1n, asset: USDC },
      ],
      client,
    );

    expect(result.positions).toHaveLength(1);
    expect(result.positions[0].reserveId).toBe(1n);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('1/2 reserves had failed reads'));
  });

  it('does not warn when every read succeeds with zero balances', async () => {
    const { client } = makeMockClient([
      { status: 'success', result: 0n },
      { status: 'success', result: [0n, 0n] },
      { status: 'success', result: [false, false] },
      ACCOUNT_OK,
    ]);

    const result = await getV4UserPositionsOnChain(
      1,
      'MAIN_SPOKE',
      MAIN_SPOKE.address,
      USER,
      [{ reserveId: 0n, asset: WETH }],
      client,
    );

    expect(result.positions).toHaveLength(0);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('does not throw when there are no reserves to read', async () => {
    const { client } = makeMockClient([ACCOUNT_OK]);

    const result = await getV4UserPositionsOnChain(1, 'MAIN_SPOKE', MAIN_SPOKE.address, USER, [], client);

    expect(result.accountSummaries).toHaveLength(1);
  });

  it('warns but does not throw when only the account call fails', async () => {
    const { client } = makeMockClient([
      { status: 'success', result: 100n * 10n ** 18n },
      { status: 'success', result: [0n, 0n] },
      { status: 'success', result: [true, false] },
      FAILED_READ,
    ]);

    const result = await getV4UserPositionsOnChain(
      1,
      'MAIN_SPOKE',
      MAIN_SPOKE.address,
      USER,
      [{ reserveId: 0n, asset: WETH }],
      client,
    );

    expect(result.positions).toHaveLength(1);
    expect(result.accountSummaries).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('account-level read failed'));
  });

  // User-approved adjacent fix (2026-11-16, option B): 0n supply is a valid
  // balance, not a failed read. A borrow-only reserve must yield a position.
  it('returns a borrow-only reserve (zero supply, non-zero debt)', async () => {
    const { client } = makeMockClient([
      { status: 'success', result: 0n },
      { status: 'success', result: [0n, 500n * 10n ** 18n] },
      { status: 'success', result: [false, true] },
      ACCOUNT_OK,
    ]);

    const result = await getV4UserPositionsOnChain(
      1,
      'MAIN_SPOKE',
      MAIN_SPOKE.address,
      USER,
      [{ reserveId: 7n, asset: USDC }],
      client,
    );

    expect(result.positions).toHaveLength(1);
    expect(result.positions[0]).toMatchObject({
      reserveId: 7n,
      asset: USDC,
      suppliedAssets: 0n,
      stableDebt: 0n,
      variableDebt: 500n * 10n ** 18n,
    });
  });

  it('bubbles a multicall rejection unchanged', async () => {
    const rpcError = new Error('rpc down');
    const client = {
      multicall: vi.fn().mockRejectedValue(rpcError),
    } as unknown as Parameters<typeof getV4UserPositionsOnChain>[5];

    await expect(
      getV4UserPositionsOnChain(1, 'MAIN_SPOKE', MAIN_SPOKE.address, USER, [{ reserveId: 0n, asset: WETH }], client),
    ).rejects.toBe(rpcError);
  });

  it('allSpokes records the failing spoke and keeps the healthy one', async () => {
    const [good, bad] = getV4SpokeAddresses(1)!;
    const reserves = [{ reserveId: 0n, asset: WETH }];
    const client = {
      multicall: vi.fn(async ({ contracts }: { contracts: { address: string; functionName: string }[] }) => {
        if (contracts[0].address.toLowerCase() === bad.address.toLowerCase()) {
          return contracts.map(() => ({ status: 'failure' as const, result: undefined }));
        }
        return contracts.map((call) => {
          switch (call.functionName) {
            case 'getUserSuppliedAssets':
              return { status: 'success' as const, result: 1n };
            case 'getUserDebt':
              return { status: 'success' as const, result: [0n, 0n] };
            case 'getUserReserveStatus':
              return { status: 'success' as const, result: [true, false] };
            default:
              return {
                status: 'success' as const,
                result: {
                  riskPremium: 0n,
                  avgCollateralFactor: 0n,
                  healthFactor: 1n,
                  totalCollateralValue: 1n,
                  totalDebtValueRay: 0n,
                  activeCollateralCount: 1n,
                  borrowCount: 0n,
                },
              };
          }
        });
      }),
    } as unknown as Parameters<typeof getV4UserPositionsAllSpokes>[3];

    const result = await getV4UserPositionsAllSpokes(
      1,
      USER,
      {
        [toV4SpokeKey(good.address)!]: reserves,
        [toV4SpokeKey(bad.address)!]: reserves,
      },
      client,
    );

    expect(result.results).toHaveLength(1);
    expect(result.results[0].positions).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].spokeName).toBe(bad.name);
    expect(result.errors[0].error).toBeInstanceOf(MulticallAllCallsFailedError);
  });
});

describe('AAV-456 Slice 3: getV4UserPositionsAllSpokes', () => {
  it('returns empty for unknown chain', async () => {
    const result = await getV4UserPositionsAllSpokes(999999, USER, {});
    expect(result.results).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('filters spokes with no reserves', async () => {
    const result = await getV4UserPositionsAllSpokes(1, USER, {
      [addressKey(MAIN_SPOKE)]: [{ reserveId: 0n, asset: WETH }],
    });
    expect(result.results.length + result.errors.length).toBe(1);
  });

  it('skips spokes not in reservesBySpoke', async () => {
    const result = await getV4UserPositionsAllSpokes(1, USER, {});
    expect(result.results).toHaveLength(0);
  });

  // AAV-1356 regression gate: this module looks spokes up by address, so a map keyed by
  // name — the API's display name or the address book's raw key — matches nothing and
  // the V4 on-chain fallback silently queries zero spokes on every chain.
  it('finds no spokes when the map is keyed by name instead of address', async () => {
    const result = await getV4UserPositionsAllSpokes(1, USER, {
      MAIN_SPOKE: [{ reserveId: 0n, asset: WETH }],
      Main: [{ reserveId: 0n, asset: WETH }],
    });
    expect(result.results).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('queries every address-book spoke that has reserves', async () => {
    const spokes = getV4SpokeAddresses(1)!;
    const reservesBySpoke = Object.fromEntries(spokes.map((s) => [addressKey(s), [{ reserveId: 0n, asset: WETH }]]));

    const result = await getV4UserPositionsAllSpokes(1, USER, reservesBySpoke);

    expect(result.results).toHaveLength(spokes.length);
  });

  // The invariant that ties the two modules together: whatever key the producer emits
  // must be the key this consumer looks up, for every spoke of every chain.
  it('every address-book spoke is reachable by the key deriveV4ReservesBySpoke produces', () => {
    const token = `0x${'ab'.repeat(20)}`;

    for (const chainIdStr of Object.keys(V4_SPOKE_ADDRESSES)) {
      const chainId = Number(chainIdStr);
      const spokes = V4_SPOKE_ADDRESSES[chainId];
      // Reserves shaped like the real payload: `spokeName` is a display name and the
      // spoke address appears only inside reserveId.
      const reserves = spokes.map(
        (s, i) =>
          ({
            reserveId: `${chainId}:${addressKey(s)}:${token}:0xhub`,
            marketName: `AaveV4Chain${chainId}`,
            chainName: 'Test',
            chainId,
            tokenName: 'Token',
            tokenSymbol: 'TKN',
            tokenAddress: token,
            spokeName: displayNameOf(s.rawName),
            aaveProReserveId: Buffer.from(`${i + 1}::${token}`).toString('base64'),
          }) as ReserveWithSpread,
      );

      const reservesBySpoke = deriveV4ReservesBySpoke(reserves);
      const unreachable = spokes.filter((s) => {
        const key = toV4SpokeKey(s.address);
        return !key || (reservesBySpoke[key] ?? []).length === 0;
      });

      expect(
        unreachable.map((s) => s.name),
        `chain ${chainId}`,
      ).toEqual([]);
    }
  });

  // AAV-1356 #2: two modules can name different spokes the same. Both are queried,
  // and each result is attributed to its own address-book entry (not merged by name).
  it('queries both same-named spokes under different modules', async () => {
    const bluechips = V4_SPOKE_ADDRESSES[1].filter((s) => s.rawName === 'BLUECHIP_SPOKE');
    expect(bluechips).toHaveLength(2);

    const { client, mockMulticall } = makeMockClient([
      { status: 'success', result: 1n },
      { status: 'success', result: [0n, 0n] },
      { status: 'success', result: [true, false] },
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
    ]);

    const result = await getV4UserPositionsAllSpokes(
      1,
      USER,
      Object.fromEntries(bluechips.map((s) => [toV4SpokeKey(s.address)!, [{ reserveId: 0n, asset: WETH }]])),
      client,
    );

    expect(mockMulticall).toHaveBeenCalledTimes(2);
    expect(result.results).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
    expect(result.results.flatMap((r) => r.positions.map((p) => p.spokeName)).sort()).toEqual(
      bluechips.map((s) => s.name).sort(),
    );
  });

  it('attributes a same-named spoke failure to its module-prefixed label', async () => {
    const bluechips = V4_SPOKE_ADDRESSES[1].filter((s) => s.rawName === 'BLUECHIP_SPOKE');
    expect(bluechips).toHaveLength(2);
    const base = bluechips.find((s) => s.name === 'AaveV4Ethereum:BLUECHIP_SPOKE')!;
    const curated = bluechips.find((s) => s.name === 'AaveV4EthereumSentoraCurated:BLUECHIP_SPOKE')!;
    expect(base.address.toLowerCase()).not.toBe(curated.address.toLowerCase());

    const success = [
      { status: 'success', result: 1n },
      { status: 'success', result: [0n, 0n] },
      { status: 'success', result: [true, false] },
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
    ];
    const failed = [
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
    ];

    const { client, mockMulticall } = makeMockClient([]);
    mockMulticall.mockImplementation((args: { contracts: { address: string }[] }) =>
      Promise.resolve(args.contracts[0].address.toLowerCase() === base.address.toLowerCase() ? success : failed),
    );

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const result = await getV4UserPositionsAllSpokes(
        1,
        USER,
        Object.fromEntries(bluechips.map((s) => [toV4SpokeKey(s.address)!, [{ reserveId: 0n, asset: WETH }]])),
        client,
      );

      // The healthy sibling keeps its position; the failed one is labelled with its
      // own module prefix, so the address is identifiable from failedSources.
      expect(result.results).toHaveLength(1);
      expect(result.results[0].positions[0].spokeName).toBe(base.name);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].spokeName).toBe(curated.name);
      expect(result.errors[0].error).toBeInstanceOf(MulticallAllCallsFailedError);
    } finally {
      errorSpy.mockRestore();
    }
  });
});

describe('getV4UserPositionsOnChain RPC rotation exhaustion (AAV-1310)', () => {
  beforeEach(() => {
    rpcRotationMocks.readWithRpcRotation.mockReset();
    rpcRotationMocks.readWithRpcRotation.mockResolvedValue(null);
  });

  it('registry has no RPC (rotation returns null) → empty success (unchanged degradation)', async () => {
    const result = await getV4UserPositionsOnChain(1, 'MAIN_SPOKE', MAIN_SPOKE.address, USER, []);
    expect(result).toEqual({ positions: [], accountSummaries: [] });
  });

  it('rotation exhausted → getV4UserPositionsOnChain rejects (not empty success)', async () => {
    rpcRotationMocks.readWithRpcRotation.mockRejectedValue(new RpcRotationExhaustedError(1));

    await expect(getV4UserPositionsOnChain(1, 'MAIN_SPOKE', MAIN_SPOKE.address, USER, [])).rejects.toBeInstanceOf(
      RpcRotationExhaustedError,
    );
  });

  it('allSpokes captures rotation exhaustion into errors (not silent empty)', async () => {
    rpcRotationMocks.readWithRpcRotation.mockRejectedValue(new RpcRotationExhaustedError(1));

    const result = await getV4UserPositionsAllSpokes(1, USER, {
      [addressKey(MAIN_SPOKE)]: [{ reserveId: 0n, asset: WETH }],
    });

    expect(result.results).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].chainId).toBe(1);
    expect(result.errors[0].spokeName).toBe('MAIN_SPOKE');
    expect(result.errors[0].error).toBeInstanceOf(RpcRotationExhaustedError);
  });
});

describe('getV4UserPositionsOnChain read rotation wiring (AAV-1387)', () => {
  const FAILED_READ = { status: 'failure', result: undefined } as const;
  const SUPPLIED = { status: 'success', result: 100n * 10n ** 18n } as const;
  const DEBT = { status: 'success', result: [0n, 0n] } as const;
  const STATUS = { status: 'success', result: [true, false] } as const;
  const ACCOUNT_OK = {
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
  } as const;

  type AttemptFn = (client: unknown) => Promise<{ value: unknown; allCallsFailed: boolean }>;

  /** Routes the mocked rotation through `client` and captures the caller's flag. */
  function captureAttempt(client: unknown): { allCallsFailed?: boolean } {
    const captured: { allCallsFailed?: boolean } = {};
    rpcRotationMocks.readWithRpcRotation.mockImplementation(async (_chainId: number, attempt: AttemptFn) => {
      const outcome = await attempt(client);
      captured.allCallsFailed = outcome.allCallsFailed;
      return outcome.value;
    });
    return captured;
  }

  const reserves: V4ReserveInfo[] = [{ reserveId: 0n, asset: WETH }];

  beforeEach(() => {
    rpcRotationMocks.readWithRpcRotation.mockReset();
  });

  afterEach(() => {
    rpcRotationMocks.readWithRpcRotation.mockReset();
  });

  it('V4-R1 flags an all-failed spoke so rotation moves to the next RPC', async () => {
    const { client } = makeMockClient([FAILED_READ, FAILED_READ, FAILED_READ, ACCOUNT_OK]);
    const captured = captureAttempt(client);

    await expect(getV4UserPositionsOnChain(1, 'MAIN_SPOKE', MAIN_SPOKE.address, USER, reserves)).rejects.toBeInstanceOf(
      MulticallAllCallsFailedError,
    );

    expect(rpcRotationMocks.readWithRpcRotation).toHaveBeenCalledWith(1, expect.any(Function));
    expect(captured.allCallsFailed).toBe(true);
  });

  it('V4-R2 flags a readable spoke as readable (no rotation)', async () => {
    const { client } = makeMockClient([SUPPLIED, DEBT, STATUS, ACCOUNT_OK]);
    const captured = captureAttempt(client);

    const result = await getV4UserPositionsOnChain(1, 'MAIN_SPOKE', MAIN_SPOKE.address, USER, reserves);

    expect(result.positions).toHaveLength(1);
    expect(captured.allCallsFailed).toBe(false);
  });

  it('V4-R3 keeps the empty-success degradation when rotation yields null', async () => {
    rpcRotationMocks.readWithRpcRotation.mockResolvedValue(null);

    await expect(getV4UserPositionsOnChain(1, 'MAIN_SPOKE', MAIN_SPOKE.address, USER, reserves)).resolves.toEqual({
      positions: [],
      accountSummaries: [],
    });
  });

  it('V4-R4 reads an injected client without consulting rotation', async () => {
    const { client } = makeMockClient([SUPPLIED, DEBT, STATUS, ACCOUNT_OK]);

    const result = await getV4UserPositionsOnChain(1, 'MAIN_SPOKE', MAIN_SPOKE.address, USER, reserves, client);

    expect(result.positions).toHaveLength(1);
    expect(rpcRotationMocks.readWithRpcRotation).not.toHaveBeenCalled();
  });

  // M14: rotation is per spoke. One spoke rotating off a bad RPC must not
  // disturb its sibling, which reads through its own batch and client.
  it('V4-R5 rotates only the all-failed spoke and keeps its sibling', async () => {
    const [good, bad] = getV4SpokeAddresses(1)!;
    const client = {
      multicall: vi.fn(async ({ contracts }: { contracts: { address: string; functionName: string }[] }) => {
        if (contracts[0].address.toLowerCase() === bad.address.toLowerCase()) {
          return contracts.map(() => FAILED_READ);
        }
        return contracts.map((call) => {
          switch (call.functionName) {
            case 'getUserSuppliedAssets':
              return SUPPLIED;
            case 'getUserDebt':
              return DEBT;
            case 'getUserReserveStatus':
              return STATUS;
            default:
              return ACCOUNT_OK;
          }
        });
      }),
    };
    rpcRotationMocks.readWithRpcRotation.mockImplementation(async (_chainId: number, attempt: AttemptFn) => {
      const outcome = await attempt(client);
      return outcome.value;
    });

    const result = await getV4UserPositionsAllSpokes(1, USER, {
      [toV4SpokeKey(good.address)!]: reserves,
      [toV4SpokeKey(bad.address)!]: reserves,
    });

    expect(rpcRotationMocks.readWithRpcRotation).toHaveBeenCalledTimes(2);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].positions).toHaveLength(1);
    expect(result.results[0].positions[0].reserveId).toBe(0n);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].spokeName).toBe(bad.name);
    expect(result.errors[0].error).toBeInstanceOf(MulticallAllCallsFailedError);
  });
});

describe('getV4UserPositionsAllSpokes shared RPC session (AAV-1313)', () => {
  beforeEach(() => {
    rpcRotationMocks.readWithRpcRotation.mockReset();
    rpcRotationMocks.readWithRpcRotation.mockResolvedValue(null);
  });

  it('passes one read session to every spoke of the chain', async () => {
    const spokes = getV4SpokeAddresses(1)!;
    const [first, second] = spokes;
    const reserves: V4ReserveInfo[] = [{ reserveId: 0n, asset: WETH }];
    const pool = createRpcClientPool();

    await getV4UserPositionsAllSpokes(
      1,
      USER,
      {
        [toV4SpokeKey(first.address)!]: reserves,
        [toV4SpokeKey(second.address)!]: reserves,
      },
      undefined,
      pool,
    );

    expect(rpcRotationMocks.readWithRpcRotation).toHaveBeenCalledTimes(2);
    for (const call of rpcRotationMocks.readWithRpcRotation.mock.calls) {
      expect(call[0]).toBe(1);
      expect(call[2]).toBe(pool);
    }
  });

  it('creates one session per chain call when none is injected', async () => {
    const [first, second] = getV4SpokeAddresses(1)!;
    const reserves: V4ReserveInfo[] = [{ reserveId: 0n, asset: WETH }];

    await getV4UserPositionsAllSpokes(1, USER, {
      [toV4SpokeKey(first.address)!]: reserves,
      [toV4SpokeKey(second.address)!]: reserves,
    });

    const calls = rpcRotationMocks.readWithRpcRotation.mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0][2]).toBeDefined();
    expect(calls[0][2]).toBe(calls[1][2]);
  });
});
