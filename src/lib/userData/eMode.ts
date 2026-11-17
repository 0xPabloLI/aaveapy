/**
 * AAV-1399 — eMode（隔离模式）参数的前端领域模型。
 *
 * 两类数据在此汇合：
 *   1. 链上 `Pool.getUserEMode(user)` → 每个 V3 pool 的类别 id（0 = 无 eMode）。
 *   2. `GET /api/meta/e-mode/{marketKey}` → 该市场的全部类别参数（AAV-1394）。
 *
 * 本模块只做纯映射：目标提取、类别匹配、effective LTV/LT 解析。网络读取在
 * `onchainEMode.ts` 与 `useEModeOverrides`，UI 与 simulator 只消费这里的结果。
 */
import type { ReserveWithSpread } from '@/types/aave';
import type { PortfolioReserveEntry } from '@/types/portfolio';
import { getProtocolVersion } from '@/lib/protocolVersion';
import { parseReserveId } from '@/lib/reserveIdParser';
import { marketKey } from '@/lib/marketKey';

/** 一个需要读取 eMode 的 V3 pool。 */
export interface V3EModeTarget {
  chainId: number;
  /** `${chainId}:${marketName}` — 与 HF / simulator 的分组边界一致。 */
  poolKey: string;
  /** `${chainId}:${poolAddressLower}` — AAV-1394 端点的路径参数。 */
  marketKey: string;
  /** 用于 `getUserEMode` 的 Pool 合约地址（小写）。 */
  poolAddress: `0x${string}`;
}

/** `/meta/e-mode/{marketKey}` 单个类别的可消费字段（生成 schema 的结构子集）。 */
export interface EModeMarketCategoryLike {
  id: number;
  label: string;
  maxLtv: number;
  liquidationThreshold: number;
  collateralReserves: readonly string[];
}

export interface EModeCategoryParams {
  categoryId: number;
  label: string;
  /** percent, e.g. 93 */
  maxLtv: number;
  /** percent, e.g. 95 */
  liquidationThreshold: number;
  /** lowercase token addresses; membership => 可抵押 */
  collateralReserves: ReadonlySet<string>;
}

/** poolKey → 生效的类别参数。 */
export type EModeParamsByPool = ReadonlyMap<string, EModeCategoryParams>;

export interface EModeOverrides {
  params: EModeParamsByPool;
  /** 已知用户在该池有 eMode，但类别数据不可用 ⇒ 额度按 base 计算。 */
  fallbackPools: ReadonlySet<string>;
}

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

function isValidPoolAddress(value: string): value is `0x${string}` {
  return ADDRESS_RE.test(value);
}

/**
 * 从 portfolio entries 提取需要读取 eMode 的 V3 pool。
 *
 * - 跳过 hidden / orphan / 找不到 reserve 的 entry；
 * - 跳过 V4（四段 reserveId，协议无 eMode 类别）；
 * - 跳过畸形 reserveId / 非法 pool 地址 / chainId 不一致；
 * - 按 poolKey 去重，保留第一条。
 */
export function extractV3EModeTargets(
  entries: readonly PortfolioReserveEntry[],
  reserves: readonly ReserveWithSpread[],
): V3EModeTarget[] {
  const reserveMap = new Map(reserves.map((r) => [r.reserveId.trim(), r]));
  const seen = new Set<string>();
  const targets: V3EModeTarget[] = [];

  for (const entry of entries) {
    if (entry.hidden || entry.isOrphan) continue;
    const reserve = reserveMap.get(entry.reserveId.trim());
    if (!reserve) continue;
    if (getProtocolVersion(reserve.marketName) !== 'v3') continue;

    const parsed = parseReserveId(reserve.reserveId.trim());
    if (!parsed) continue;
    if (parsed.chainId !== reserve.chainId) continue;
    if (!isValidPoolAddress(parsed.poolOrSpokeAddress)) continue;

    const poolKey = marketKey(reserve.chainId, reserve.marketName);
    if (seen.has(poolKey)) continue;
    seen.add(poolKey);

    const poolAddress = parsed.poolOrSpokeAddress.toLowerCase() as `0x${string}`;
    targets.push({
      chainId: reserve.chainId,
      poolKey,
      marketKey: `${parsed.chainId}:${poolAddress}`,
      poolAddress,
    });
  }

  return targets;
}

/** simulator 侧的 reserve 形状（V3/V4 通用；eMode 仅 V3 命中）。 */
export interface EModeReserveLike {
  chainId: number;
  marketName: string;
  tokenAddress?: string | null;
  ltv?: number | null;
  liquidationThreshold?: number | null;
}

/**
 * 将「池的 category id」与「市场的类别数组」合成 simulator 可消费的 override。
 *
 * - category 0 / 未读到 → 不产出 params（走 base）；
 * - category > 0 但 payload 缺失 / 缺该 id / 市场拉取失败 → 记入 fallbackPools（仍走 base）。
 */
export function buildEModeOverrides({
  targets,
  categoryIdsByPool,
  categoriesByMarketKey,
  failedMarketKeys,
}: {
  targets: readonly V3EModeTarget[];
  categoryIdsByPool: ReadonlyMap<string, number>;
  categoriesByMarketKey: ReadonlyMap<string, readonly EModeMarketCategoryLike[]>;
  failedMarketKeys?: ReadonlySet<string>;
}): EModeOverrides {
  const params = new Map<string, EModeCategoryParams>();
  const fallbackPools = new Set<string>();

  for (const target of targets) {
    const categoryId = categoryIdsByPool.get(target.poolKey);
    if (categoryId === undefined || categoryId <= 0) continue;

    if (failedMarketKeys?.has(target.marketKey)) {
      fallbackPools.add(target.poolKey);
      continue;
    }

    const categories = categoriesByMarketKey.get(target.marketKey);
    const category = categories?.find((candidate) => candidate.id === categoryId);
    if (!category) {
      fallbackPools.add(target.poolKey);
      continue;
    }

    params.set(target.poolKey, {
      categoryId,
      label: category.label,
      maxLtv: category.maxLtv,
      liquidationThreshold: category.liquidationThreshold,
      collateralReserves: new Set(category.collateralReserves.map((address) => address.toLowerCase())),
    });
  }

  return { params, fallbackPools };
}

function findPoolParams(reserve: EModeReserveLike, params?: EModeParamsByPool): EModeCategoryParams | undefined {
  return params?.get(marketKey(reserve.chainId, reserve.marketName));
}

/**
 * 成员资产 → 类别值；非成员 / 缺 token 地址 → 0；无 override → base。
 * 两个入口共用同一判定，避免 LTV 与 LT 的成员规则漂移。
 */
function effectiveCategoryValue(
  reserve: EModeReserveLike,
  params: EModeParamsByPool | undefined,
  pick: (category: EModeCategoryParams) => number,
  base: number | null | undefined,
): number {
  const override = findPoolParams(reserve, params);
  if (!override) return base ?? 0;
  const token = reserve.tokenAddress?.toLowerCase();
  if (!token) return 0;
  return override.collateralReserves.has(token) ? pick(override) : 0;
}

export function effectiveLtv(reserve: EModeReserveLike, params?: EModeParamsByPool): number {
  return effectiveCategoryValue(reserve, params, (category) => category.maxLtv, reserve.ltv);
}

export function effectiveLiquidationThreshold(reserve: EModeReserveLike, params?: EModeParamsByPool): number {
  return effectiveCategoryValue(
    reserve,
    params,
    (category) => category.liquidationThreshold,
    reserve.liquidationThreshold,
  );
}
