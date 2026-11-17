#!/usr/bin/env node
/**
 * Hermetic guard for AAV-1335: importing `sync-reserve-patches-upstream.mjs`
 * must never touch the network.
 *
 * The 2026-10-12 pre-push gate had this suite burn 46s and fail with
 * "upstream download failed after 2 attempts (cloudflare blocked)" on one run
 * and pass on the next, because the module ran `main()` at import time. That
 * was fixed by gating `main()` behind `isDirectRun` (`7a64abc2`), but nothing
 * stopped the gate from being deleted again: no test noticed, because a network
 * failure at import only shows up on a machine that cannot reach the upstream.
 *
 * This guard fails deterministically instead — the network APIs are trapped
 * before the module is imported, so any outbound attempt is recorded and reported
 * rather than silently succeeding on a well-connected machine.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MODULE_SOURCE_PATH = path.join(HERE, 'sync-reserve-patches-upstream.mjs');
const MODULE_URL = './sync-reserve-patches-upstream.mjs';

function trapOutboundNetwork() {
  const attempts = [];
  const trap =
    (name) =>
    (...args) => {
      attempts.push(`${name}(${String(args[0] ?? '').slice(0, 120)})`);
      throw new Error(`[aaV-1335 guard] blocked outbound network call: ${name}`);
    };

  const restore = {
    fetch: globalThis.fetch,
    httpRequest: http.request,
    httpsRequest: https.request,
    dnsLookup: dns.lookup,
    dnsPromisesLookup: dns.promises.lookup,
    netConnect: net.connect,
    socketConnect: net.Socket.prototype.connect,
  };

  globalThis.fetch = trap('fetch');
  http.request = trap('http.request');
  https.request = trap('https.request');
  dns.lookup = trap('dns.lookup');
  dns.promises.lookup = trap('dns.promises.lookup');
  net.connect = trap('net.connect');
  net.Socket.prototype.connect = trap('net.Socket.prototype.connect');

  return {
    attempts,
    restore() {
      globalThis.fetch = restore.fetch;
      http.request = restore.httpRequest;
      https.request = restore.httpsRequest;
      dns.lookup = restore.dnsLookup;
      dns.promises.lookup = restore.dnsPromisesLookup;
      net.connect = restore.netConnect;
      net.Socket.prototype.connect = restore.socketConnect;
    },
  };
}

const LOCAL_ENTRY = `    '0xaaaa000000000000000000000000000000000001': {\n      name: 'Local',\n      symbol: 'LOC',\n      iconSymbol: 'loc',\n    },`;
const UPSTREAM_ENTRY = `    '0xbbbb000000000000000000000000000000000002': {\n      name: 'New',\n      symbol: 'NEW',\n      iconSymbol: 'new',\n    },`;

function makeLocal(entries) {
  return [
    "import { AaveV3Ethereum } from '@aave-dao/aave-address-book';",
    '',
    'export function fetchIconSymbolAndName() {',
    '  const underlyingAssetMap: Record<string, IconMapInterface> = {',
    entries,
    '  };',
    '',
    '  return underlyingAssetMap;',
    '}',
    '',
  ].join('\n');
}

function makeUpstream(entries) {
  return `const underlyingAssetMap: Record<string, IconMapInterface> = {\n${entries}\n};\n`;
}

describe('sync-reserve-patches-upstream module is import-hermetic (AAV-1335)', () => {
  it('importing the module performs zero outbound network calls', async () => {
    const network = trapOutboundNetwork();
    try {
      const mod = await import(MODULE_URL);
      assert.equal(typeof mod.applyUnderlyingAssetMapMerge, 'function');

      // Exercising the pure helpers must stay hermetic too — the only network
      // consumer (`fetchWithTimeout`) lives in `main()`, behind `isDirectRun`.
      const merged = mod.applyUnderlyingAssetMapMerge(
        makeLocal(LOCAL_ENTRY),
        makeUpstream(`${LOCAL_ENTRY}\n${UPSTREAM_ENTRY}`),
      );
      assert.equal(merged.addedCount, 1);
    } finally {
      network.restore();
    }

    assert.deepEqual(network.attempts, [], 'module import or helper use attempted real network I/O');
  });

  it('keeps the isDirectRun gate that fixed the original defect', async () => {
    const source = await readFile(MODULE_SOURCE_PATH, 'utf8');

    assert.ok(source.includes('async function main()'), 'main() definition must stay in the module');

    const guardIndex = source.indexOf('if (isDirectRun)');
    const invocationIndex = source.indexOf('main().catch');
    assert.ok(guardIndex > 0, 'main() must stay gated behind `if (isDirectRun)`');
    assert.ok(invocationIndex > guardIndex, 'main() must be invoked inside the isDirectRun block');
    assert.equal(
      source.split('main().catch').length - 1,
      1,
      'exactly one main() invocation — a second call site would run outside the gate',
    );
  });

  it('calls fetchWithTimeout only from inside main()', async () => {
    const source = await readFile(MODULE_SOURCE_PATH, 'utf8');
    const callSites = [...source.matchAll(/fetchWithTimeout\(/g)].map((match) => match.index);
    assert.ok(callSites.length >= 1, 'main() must still download the upstream file');
    const mainIndex = source.indexOf('async function main()');
    for (const callIndex of callSites) {
      assert.ok(callIndex > mainIndex, 'fetchWithTimeout must only be called inside main(), never at module load');
    }
  });
});
