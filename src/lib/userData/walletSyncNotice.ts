import { FALLBACK_ONLY_LABELS } from './failureLabels';

/**
 * AAV-1393: the wallet sync failure list mixes two kinds of labels.
 *
 * `sdk-*-fallback` only records that the SDK layer was bypassed — the onchain
 * reader may have returned everything, so the data can be complete. Every other
 * label (`onchain-*`, `gap-*`, …) means a read actually failed.
 *
 * Unknown labels are treated as real failures (fail open): showing the notice
 * when the data is in fact complete is less harmful than silently hiding it.
 */

export function hasMissingWalletData(failedSources: readonly string[]): boolean {
  return failedSources.some((label) => !FALLBACK_ONLY_LABELS.has(label));
}
