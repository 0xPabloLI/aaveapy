import { QUERY_STALE_TIMES } from '@/config/queryStaleTimes';
import { getCachedCoingeckoFdvEntry } from '@/lib/cache';
import { useSideDataMeta } from '@/hooks/useSideDataMeta';

interface CoingeckoFdvItem {
  id: string;
  symbol: string | null;
  name: string | null;
  fdvUsd: number | null;
}

interface CoingeckoFdvResponse {
  items: CoingeckoFdvItem[];
  fetchedAt: string;
}

export const useCoingeckoFdv = () => {
  const cachedEntry = getCachedCoingeckoFdvEntry<CoingeckoFdvResponse>();
  const query = useSideDataMeta(QUERY_STALE_TIMES.coingeckoFdv, 1);

  return {
    ...query,
    data:
      query.data?.fdv
        ? {
            items: query.data.fdv.items,
            fetchedAt: query.data.fdv.fetchedAt,
          }
        : (cachedEntry?.data ?? undefined),
  };
};
