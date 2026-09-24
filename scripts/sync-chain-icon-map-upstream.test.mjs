#!/usr/bin/env node
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeRegistryGaps,
  planRegistryAdditions,
  applySvgPlans,
  insertEntries,
  parseChainIconMapEntries,
} from './sync-chain-icon-map-upstream.mjs';
import { renderPlaceholderSvg, monogramFromSlug } from './lib/chain-slug.mjs';

const MAP_FILE_TEMPLATE = `export const chainIconMap: Record<number, string> = {
  1: 'ethereum',
  10: 'optimism',
};
`;

describe('computeRegistryGaps', () => {
  it('reports chains present in registry but missing from map and upstream', () => {
    const registryModules = new Map([
      [5042, 'AaveV4Arc'],
      [1, 'AaveV3Ethereum'],
    ]);
    const mapEntries = new Map([[1, 'ethereum']]);
    const upstreamChainIds = new Set([10]);
    const gaps = computeRegistryGaps(registryModules, mapEntries, upstreamChainIds);
    assert.deepEqual(gaps, [{ chainId: 5042, moduleName: 'AaveV4Arc' }]);
  });

  it('does not report chains already in the map regardless of value', () => {
    const registryModules = new Map([[5042, 'AaveV4Arc']]);
    const mapEntries = new Map([[5042, 'some-existing-value']]);
    const gaps = computeRegistryGaps(registryModules, mapEntries, new Set());
    assert.deepEqual(gaps, []);
  });

  it('does not report chains covered by the upstream networksConfig source', () => {
    const registryModules = new Map([[5042, 'AaveV4Arc']]);
    const mapEntries = new Map();
    const gaps = computeRegistryGaps(registryModules, mapEntries, new Set([5042]));
    assert.deepEqual(gaps, []);
  });

  it('reports multiple missing chains sorted by chainId for deterministic output', () => {
    const registryModules = new Map([
      [9999, 'AaveV3Zed'],
      [5042, 'AaveV4Arc'],
      [1234, 'AaveV3Alpha'],
    ]);
    const gaps = computeRegistryGaps(registryModules, new Map(), new Set());
    assert.deepEqual(
      gaps.map((g) => g.chainId),
      [1234, 5042, 9999],
    );
  });
});

describe('planRegistryAdditions', () => {
  const viemChains = new Map([[8453, 'Base']]);

  it('derives slug from overrides and plans no svg when the file exists', async () => {
    const overrides = new Map([[5042, 'chainlink-arc']]);
    const plan = await planRegistryAdditions([{ chainId: 5042, moduleName: 'AaveV4Arc' }], {
      overrides,
      viemChains,
      existsFn: () => true,
    });
    assert.deepEqual(plan.entries, [{ chainId: 5042, slug: 'chainlink-arc', source: 'overrides' }]);
    assert.deepEqual(plan.svgPlans, []);
  });

  it('plans a placeholder svg when the target file is missing', async () => {
    const plan = await planRegistryAdditions([{ chainId: 5042, moduleName: 'AaveV4Arc' }], {
      viemChains,
      existsFn: () => false,
    });
    assert.deepEqual(plan.entries, [{ chainId: 5042, slug: 'arc', source: 'module-name' }]);
    assert.equal(plan.svgPlans.length, 1);
    assert.equal(plan.svgPlans[0].fileName, 'arc.svg');
    assert.equal(plan.svgPlans[0].content, renderPlaceholderSvg(monogramFromSlug('arc')));
  });

  it('falls through to viem chains when overrides and module name miss', async () => {
    const plan = await planRegistryAdditions([{ chainId: 8453 }], {
      viemChains,
      existsFn: () => true,
    });
    assert.deepEqual(plan.entries, [{ chainId: 8453, slug: 'base', source: 'viem' }]);
  });

  it('falls back to chain-<id> when every resolver misses', async () => {
    const plan = await planRegistryAdditions([{ chainId: 9999 }], {
      viemChains: new Map(),
      existsFn: () => true,
    });
    assert.deepEqual(plan.entries, [{ chainId: 9999, slug: 'chain-9999', source: 'fallback' }]);
  });

  it('deduplicates svg plans when two chains derive the same slug', async () => {
    const plan = await planRegistryAdditions(
      [
        { chainId: 1111, moduleName: 'AaveV3Dup' },
        { chainId: 2222, moduleName: 'AaveV4Dup' },
      ],
      { viemChains: new Map(), existsFn: () => false },
    );
    assert.equal(plan.svgPlans.length, 1);
    assert.equal(plan.svgPlans[0].fileName, 'dup.svg');
  });
});

describe('applySvgPlans', () => {
  it('writes every planned svg', async () => {
    const written = [];
    await applySvgPlans(
      [
        { fileName: 'a.svg', content: '<svg/>' },
        { fileName: 'b.svg', content: '<svg/>' },
      ],
      { NETWORKS_ICONS_DIR: '/icons', writeFileFn: async (dest, content) => written.push([dest, content]) },
    );
    assert.equal(written.length, 2);
    assert.match(written[0][0], /\/icons\/a\.svg$/);
  });

  it('throws on first failure so the caller never reaches the map write (atomicity)', async () => {
    let calls = 0;
    await assert.rejects(
      () =>
        applySvgPlans(
          [
            { fileName: 'a.svg', content: '<svg/>' },
            { fileName: 'b.svg', content: '<svg/>' },
          ],
          {
            NETWORKS_ICONS_DIR: '/icons',
            writeFileFn: async () => {
              calls += 1;
              if (calls === 2) throw new Error('disk full');
            },
          },
        ),
      /disk full/,
    );
  });
});

describe('insertEntries + parse round-trip (check-script contract)', () => {
  it('appends entries that the check-script regex can parse back', () => {
    const content = insertEntries(MAP_FILE_TEMPLATE, ["  5042: 'chainlink-arc',"]);
    const parsed = parseChainIconMapEntries(content);
    assert.equal(parsed.get(1), 'ethereum');
    assert.equal(parsed.get(10), 'optimism');
    assert.equal(parsed.get(5042), 'chainlink-arc');
  });

  it('keeps the closing brace on its own line', () => {
    const content = insertEntries(MAP_FILE_TEMPLATE, ["  5042: 'chainlink-arc',"]);
    assert.match(content, /chainlink-arc',\n\};\n?$/);
  });
});

describe('viem/chains real export (slug Level 3 data source)', () => {
  it('resolves known chain ids to names usable for slug derivation', async () => {
    // Guards the L3 assumption end-to-end: the real viem/chains export the
    // sync script relies on actually maps chainId -> { name }.
    const chains = await import('viem/chains');
    const base = Object.values(chains).find((c) => c && c.id === 8453);
    assert.equal(base?.name, 'Base');
  });
});
