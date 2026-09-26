/**
 * On-chain user positions integration test（真实 RPC + staging API，手动运行）
 *
 * 验证 ABI 路径（链上 multicall）读出的仓位与 staging /markets 储备目录一致：
 * 每个仓位都解析到已知 reserve（orphan 会被静默降级为 $0）、金额有限且为正、
 * 单路径内无重复 (chain, asset, side)、V3 仓位落在请求市场的链上、链级 error
 * 必须为空，V3+V4 合并转 portfolio 后无重复 reserveId。
 *
 * 历史（AAV-1309）：本文件曾自标 "SDK vs ABI Consistency (HITL)"，但 SDK 侧是
 * 硬编码空数组，comparePositions 的 diff 全部是 missing-in-sdk 且被断言过滤
 * （断言恒真），默认 API base（aave-api-v2.onrender.com）也已 404。用户裁定本
 * 测试不需要 HITL：SDK-vs-ABI 对比脚手架移除；SDK 路径由 useUserPositionsSdk
 * 单测（mock）+ E2E 覆盖，本文件专注 onchain 路径与储备目录的一致性。
 *
 * 已知局限（AAV-1310）：RPC 轮换耗尽当前会静默返回空仓位而非 error，此场景下
 * 本测试会空跑通过；AAV-1310 修复后 errors 断言才会对「全链失败」红灯。
 * 金额量级断言待 AAV-1311（非 18-dec 代币缩放缺陷）修复后补充。
 *
 * 运行方式（无 WALLET_ADDRESS 时全部 skip，不进 CI 默认路径）：
 *   WALLET_ADDRESS=0x... npx vitest run src/test/userPositionConsistency.test.ts
 *
 * API base：LIVE_TEST_API_BASE（vitest live 测试约定，docs/conventions/api-base-urls.md），
 * 缺省 staging。复用 apiSchemas.live.helpers 的 resolveLiveApiBase——不用
 * VITE_API_BASE_URL（会被前端 .env 的 localhost 值污染，ECONNREFUSED 实测踩坑）。
 * 需要 PUBLIC_RPC_URLS 中对应链的 RPC endpoint 可用。
 */
import { describe, expect, it } from 'vitest';
import { getV3UserPositionsMultiChain } from '@/lib/userData/aaveV3UserClient';
import { getV4UserPositionsAllSpokes } from '@/lib/userData/aaveV4UserClient';
import {
  convertV3PositionsToWalletPositions,
  convertV4PositionsToWalletPositions,
  buildReserveLookupByChainAndToken,
} from '@/lib/userData/onchainPositionConverter';
import { deriveV3AssetsByMarket, deriveV4ReservesBySpoke } from '@/lib/deriveOnchainConfig';
import { convertWalletPositionsToEntries } from '@/lib/walletPositionToPortfolio';
import { resolveLiveApiBase } from '@/lib/apiSchemas.live.helpers';
import type { ReserveWithSpread } from '@/types/aave';
import type { WalletPosition } from '@/lib/userData/userPositionMapper';

const WALLET = process.env.WALLET_ADDRESS as `0x${string}` | undefined;
// vitest live 测试约定解析（LIVE_TEST_API_BASE → staging 默认）；旧 onrender 默认已 404（AAV-1309）。
const API_BASE = resolveLiveApiBase();

function skipIfNoWallet() {
  return !WALLET || !WALLET.startsWith('0x');
}

async function fetchReserves(): Promise<ReserveWithSpread[]> {
  const res = await fetch(`${API_BASE}/markets`);
  if (!res.ok) throw new Error(`API /markets returned ${res.status} (base: ${API_BASE})`);
  const json = await res.json();
  return json.reserves ?? json;
}

// ─── 共享断言（真实不变量；取代旧 SDK 侧硬编码空数组造成的恒真断言） ───

function assertAllResolvable(positions: WalletPosition[], label: string) {
  const orphanKeys = positions.filter((p) => p.isOrphan).map((p) => `${p.chainId}:${p.asset}`);
  expect(
    orphanKeys,
    `${label}: every on-chain position must resolve in /markets lookup ` +
      `(orphan positions are silently shown as $0)`,
  ).toEqual([]);
}

function assertAmountsPositiveAndFinite(positions: WalletPosition[], label: string) {
  const bad = positions
    .filter((p) => !Number.isFinite(p.amountUsd) || p.amountUsd <= 0)
    .map((p) => `${p.reserveId}:${p.side}=${p.amountUsd}`);
  expect(bad, `${label}: position amounts must be finite and > 0`).toEqual([]);
}

function assertNoDuplicateEntries(positions: WalletPosition[], label: string) {
  const keys = positions.map((p) => `${p.chainId}:${p.asset}:${p.side}`);
  expect(new Set(keys).size, `${label}: duplicate (chain, asset, side) entries indicate double-fetch`).toBe(
    keys.length,
  );
}

function assertNoChainErrors(errors: { chainId?: number; spokeName?: string | null }[], label: string) {
  expect(
    errors.map((e) => `${e.chainId ?? '?'}:${e.spokeName ?? ''}`),
    `${label}: chain-level errors must fail loudly, not degrade silently`,
  ).toEqual([]);
}

describe('On-chain user positions integration (live RPC + staging API)', () => {
  it('V3 Ethereum: positions resolve against /markets and stay chain-scoped', async () => {
    if (skipIfNoWallet()) return;
    const reserves = await fetchReserves();
    const lookupMap = buildReserveLookupByChainAndToken(reserves);
    const v3AssetsByMarket = deriveV3AssetsByMarket(reserves);
    const ethMarket = Object.entries(v3AssetsByMarket).find(([, v]) => v.chainId === 1);
    if (!ethMarket) {
      throw new Error('staging /markets has no Ethereum V3 market — failing loudly instead of silently passing');
    }

    const v3Response = await getV3UserPositionsMultiChain(WALLET!, { [ethMarket[0]]: ethMarket[1] });
    assertNoChainErrors(v3Response.errors, 'V3 ETH');

    const positions = convertV3PositionsToWalletPositions(
      v3Response.results.flatMap((r) => r.positions),
      lookupMap,
      'onchain-v3',
    );

    assertAllResolvable(positions, 'V3 ETH');
    assertAmountsPositiveAndFinite(positions, 'V3 ETH');
    assertNoDuplicateEntries(positions, 'V3 ETH');
    const offChain = positions.filter((p) => p.chainId !== ethMarket[1].chainId);
    expect(
      offChain.map((p) => `${p.chainId}:${p.asset}`),
      'V3 ETH: positions must stay within the requested market chain',
    ).toEqual([]);
  }, 60_000);

  it('V3 Optimism: positions resolve against /markets and stay chain-scoped', async () => {
    if (skipIfNoWallet()) return;
    const reserves = await fetchReserves();
    const lookupMap = buildReserveLookupByChainAndToken(reserves);
    const v3AssetsByMarket = deriveV3AssetsByMarket(reserves);
    const opMarket = Object.entries(v3AssetsByMarket).find(([, v]) => v.chainId === 10);
    if (!opMarket) {
      throw new Error('staging /markets has no Optimism V3 market — failing loudly instead of silently passing');
    }

    const v3Response = await getV3UserPositionsMultiChain(WALLET!, { [opMarket[0]]: opMarket[1] });
    assertNoChainErrors(v3Response.errors, 'V3 OP');

    const positions = convertV3PositionsToWalletPositions(
      v3Response.results.flatMap((r) => r.positions),
      lookupMap,
      'onchain-v3',
    );

    assertAllResolvable(positions, 'V3 OP');
    assertAmountsPositiveAndFinite(positions, 'V3 OP');
    assertNoDuplicateEntries(positions, 'V3 OP');
    const offChain = positions.filter((p) => p.chainId !== opMarket[1].chainId);
    expect(
      offChain.map((p) => `${p.chainId}:${p.asset}`),
      'V3 OP: positions must stay within the requested market chain',
    ).toEqual([]);
  }, 60_000);

  it('V4 (Ethereum hub): positions resolve against /markets', async () => {
    if (skipIfNoWallet()) return;
    const reserves = await fetchReserves();
    const lookupMap = buildReserveLookupByChainAndToken(reserves);
    const v4BySpoke = deriveV4ReservesBySpoke(reserves);
    if (Object.keys(v4BySpoke).length === 0) {
      throw new Error('staging /markets has no V4 spokes — failing loudly instead of silently passing');
    }

    const v4Response = await getV4UserPositionsAllSpokes(1, WALLET!, v4BySpoke);
    assertNoChainErrors(v4Response.errors, 'V4');

    const positions = convertV4PositionsToWalletPositions(
      v4Response.results.flatMap((r) => r.positions),
      lookupMap,
      'onchain-v4',
    );

    assertAllResolvable(positions, 'V4');
    assertAmountsPositiveAndFinite(positions, 'V4');
    assertNoDuplicateEntries(positions, 'V4');
  }, 60_000);

  it('V3+V4 combined: positions resolve and portfolio has no duplicate reserveId', async () => {
    if (skipIfNoWallet()) return;
    const reserves = await fetchReserves();
    const lookupMap = buildReserveLookupByChainAndToken(reserves);
    const v3AssetsByMarket = deriveV3AssetsByMarket(reserves);
    const v4BySpoke = deriveV4ReservesBySpoke(reserves);
    if (Object.keys(v3AssetsByMarket).length === 0) {
      throw new Error('staging /markets has no V3 markets — failing loudly instead of silently passing');
    }
    if (Object.keys(v4BySpoke).length === 0) {
      throw new Error('staging /markets has no V4 spokes — failing loudly instead of silently passing');
    }

    const allPositions: WalletPosition[] = [];

    const v3Response = await getV3UserPositionsMultiChain(WALLET!, v3AssetsByMarket);
    assertNoChainErrors(v3Response.errors, 'combined V3');
    allPositions.push(
      ...convertV3PositionsToWalletPositions(
        v3Response.results.flatMap((r) => r.positions),
        lookupMap,
        'onchain-v3',
      ),
    );

    const v4Response = await getV4UserPositionsAllSpokes(1, WALLET!, v4BySpoke);
    assertNoChainErrors(v4Response.errors, 'combined V4');
    allPositions.push(
      ...convertV4PositionsToWalletPositions(
        v4Response.results.flatMap((r) => r.positions),
        lookupMap,
        'onchain-v4',
      ),
    );

    assertAllResolvable(allPositions, 'combined');

    const portfolio = convertWalletPositionsToEntries(allPositions, reserves);
    const ids = portfolio.map((e) => e.reserveId);
    expect(new Set(ids).size, 'portfolio entries must have unique reserveId after wallet→portfolio conversion').toBe(
      ids.length,
    );
  }, 120_000);
});
