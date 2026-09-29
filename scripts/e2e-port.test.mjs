#!/usr/bin/env node
/**
 * Behaviour tests for the e2e webServer port resolver.
 *
 * `it` titles carry the row numbers of the Behavioral Scenarios matrix in
 * docs/specs/e2e-parallel-port-isolation.md, so each obligation is traceable
 * to the test that discharges it.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { DEFAULT_E2E_PORT, e2eBaseUrl, e2eDevServerCommand, resolveE2ePort } from './lib/e2e-port.mjs';

/** True when nothing is listening on 127.0.0.1:port (i.e. it can be bound). */
async function isBindable(port) {
  const server = net.createServer();
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', resolve);
    });
    return true;
  } catch {
    return false;
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

describe('resolveE2ePort', () => {
  it('row 1: pins the default port in CI and does not write back to env', async () => {
    const env = { CI: 'true' };
    assert.equal(await resolveE2ePort(env), DEFAULT_E2E_PORT);
    assert.equal(env.E2E_PORT, undefined);
  });

  it('row 2: honours an explicit E2E_PORT without rewriting it', async () => {
    const env = { E2E_PORT: '4500' };
    assert.equal(await resolveE2ePort(env), 4500);
    assert.equal(env.E2E_PORT, '4500');
  });

  it('row 3: allocates a non-default port locally and publishes it to env', async () => {
    const env = {};
    const port = await resolveE2ePort(env);
    assert.notEqual(port, DEFAULT_E2E_PORT);
    assert.equal(Number(env.E2E_PORT), port);
  });

  it('row 4: re-resolving the same env reuses the published port (runner/worker parity)', async () => {
    const env = {};
    const first = await resolveE2ePort(env);
    const second = await resolveE2ePort(env);
    assert.equal(second, first);
  });

  it('row 5: rejects malformed E2E_PORT by name instead of coercing', async () => {
    for (const value of ['abc', '0', '70000', '-1', '41.5']) {
      await assert.rejects(() => resolveE2ePort({ E2E_PORT: value }), /E2E_PORT/, `accepted ${value}`);
    }
  });

  it('row 6: leaves no listener behind on the port it returns', async () => {
    const port = await resolveE2ePort({});
    assert.equal(await isBindable(port), true);
  });

  it('row 7: two concurrent runs resolve different ports', async () => {
    const [a, b] = await Promise.all([resolveE2ePort({}), resolveE2ePort({})]);
    assert.notEqual(a, b);
  });

  it('row 11: refuses an E2E_PORT that contradicts the pinned CI server', async () => {
    await assert.rejects(() => resolveE2ePort({ CI: 'true', E2E_PORT: '4500' }), /E2E_PORT/);
  });

  it('row 12: treats an empty E2E_PORT as unset', async () => {
    const env = { E2E_PORT: '' };
    const port = await resolveE2ePort(env);
    assert.equal(Number(env.E2E_PORT), port);
  });
});

describe('e2eBaseUrl / e2eDevServerCommand', () => {
  it('row 8: builds the one origin string shared by baseURL and storageState', () => {
    assert.equal(e2eBaseUrl(4173), 'http://127.0.0.1:4173');
    assert.equal(e2eBaseUrl(4500), 'http://127.0.0.1:4500');
  });

  it('row 10: starts Vite strict, so a stolen allocation fails by name', () => {
    assert.match(e2eDevServerCommand(4500), /^npm run dev:staging -- --host 127\.0\.0\.1 --port 4500 --strictPort$/);
  });
});
