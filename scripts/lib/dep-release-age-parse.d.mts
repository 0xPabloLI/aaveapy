/**
 * Type declarations for scripts/lib/dep-release-age-parse.mjs — the release-age
 * checker is plain node JS (no build step), while the vitest suite imports it
 * from TypeScript.
 */

/** One adopted dependency version parsed from a lockfile diff. */
export interface LockEntry {
  name: string;
  version: string;
}

export function parseAddedLockEntries(diffText: string): LockEntry[];
export function dedupeEntries(entries: LockEntry[]): LockEntry[];
export function resolvePublishTime(timeMap: Record<string, string>, version: string): Date | null;
export function isAtLeastDaysOld(publishTime: Date, now: Date, minAgeDays: number): boolean;
