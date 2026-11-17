// @vitest-environment happy-dom
/**
 * AAV-1399 — `useEModeOverrides` 的编排与降级语义。
 *
 * 外部行为：什么时候发请求、拿到什么 override、失败池是否隔离、刷新是否重取。
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useEModeOverrides } from './useEModeOverrides';
import { bumpRefetch, _resetRefetchListeners } from '@/lib/userData/refetchEvent';
import type { ReserveWithSpread } from '@/types/aave';
import type { PortfolioReserveEntry } from '@/types/portfolio';

const onchainMocks = vi.hoisted(() => ({ fetchOnchainEModeCategoryIds: vi.fn() }));
vi.mock('@/lib/userData/onchainEMode', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/userData/onchainEMode')>();
  return { ...actual, fetchOnchainEModeCategoryIds: onchainMocks.fetchOnchainEModeCategoryIds };
});

const requestMocks = vi.hoisted(() => ({ fetchWithTracing: vi.fn() }));
vi.mock('@/lib/requestContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/requestContext')>();
  return { ...actual, fetchWithTracing: requestMocks.fetchWithTracing };
});

const USER = '0x1111111111111111111111111111111111111111' as const;
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const POOL = '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2';
const MARKET_KEY = `1:${POOL.toLowerCase()}`;

function makeReserve(marketName = 'AaveV3Ethereum', poolAddress = POOL): ReserveWithSpread {
  return {
    reserveId: `1:${poolAddress.toLowerCase()}:${WETH.toLowerCase()}`,
    marketName,
    chainName: 'Ethereum',
    chainId: 1,
    tokenName: 'Wrapped Ether',
    tokenSymbol: 'WETH',
    tokenAddress: WETH,
    ltv: 81,
    liquidationThreshold: 84,
  } as ReserveWithSpread;
}

function makeEntry(reserveId = `1:${POOL.toLowerCase()}:${WETH.toLowerCase()}`): PortfolioReserveEntry {
  return {
    reserveId,
    marketName: 'AaveV3Ethereum',
    chainName: 'Ethereum',
    chainId: 1,
    tokenSymbol: 'WETH',
    supply: { amount: '100000', inputMode: 'usd', walletValue: null },
    borrow: { amount: '', inputMode: 'usd', walletValue: null },
    hidden: false,
    isOrphan: false,
    restrictedStatus: null,
  } as PortfolioReserveEntry;
}

function payload(categoryId = 1, maxLtv = 93, liquidationThreshold = 95) {
  return {
    marketKey: MARKET_KEY,
    chainId: 1,
    chainName: 'Ethereum',
    marketName: 'AaveV3Ethereum',
    categories: [
      {
        id: categoryId,
        label: 'ETH correlated',
        maxLtv,
        liquidationThreshold,
        liquidationPenalty: 1,
        collateralReserves: [WETH.toLowerCase()],
        borrowableReserves: [WETH.toLowerCase()],
      },
    ],
    generatedAt: '2026-11-17T00:00:00.000Z',
  };
}

function okResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as Response;
}

function render(args: {
  address?: `0x${string}`;
  entries?: PortfolioReserveEntry[];
  reserves?: ReserveWithSpread[];
  client?: QueryClient;
}) {
  const queryClient =
    args.client ?? new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const hook = renderHook(
    () =>
      useEModeOverrides({
        address: 'address' in args ? args.address : USER,
        entries: args.entries ?? [makeEntry()],
        reserves: args.reserves ?? [makeReserve()],
      }),
    { wrapper },
  );
  return { ...hook, queryClient };
}

describe('useEModeOverrides (AAV-1399)', () => {
  it('H7: no address → disabled, no onchain/API reads', async () => {
    const { result } = render({ address: undefined });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.eModeOverrides).toBeUndefined();
    expect(onchainMocks.fetchOnchainEModeCategoryIds).not.toHaveBeenCalled();
    expect(requestMocks.fetchWithTracing).not.toHaveBeenCalled();
  });

  it('H1: category 0 → no API request, no overrides', async () => {
    onchainMocks.fetchOnchainEModeCategoryIds.mockResolvedValue(new Map([['1:AaveV3Ethereum', 0]]));
    const { result } = render({});
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.eModeOverrides).toBeUndefined();
    expect(requestMocks.fetchWithTracing).not.toHaveBeenCalled();
  });

  it('H2: category 1 + 503 → base fallback flagged for that pool', async () => {
    onchainMocks.fetchOnchainEModeCategoryIds.mockResolvedValue(new Map([['1:AaveV3Ethereum', 1]]));
    requestMocks.fetchWithTracing.mockResolvedValue({ ok: false, status: 503 } as Response);

    const { result } = render({});
    await waitFor(() => expect(result.current.eModeOverrides?.fallbackPools.has('1:AaveV3Ethereum')).toBe(true));
    expect(result.current.eModeOverrides?.params.size).toBe(0);
  });

  it('H3: 404 → same fallback path', async () => {
    onchainMocks.fetchOnchainEModeCategoryIds.mockResolvedValue(new Map([['1:AaveV3Ethereum', 1]]));
    requestMocks.fetchWithTracing.mockResolvedValue({ ok: false, status: 404 } as Response);

    const { result } = render({});
    await waitFor(() => expect(result.current.eModeOverrides?.fallbackPools.has('1:AaveV3Ethereum')).toBe(true));
  });

  it('H4: network error → same fallback path', async () => {
    onchainMocks.fetchOnchainEModeCategoryIds.mockResolvedValue(new Map([['1:AaveV3Ethereum', 1]]));
    requestMocks.fetchWithTracing.mockRejectedValue(new Error('network down'));

    const { result } = render({});
    await waitFor(() => expect(result.current.eModeOverrides?.fallbackPools.has('1:AaveV3Ethereum')).toBe(true));
  });

  it('H5: payload missing the category id → fallback, not base silently', async () => {
    onchainMocks.fetchOnchainEModeCategoryIds.mockResolvedValue(new Map([['1:AaveV3Ethereum', 2]]));
    requestMocks.fetchWithTracing.mockResolvedValue(okResponse(payload(1)));

    const { result } = render({});
    await waitFor(() => expect(result.current.eModeOverrides?.fallbackPools.has('1:AaveV3Ethereum')).toBe(true));
    expect(result.current.eModeOverrides?.params.size).toBe(0);
  });

  it('H6: a pool whose category read failed stays base; the other pool still gets overrides', async () => {
    const lidoPool = '0x1111111111111111111111111111111111111111';
    const lidoReserve = makeReserve('AaveV3EthereumLido', lidoPool);
    const lidoEntry = makeEntry(`1:${lidoPool}:${WETH.toLowerCase()}`);
    onchainMocks.fetchOnchainEModeCategoryIds.mockResolvedValue(
      new Map([
        ['1:AaveV3Ethereum', 1],
        // lido absent = read failed / unknown
      ]),
    );
    requestMocks.fetchWithTracing.mockResolvedValue(okResponse(payload()));

    const { result } = render({
      entries: [makeEntry(), lidoEntry],
      reserves: [makeReserve(), lidoReserve],
    });

    await waitFor(() => expect(result.current.eModeOverrides?.params.get('1:AaveV3Ethereum')?.maxLtv).toBe(93));
    expect(result.current.eModeOverrides?.params.has('1:AaveV3EthereumLido')).toBe(false);
    expect(result.current.eModeOverrides?.fallbackPools.has('1:AaveV3EthereumLido')).toBe(false);
  });

  it('H8: one pool API failure does not affect another pool', async () => {
    const lidoPool = '0x1111111111111111111111111111111111111111';
    const lidoReserve = makeReserve('AaveV3EthereumLido', lidoPool);
    const lidoEntry = makeEntry(`1:${lidoPool}:${WETH.toLowerCase()}`);
    onchainMocks.fetchOnchainEModeCategoryIds.mockResolvedValue(
      new Map([
        ['1:AaveV3Ethereum', 1],
        ['1:AaveV3EthereumLido', 1],
      ]),
    );
    requestMocks.fetchWithTracing.mockImplementation(async (url: string) => {
      if (url.includes(POOL.toLowerCase())) return okResponse(payload());
      return { ok: false, status: 503 } as Response;
    });

    const { result } = render({
      entries: [makeEntry(), lidoEntry],
      reserves: [makeReserve(), lidoReserve],
    });

    await waitFor(() => expect(result.current.eModeOverrides?.params.get('1:AaveV3Ethereum')?.maxLtv).toBe(93));
    expect(result.current.eModeOverrides?.fallbackPools.has('1:AaveV3EthereumLido')).toBe(true);
    expect(result.current.eModeOverrides?.params.size).toBe(1);
  });

  it('H9: bumpRefetch invalidates the eMode query', async () => {
    onchainMocks.fetchOnchainEModeCategoryIds.mockResolvedValue(new Map([['1:AaveV3Ethereum', 0]]));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    render({ client });
    await waitFor(() =>
      expect(client.getQueryState(['emode-overrides', USER, '1:AaveV3Ethereum|' + MARKET_KEY])).toBeTruthy(),
    );

    bumpRefetch('button');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['emode-overrides', USER] });
    _resetRefetchListeners();
  });
});
