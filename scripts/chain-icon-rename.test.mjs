#!/usr/bin/env node
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeUpstreamRenames, applyRenames, resolveRenameSvg } from './sync-chain-icon-map-upstream.mjs';
import { renderPlaceholderSvg, monogramFromSlug } from './lib/chain-slug.mjs';

const MAP_WITH_STALE_ARC = `export const chainIconMap: Record<number, string> = {
  1: 'ethereum',
  5042: 'arc',
  10: 'optimism',
};
`;

function makeUpstreamNetworks(networks) {
  return networks;
}

describe('computeUpstreamRenames', () => {
  const upstream = makeUpstreamNetworks([
    { name: 'Chainlink Arc', networkLogoPath: '/icons/networks/chainlink-arc.svg', wagmiChain: 'arc' },
    { name: 'OP', networkLogoPath: '/icons/networks/optimism.svg', wagmiChain: 'optimism' },
  ]);
  const chainIdMap = new Map([
    ['arc', 5042],
    ['optimism', 10],
  ]);

  it('reports map entries whose value diverges from the upstream iconBase', () => {
    const mapEntries = new Map([
      [1, 'ethereum'],
      [5042, 'arc'],
    ]);
    const renames = computeUpstreamRenames(upstream, chainIdMap, mapEntries);
    assert.deepEqual(renames, [
      { chainId: 5042, from: 'arc', to: 'chainlink-arc', iconPath: '/icons/networks/chainlink-arc.svg' },
    ]);
  });

  it('is silent when map values already match the upstream iconBase', () => {
    const mapEntries = new Map([
      [5042, 'chainlink-arc'],
      [10, 'optimism'],
    ]);
    const renames = computeUpstreamRenames(upstream, chainIdMap, mapEntries);
    assert.deepEqual(renames, []);
  });

  it('ignores chains missing from the map (those are gaps, not renames)', () => {
    const renames = computeUpstreamRenames(upstream, chainIdMap, new Map([[1, 'ethereum']]));
    assert.deepEqual(renames, []);
  });
});

describe('applyRenames', () => {
  it('rewrites only the renamed entries and stays parseable', () => {
    const renamed = applyRenames(MAP_WITH_STALE_ARC, [
      { chainId: 5042, from: 'arc', to: 'chainlink-arc', iconPath: '/icons/networks/chainlink-arc.svg' },
    ]);
    assert.match(renamed, /5042: 'chainlink-arc',/);
    assert.ok(!renamed.includes("'arc'"));
    assert.match(renamed, /1: 'ethereum',/);
    assert.match(renamed, /10: 'optimism',/);
  });

  it('leaves content unchanged when there are no renames', () => {
    const unchanged = applyRenames(MAP_WITH_STALE_ARC, []);
    assert.equal(unchanged, MAP_WITH_STALE_ARC);
  });

  it('escapes regex metacharacters in the from slug', () => {
    // Upstream iconBase filenames may contain '.' — an unescaped '.' would
    // widen the pattern and weaken match precision.
    const map = `export const chainIconMap: Record<number, string> = {
  9001: 'foo.bar',
};
`;
    const renamed = applyRenames(map, [{ chainId: 9001, from: 'foo.bar', to: 'foobar', iconPath: '/x.svg' }]);
    assert.match(renamed, /9001: 'foobar',/);
    assert.ok(!renamed.includes("'foo.bar'"));
  });
});

describe('resolveRenameSvg', () => {
  const rename = {
    chainId: 5042,
    from: 'arc',
    to: 'chainlink-arc',
    iconPath: '/icons/networks/chainlink-arc.svg',
  };

  it('does nothing when the target svg already exists', async () => {
    const calls = [];
    await resolveRenameSvg(rename, {
      UPSTREAM_PUBLIC_ROOT: 'https://upstream.example',
      existsFn: (fileName) => fileName === 'chainlink-arc.svg',
      fetchImpl: async () => {
        throw new Error('fetch must not be called');
      },
      writeFileFn: async (...args) => calls.push(args),
    });
    assert.deepEqual(calls, []);
  });

  it('downloads the upstream svg when the target is missing', async () => {
    const calls = [];
    await resolveRenameSvg(rename, {
      UPSTREAM_PUBLIC_ROOT: 'https://upstream.example',
      existsFn: () => false,
      fetchImpl: async (url) => {
        assert.equal(url, 'https://upstream.example/icons/networks/chainlink-arc.svg');
        return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) };
      },
      writeFileFn: async (dest, content) => calls.push([dest, content]),
    });
    assert.equal(calls.length, 1);
    assert.match(calls[0][0], /chainlink-arc\.svg$/);
  });

  it('retries once before falling back: second attempt succeeds', async () => {
    const calls = [];
    let attempts = 0;
    await resolveRenameSvg(rename, {
      UPSTREAM_PUBLIC_ROOT: 'https://upstream.example',
      existsFn: () => false,
      fetchImpl: async () => {
        attempts += 1;
        if (attempts === 1) throw new Error('transient network error');
        return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) };
      },
      writeFileFn: async (dest, content) => calls.push([dest, content]),
    });
    assert.equal(attempts, 2);
    assert.equal(calls.length, 1);
    assert.match(calls[0][0], /chainlink-arc\.svg$/);
  });

  it('falls back to a placeholder svg when the download fails', async () => {
    const calls = [];
    await resolveRenameSvg(rename, {
      UPSTREAM_PUBLIC_ROOT: 'https://upstream.example',
      existsFn: () => false,
      fetchImpl: async () => {
        throw new Error('cloudflare blocked');
      },
      writeFileFn: async (dest, content) => calls.push([dest, content]),
    });
    assert.equal(calls.length, 1);
    assert.match(calls[0][0], /chainlink-arc\.svg$/);
    assert.equal(calls[0][1], renderPlaceholderSvg(monogramFromSlug('chainlink-arc')));
  });

  it('falls back to a placeholder svg when the download returns non-ok', async () => {
    const calls = [];
    await resolveRenameSvg(rename, {
      UPSTREAM_PUBLIC_ROOT: 'https://upstream.example',
      existsFn: () => false,
      fetchImpl: async () => ({ ok: false, status: 404 }),
      writeFileFn: async (dest, content) => calls.push([dest, content]),
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0][1], renderPlaceholderSvg(monogramFromSlug('chainlink-arc')));
  });
});
