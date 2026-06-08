export const FRESHNESS_WARN_S = 30;
export const FRESHNESS_STALE_S = 60;

export function freshnessColor(ageS: number): 'bg-emerald-400' | 'bg-amber-400' | 'bg-red-400' {
  const age = Math.max(0, ageS);
  if (age < FRESHNESS_WARN_S) return 'bg-emerald-400';
  if (age < FRESHNESS_STALE_S) return 'bg-amber-400';
  return 'bg-red-400';
}
