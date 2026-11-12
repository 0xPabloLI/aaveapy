import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

function computeOrphanedIcons(existingLocalIcons, requiredApiSymbols, protectedSymbols = new Set(['default'])) {
  return [...existingLocalIcons].filter((s) => !requiredApiSymbols.has(s) && !protectedSymbols.has(s)).sort();
}

describe('computeOrphanedIcons', () => {
  it('returns icons present locally but absent from API', () => {
    const existing = new Set(['usdc', 'dai', 'weth', 'oldtoken']);
    const required = new Set(['usdc', 'dai', 'weth']);
    assert.deepEqual(computeOrphanedIcons(existing, required), ['oldtoken']);
  });

  it('never includes protected symbols like default', () => {
    const existing = new Set(['default', 'usdc', 'orphan']);
    const required = new Set(['usdc']);
    assert.deepEqual(computeOrphanedIcons(existing, required), ['orphan']);
  });

  it('returns empty when all local icons are required', () => {
    const existing = new Set(['usdc', 'dai']);
    const required = new Set(['usdc', 'dai', 'weth']);
    assert.deepEqual(computeOrphanedIcons(existing, required), []);
  });

  it('returns empty when local set is empty', () => {
    const existing = new Set();
    const required = new Set(['usdc']);
    assert.deepEqual(computeOrphanedIcons(existing, required), []);
  });

  it('handles case-insensitive comparison (all keys already lowercased)', () => {
    const existing = new Set(['usdc', 'dai', 'deprecated']);
    const required = new Set(['usdc', 'dai']);
    assert.deepEqual(computeOrphanedIcons(existing, required), ['deprecated']);
  });

  it('respects custom protected symbols', () => {
    const existing = new Set(['default', 'fallback', 'orphan']);
    const required = new Set([]);
    const protected_ = new Set(['default', 'fallback']);
    assert.deepEqual(computeOrphanedIcons(existing, required, protected_), ['orphan']);
  });

  it('returns sorted results', () => {
    const existing = new Set(['zebra', 'alpha', 'mid']);
    const required = new Set();
    assert.deepEqual(computeOrphanedIcons(existing, required), ['alpha', 'mid', 'zebra']);
  });
});
