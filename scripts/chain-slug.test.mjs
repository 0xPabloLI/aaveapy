#!/usr/bin/env node
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { deriveChainSlug, loadSlugOverrides, renderPlaceholderSvg, monogramFromSlug } from './lib/chain-slug.mjs';

function makeViemChains(entries) {
  return new Map(entries);
}

describe('deriveChainSlug', () => {
  it('uses overrides when chainId is listed (Level 1)', async () => {
    const overrides = loadSlugOverrides(JSON.stringify({ 5042: 'chainlink-arc' }));
    const result = await deriveChainSlug({
      chainId: 5042,
      overrides,
      viemChains: makeViemChains([]),
      fetchImpl: async () => {
        throw new Error('fetch must not be called when overrides hit');
      },
    });
    assert.deepEqual(result, { slug: 'chainlink-arc', source: 'overrides' });
  });

  it('derives from address-book module name by stripping AaveV3/V4 prefix (Level 2)', async () => {
    const result = await deriveChainSlug({
      chainId: 5042,
      moduleName: 'AaveV4Arc',
      viemChains: makeViemChains([]),
      fetchImpl: async () => {
        throw new Error('fetch must not be called when module name resolves');
      },
    });
    assert.deepEqual(result, { slug: 'arc', source: 'module-name' });
  });

  it('kebab-cases multi-word module names without prefix (Level 2)', async () => {
    const result = await deriveChainSlug({
      chainId: 2000,
      moduleName: 'AaveV3BnbChain',
      viemChains: makeViemChains([]),
      fetchImpl: async () => {
        throw new Error('fetch must not be called');
      },
    });
    assert.deepEqual(result, { slug: 'bnb-chain', source: 'module-name' });
  });

  it('falls through to viem chains when module name is unavailable (Level 3)', async () => {
    const result = await deriveChainSlug({
      chainId: 8453,
      viemChains: makeViemChains([[8453, 'Base']]),
      fetchImpl: async () => {
        throw new Error('fetch must not be called when viem resolves');
      },
    });
    assert.deepEqual(result, { slug: 'base', source: 'viem' });
  });

  it('falls through to chainid.network when viem misses (Level 3.5)', async () => {
    const result = await deriveChainSlug({
      chainId: 5042,
      viemChains: makeViemChains([]),
      fetchImpl: async () => ({
        ok: true,
        json: async () => [{ chainId: 5042, name: 'Chainlink Arc' }],
      }),
    });
    assert.deepEqual(result, { slug: 'chainlink-arc', source: 'chainid.network' });
  });

  it('falls back to chain-<id> when chainid.network fetch throws (Level 4)', async () => {
    const result = await deriveChainSlug({
      chainId: 9999,
      viemChains: makeViemChains([]),
      fetchImpl: async () => {
        throw new Error('network down');
      },
    });
    assert.deepEqual(result, { slug: 'chain-9999', source: 'fallback' });
  });

  it('falls back to chain-<id> when chainid.network has no match (Level 4)', async () => {
    const result = await deriveChainSlug({
      chainId: 9999,
      viemChains: makeViemChains([]),
      fetchImpl: async () => ({
        ok: true,
        json: async () => [{ chainId: 1, name: 'Ethereum' }],
      }),
    });
    assert.deepEqual(result, { slug: 'chain-9999', source: 'fallback' });
  });

  it('falls back to chain-<id> when no resolver input is provided at all (Level 4)', async () => {
    const result = await deriveChainSlug({ chainId: 4242 });
    assert.deepEqual(result, { slug: 'chain-4242', source: 'fallback' });
  });
});

describe('loadSlugOverrides', () => {
  it('lowercases values and returns a Map keyed by number', () => {
    const overrides = loadSlugOverrides(JSON.stringify({ 5042: 'Chainlink-Arc' }));
    assert.equal(overrides.get(5042), 'chainlink-arc');
  });

  it('rejects non-object JSON', () => {
    assert.throws(() => loadSlugOverrides(JSON.stringify(['chainlink-arc'])));
  });

  it('rejects non-numeric keys', () => {
    assert.throws(() => loadSlugOverrides(JSON.stringify({ arc: 'chainlink-arc' })), /arc/);
  });

  it('rejects values with characters outside [a-z0-9-] after lowercasing', () => {
    assert.throws(() => loadSlugOverrides(JSON.stringify({ 5042: 'chainlink_arc' })), /5042/);
    assert.throws(() => loadSlugOverrides(JSON.stringify({ 5042: 'chainlink arc' })), /5042/);
  });

  it('rejects empty values', () => {
    assert.throws(() => loadSlugOverrides(JSON.stringify({ 5042: '' })), /5042/);
  });
});

describe('monogramFromSlug', () => {
  it('takes first two chars of the first segment uppercased', () => {
    // Mechanical rule: 'chainlink-arc' -> 'CH'. Note the hand-made dev SVG
    // uses the brand monogram 'CL' — a one-off add/add conflict when dev
    // syncs over an auto-generated placeholder is accepted (see spec).
    assert.equal(monogramFromSlug('chainlink-arc'), 'CH');
  });

  it('uses the whole slug when there is no segment separator', () => {
    assert.equal(monogramFromSlug('arc'), 'AR');
  });

  it('handles single-char first segment', () => {
    assert.equal(monogramFromSlug('a-b'), 'A');
  });
});

describe('renderPlaceholderSvg', () => {
  it('embeds the monogram in a 200x200 rounded svg', () => {
    const svg = renderPlaceholderSvg('CL');
    assert.ok(svg.includes('width="200"'));
    assert.ok(svg.includes('viewBox="0 0 200 200"'));
    assert.ok(svg.includes('>CL<'));
    assert.ok(svg.trim().startsWith('<svg'));
    assert.ok(svg.trim().endsWith('</svg>'));
  });

  it('escapes XML-special characters in the monogram', () => {
    const svg = renderPlaceholderSvg('A<B');
    assert.ok(!svg.includes('A<B'));
    assert.ok(svg.includes('A&lt;B'));
  });
});
