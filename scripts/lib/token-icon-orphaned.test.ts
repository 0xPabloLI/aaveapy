import { describe, expect, it } from 'vitest';

function computeOrphanedIcons(
  existingLocalIcons: Set<string>,
  requiredApiSymbols: Set<string>,
  protectedSymbols: Set<string> = new Set(['default'])
): string[] {
  return [...existingLocalIcons]
    .filter((s) => !requiredApiSymbols.has(s) && !protectedSymbols.has(s))
    .sort();
}

describe('computeOrphanedIcons', () => {
  it('returns icons present locally but absent from API', () => {
    const existing = new Set(['usdc', 'dai', 'weth', 'oldtoken']);
    const required = new Set(['usdc', 'dai', 'weth']);
    expect(computeOrphanedIcons(existing, required)).toEqual(['oldtoken']);
  });

  it('never includes protected symbols like default', () => {
    const existing = new Set(['default', 'usdc', 'orphan']);
    const required = new Set(['usdc']);
    expect(computeOrphanedIcons(existing, required)).toEqual(['orphan']);
  });

  it('returns empty when all local icons are required', () => {
    const existing = new Set(['usdc', 'dai']);
    const required = new Set(['usdc', 'dai', 'weth']);
    expect(computeOrphanedIcons(existing, required)).toEqual([]);
  });

  it('returns empty when local set is empty', () => {
    const existing = new Set<string>();
    const required = new Set(['usdc']);
    expect(computeOrphanedIcons(existing, required)).toEqual([]);
  });

  it('handles case-insensitive comparison (all keys already lowercased)', () => {
    const existing = new Set(['usdc', 'dai', 'deprecated']);
    const required = new Set(['usdc', 'dai']);
    expect(computeOrphanedIcons(existing, required)).toEqual(['deprecated']);
  });

  it('respects custom protected symbols', () => {
    const existing = new Set(['default', 'fallback', 'orphan']);
    const required = new Set([]);
    const protected_ = new Set(['default', 'fallback']);
    expect(computeOrphanedIcons(existing, required, protected_)).toEqual(['orphan']);
  });

  it('returns sorted results', () => {
    const existing = new Set(['zebra', 'alpha', 'mid']);
    const required = new Set<string>();
    expect(computeOrphanedIcons(existing, required)).toEqual(['alpha', 'mid', 'zebra']);
  });
});
