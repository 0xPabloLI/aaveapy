/**
 * AAV-1399 — 把「链上 eMode 类别」与「/meta/e-mode 类别参数」合成一份
 * `EModeOverrides`，供 Portfolio 模拟使用。
 *
 * 生命周期与 `useOnchainHealthFactor` 对齐：
 * - 需要 address + 至少一个 V3 target；
 * - `subscribeRefetch` 触发缓存失效（F5 / 刷新按钮 / Watch 重进）；
 * - 任何读取失败都只降级，不阻塞组合模拟。
 */
import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { API_BASE } from '@/lib/apiBase';
import { QUERY_STALE_TIMES } from '@/config/queryStaleTimes';
import { EModeMarketPayloadSchema } from '@/lib/apiSchemas';
import { fetchWithTracing } from '@/lib/requestContext';
import { subscribeRefetch } from '@/lib/userData/refetchEvent';
import {
  buildEModeOverrides,
  extractV3EModeTargets,
  type EModeMarketCategoryLike,
  type EModeOverrides,
  type V3EModeTarget,
} from '@/lib/userData/eMode';
import { fetchOnchainEModeCategoryIds } from '@/lib/userData/onchainEMode';
import type { ReserveWithSpread } from '@/types/aave';
import type { PortfolioReserveEntry } from '@/types/portfolio';

export interface UseEModeOverridesArgs {
  address?: `0x${string}`;
  entries: readonly PortfolioReserveEntry[];
  reserves: readonly ReserveWithSpread[];
}

export interface UseEModeOverridesResult {
  /** category 0 / 无 wallet / 无 target → undefined（全部走 base）。 */
  eModeOverrides?: EModeOverrides;
  isLoading: boolean;
}

export const EMODE_OVERRIDES_QUERY_KEY = 'emode-overrides';

export async function fetchEModeMarketCategories(marketKey: string): Promise<readonly EModeMarketCategoryLike[]> {
  const response = await fetchWithTracing(`${API_BASE}/meta/e-mode/${marketKey}`);
  if (!response.ok) {
    throw new Error(`eMode market fetch failed (${response.status})`);
  }
  const parsed = EModeMarketPayloadSchema.parse(await response.json());
  return parsed.categories;
}

function hashTargets(targets: readonly V3EModeTarget[]): string {
  return targets
    .map((target) => `${target.poolKey}|${target.marketKey}`)
    .sort()
    .join(',');
}

async function fetchEModeOverrides(
  address: `0x${string}`,
  targets: readonly V3EModeTarget[],
): Promise<EModeOverrides | null> {
  const categoryIdsByPool = await fetchOnchainEModeCategoryIds(address, targets);
  const eModeTargets = targets.filter((target) => (categoryIdsByPool.get(target.poolKey) ?? 0) > 0);
  if (eModeTargets.length === 0) return null;

  const categoriesByMarketKey = new Map<string, readonly EModeMarketCategoryLike[]>();
  const failedMarketKeys = new Set<string>();

  await Promise.all(
    eModeTargets.map(async (target) => {
      try {
        categoriesByMarketKey.set(target.marketKey, await fetchEModeMarketCategories(target.marketKey));
      } catch (err) {
        failedMarketKeys.add(target.marketKey);
        console.info(`[emode] ${target.marketKey} category payload unavailable, using base LTV/LT`, err); // nosemgrep: unsafe-formatstring — template literal interpolation, not a printf-style format string
      }
    }),
  );

  return buildEModeOverrides({
    targets: eModeTargets,
    categoryIdsByPool,
    categoriesByMarketKey,
    failedMarketKeys,
  });
}

export function useEModeOverrides({ address, entries, reserves }: UseEModeOverridesArgs): UseEModeOverridesResult {
  const queryClient = useQueryClient();

  const targets = useMemo(() => extractV3EModeTargets(entries, reserves), [entries, reserves]);
  const hasTargets = targets.length > 0;
  const targetsHash = useMemo(() => hashTargets(targets), [targets]);

  const query = useQuery({
    queryKey: [EMODE_OVERRIDES_QUERY_KEY, address ?? 'no-wallet', targetsHash],
    queryFn: async () => {
      if (!address || !hasTargets) return null;
      return fetchEModeOverrides(address, targets);
    },
    enabled: !!address && hasTargets,
    staleTime: QUERY_STALE_TIMES.default,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  useEffect(() => {
    if (!address) return () => undefined;
    return subscribeRefetch(() => {
      void queryClient.invalidateQueries({ queryKey: [EMODE_OVERRIDES_QUERY_KEY, address] });
    });
  }, [address, queryClient]);

  return {
    eModeOverrides: query.data ?? undefined,
    isLoading: query.isLoading,
  };
}
