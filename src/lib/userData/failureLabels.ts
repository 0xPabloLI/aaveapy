/**
 * AAV-1393: labels that only record which layer was bypassed, shared by the
 * producer (`useUserPositionsSdk`) and the UI classifier so the vocabulary has
 * exactly one author.
 *
 * These two labels mean "the SDK layer was unavailable, the onchain reader took
 * over". They say nothing about whether the data itself is complete.
 */
export const SDK_V3_FALLBACK_LABEL = 'sdk-v3-fallback';
export const SDK_V4_FALLBACK_LABEL = 'sdk-v4-fallback';

export const FALLBACK_ONLY_LABELS: ReadonlySet<string> = new Set([SDK_V3_FALLBACK_LABEL, SDK_V4_FALLBACK_LABEL]);
