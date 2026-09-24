#!/usr/bin/env node
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadPendingChainIds, evaluateRegistryAlignment } from './check-chain-icon-map-upstream.mjs';

describe('loadPendingChainIds', () => {
  it('parses numeric arrays into a Set of numbers', () => {
    assert.deepEqual(loadPendingChainIds('[5042, 1234]'), new Set([5042, 1234]));
  });

  it('accepts numeric strings (lenient) and empty tables', () => {
    assert.deepEqual(loadPendingChainIds('["5042"]'), new Set([5042]));
    assert.deepEqual(loadPendingChainIds('[]'), new Set());
  });

  it('throws on non-array or non-numeric entries (fail-fast on malformed allowlist)', () => {
    assert.throws(() => loadPendingChainIds('{}'), /array/i);
    assert.throws(() => loadPendingChainIds('["abc"]'), /chainId/i);
    assert.throws(() => loadPendingChainIds('[true]'), /chainId/i);
  });
});

describe('evaluateRegistryAlignment', () => {
  it('reports all mismatches when allowlist is empty (default behavior unchanged)', () => {
    const r = evaluateRegistryAlignment({
      registryIds: new Set([1, 5042]),
      mapIds: new Set([1]),
      pendingIds: new Set(),
    });
    assert.deepEqual(r.mismatches, [5042]);
    assert.deepEqual(r.allowed, []);
  });

  it('demotes allowlisted chainIds to warnings, keeps others as mismatches', () => {
    const r = evaluateRegistryAlignment({
      registryIds: new Set([1, 5042, 9999]),
      mapIds: new Set([1]),
      pendingIds: new Set([5042]),
    });
    assert.deepEqual(r.mismatches, [9999]);
    assert.deepEqual(r.allowed, [5042]);
  });

  it('reports map-only chainIds the same way (in icon map but not in registry)', () => {
    const r = evaluateRegistryAlignment({
      registryIds: new Set([1]),
      mapIds: new Set([1, 777]),
      pendingIds: new Set([777]),
    });
    assert.deepEqual(r.mismatches, []);
    assert.deepEqual(r.allowed, [777]);
  });

  it('returns empty for fully aligned sets', () => {
    const r = evaluateRegistryAlignment({
      registryIds: new Set([1, 2]),
      mapIds: new Set([2, 1]),
      pendingIds: new Set([2]),
    });
    assert.deepEqual(r.mismatches, []);
    assert.deepEqual(r.allowed, []);
  });

  it('sorts output deterministically by chainId', () => {
    const r = evaluateRegistryAlignment({
      registryIds: new Set([9999, 5042, 1234]),
      mapIds: new Set(),
      pendingIds: new Set(),
    });
    assert.deepEqual(r.mismatches, [1234, 5042, 9999]);
  });
});
