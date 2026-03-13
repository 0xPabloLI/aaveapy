import { TokenCategoryOverrides } from '@/lib/tokenCategories';
import { QUERY_STALE_TIMES } from '@/config/queryStaleTimes';
import { getCachedTokenCategoriesEntry } from '@/lib/cache';
import { useSideDataMeta } from '@/hooks/useSideDataMeta';

export const useTokenCategories = () => {
  const cachedEntry = getCachedTokenCategoriesEntry<TokenCategoryOverrides>();
  const query = useSideDataMeta(QUERY_STALE_TIMES.tokenCategories, 1);

  return {
    ...query,
    data:
      query.data?.categories
        ? {
            stablecoins: query.data.categories.uniqueSymbolsStablecoins,
            ethRelated: query.data.categories.uniqueSymbolsEth,
          }
        : (cachedEntry?.data ?? undefined),
  };
  setCachedTokenCategories(normalized);
  return normalized;
};

