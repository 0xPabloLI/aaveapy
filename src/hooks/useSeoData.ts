import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchGscRows,
  fetchSemrushRows,
  postSemrushBatch,
  deleteSemrush,
  type FetchGscParams,
  type FetchSemrushParams,
  type SemrushBatchInput,
} from "@/lib/seoApi";

const STALE_5MIN = 5 * 60 * 1000;

const SEO_KEYS = {
  gsc: (p: FetchGscParams) => ["seo", "gsc", p] as const,
  semrush: (p: FetchSemrushParams) => ["seo", "semrush", p] as const,
};

export function useGscRows(params: FetchGscParams, enabled = true) {
  return useQuery({
    queryKey: SEO_KEYS.gsc(params),
    queryFn: () => fetchGscRows(params),
    staleTime: STALE_5MIN,
    enabled,
  });
}

export function useSemrushRows(params: FetchSemrushParams = {}) {
  return useQuery({
    queryKey: SEO_KEYS.semrush(params),
    queryFn: () => fetchSemrushRows(params),
    staleTime: STALE_5MIN,
  });
}

export function useSemrushBatchMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (snapshots: SemrushBatchInput[]) => postSemrushBatch(snapshots),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["seo", "semrush"] }),
  });
}

export function useSemrushDeleteMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteSemrush(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["seo", "semrush"] }),
  });
}
