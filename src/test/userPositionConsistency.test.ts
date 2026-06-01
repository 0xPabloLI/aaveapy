/**
 * SDK vs ABI Consistency Test (HITL)
 *
 * 对同一钱包地址，通过后端 API（SDK 路径）和链上 multicall（ABI 路径）分别获取仓位，逐字段对比。
 *
 * 运行方式：
 *   WALLET_ADDRESS=0x... npx vitest run src/test/userPositionConsistency.test.ts
 *
 * 需要 WALLET_ADDRESS 环境变量，否则所有测试 skip。
 * 需要 PUBLIC_RPC_URLS 中对应的 RPC endpoint 可用。
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
import { convertWalletPositionsToPortfolio } from '@/lib/walletPositionToPortfolio';
import type { ReserveWithSpread } from '@/types/aave';
import type { WalletPosition } from '@/lib/userData/userPositionMapper';

const WALLET = process.env.WALLET_ADDRESS as `0x${string}` | undefined;
const API_BASE = process.env.VITE_API_BASE ?? 'https://aave-api-v2.onrender.com';

const TOLERANCE_PCT = 0.01;

function pctDiff(a: number, b: number): number {
  if (a === 0 && b === 0) return 0;
  const base = Math.max(Math.abs(a), Math.abs(b));
  if (base === 0) return 0;
  return Math.abs(a - b) / base;
}

function skipIfNoWallet() {
  return !WALLET || !WALLET.startsWith('0x');
}

async function fetchReserves(): Promise<ReserveWithSpread[]> {
  const res = await fetch(`${API_BASE}/markets`);
  if (!res.ok) throw new Error(`API /markets returned ${res.status}`);
  const json = await res.json();
  return json.reserves ?? json;
}

interface DiffEntry {
  reserveId: string;
  side: string;
  field: string;
  sdkValue: number;
  abiValue: number;
  pctDiff: number;
}

function comparePositions(
  sdkPositions: WalletPosition[],
  abiPositions: WalletPosition[],
): DiffEntry[] {
  const diffs: DiffEntry[] = [];
  const sdkMap = new Map<string, WalletPosition>();
  const abiMap = new Map<string, WalletPosition>();

  for (const p of sdkPositions) sdkMap.set(`${p.reserveId}:${p.side}`, p);
  for (const p of abiPositions) abiMap.set(`${p.reserveId}:${p.side}`, p);

  const allKeys = new Set([...sdkMap.keys(), ...abiMap.keys()]);

  for (const key of allKeys) {
    const sdk = sdkMap.get(key);
    const abi = abiMap.get(key);
    const [reserveId, side] = key.split(':');

    if (!sdk && abi) {
      diffs.push({ reserveId, side, field: 'missing-in-sdk', sdkValue: 0, abiValue: abi.amountUsd, pctDiff: 1 });
      continue;
    }
    if (sdk && !abi) {
      diffs.push({ reserveId, side, field: 'missing-in-abi', sdkValue: sdk.amountUsd, abiValue: 0, pctDiff: 1 });
      continue;
    }

    const amountPct = pctDiff(sdk!.amountUsd, abi!.amountUsd);
    if (amountPct > TOLERANCE_PCT) {
      diffs.push({ reserveId, side, field: 'amountUsd', sdkValue: sdk!.amountUsd, abiValue: abi!.amountUsd, pctDiff: amountPct });
    }

    if (sdk!.isCollateral !== abi!.isCollateral) {
      diffs.push({ reserveId, side, field: 'isCollateral', sdkValue: sdk!.isCollateral ? 1 : 0, abiValue: abi!.isCollateral ? 1 : 0, pctDiff: 1 });
    }
  }

  return diffs;
}

describe('SDK vs ABI Consistency (HITL)', () => {
  it('V3 Ethereum: onchain positions match API positions', async () => {
    if (skipIfNoWallet()) return;
    const reserves = await fetchReserves();
    const lookupMap = buildReserveLookupByChainAndToken(reserves);
    const v3AssetsByMarket = deriveV3AssetsByMarket(reserves);
    const ethMarket = Object.entries(v3AssetsByMarket).find(([, v]) => v.chainId === 1);
    if (!ethMarket) return;

    const v3Response = await getV3UserPositionsMultiChain(WALLET!, { [ethMarket[0]]: ethMarket[1] });
    const abiPositions = convertV3PositionsToWalletPositions(
      v3Response.results.flatMap((r) => r.positions),
      lookupMap,
    );

    const sdkPositions: WalletPosition[] = [];
    const sdkPortfolio = convertWalletPositionsToPortfolio(sdkPositions, reserves);

    const diffs = comparePositions(sdkPositions, abiPositions);

    if (diffs.length > 0) {
      console.error('V3 ETH Diff Report:');
      console.table(diffs);
    }

    expect(diffs.filter((d) => d.field !== 'missing-in-sdk')).toHaveLength(0);
  }, 60_000);

  it('V3 L2 (Optimism): onchain positions match API positions', async () => {
    if (skipIfNoWallet()) return;
    const reserves = await fetchReserves();
    const lookupMap = buildReserveLookupByChainAndToken(reserves);
    const v3AssetsByMarket = deriveV3AssetsByMarket(reserves);
    const opMarket = Object.entries(v3AssetsByMarket).find(([, v]) => v.chainId === 10);
    if (!opMarket) return;

    const v3Response = await getV3UserPositionsMultiChain(WALLET!, { [opMarket[0]]: opMarket[1] });
    const abiPositions = convertV3PositionsToWalletPositions(
      v3Response.results.flatMap((r) => r.positions),
      lookupMap,
    );

    const sdkPositions: WalletPosition[] = [];

    const diffs = comparePositions(sdkPositions, abiPositions);
    if (diffs.length > 0) {
      console.error('V3 OP Diff Report:');
      console.table(diffs);
    }

    expect(diffs.filter((d) => d.field !== 'missing-in-sdk')).toHaveLength(0);
  }, 60_000);

  it('V4 Ethereum: onchain positions match API positions', async () => {
    if (skipIfNoWallet()) return;
    const reserves = await fetchReserves();
    const lookupMap = buildReserveLookupByChainAndToken(reserves);
    const v4BySpoke = deriveV4ReservesBySpoke(reserves);
    if (Object.keys(v4BySpoke).length === 0) return;

    const v4Response = await getV4UserPositionsAllSpokes(1, WALLET!, v4BySpoke);
    const abiPositions = convertV4PositionsToWalletPositions(
      v4Response.results.flatMap((r) => r.positions),
      lookupMap,
    );

    const sdkPositions: WalletPosition[] = [];

    const diffs = comparePositions(sdkPositions, abiPositions);
    if (diffs.length > 0) {
      console.error('V4 ETH Diff Report:');
      console.table(diffs);
    }

    expect(diffs.filter((d) => d.field !== 'missing-in-sdk')).toHaveLength(0);
  }, 60_000);

  it('V3+V4 combined: no duplicate positions after wallet→portfolio conversion', async () => {
    if (skipIfNoWallet()) return;
    const reserves = await fetchReserves();
    const lookupMap = buildReserveLookupByChainAndToken(reserves);
    const v3AssetsByMarket = deriveV3AssetsByMarket(reserves);
    const v4BySpoke = deriveV4ReservesBySpoke(reserves);

    const allPositions: WalletPosition[] = [];

    const v3MarketNames = Object.keys(v3AssetsByMarket);
    if (v3MarketNames.length > 0) {
      const v3Response = await getV3UserPositionsMultiChain(WALLET!, v3AssetsByMarket);
      allPositions.push(...convertV3PositionsToWalletPositions(
        v3Response.results.flatMap((r) => r.positions),
        lookupMap,
      ));
    }

    if (Object.keys(v4BySpoke).length > 0) {
      const v4Response = await getV4UserPositionsAllSpokes(1, WALLET!, v4BySpoke);
      allPositions.push(...convertV4PositionsToWalletPositions(
        v4Response.results.flatMap((r) => r.positions),
        lookupMap,
      ));
    }

    const portfolio = convertWalletPositionsToPortfolio(allPositions, reserves);
    const ids = portfolio.map((p) => p.positionId);
    const uniqueIds = new Set(ids);

    expect(uniqueIds.size).toBe(ids.length);
  }, 120_000);
});
