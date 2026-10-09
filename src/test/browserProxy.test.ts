import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { E2E_PROXY_ENV, browserProxyArgs } from '../../e2e/browserProxy';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** Read a repo file for the wiring-guard rows. */
function source(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

/**
 * Contract rows for the e2e proxy resolver.
 *
 * The bug these rows pin is a *split-brain* proxy config: `E2E_PROXY` reached
 * the test browsers through `use`, but not the prewarm browser that
 * `e2e/global-setup.ts` launches itself, so a slow direct egress aborted the
 * run before any test executed and the documented escape hatch looked broken.
 */
describe('browserProxyArgs', () => {
  it('R1: no E2E_PROXY means no proxy argument at all (CI stays direct)', () => {
    expect(browserProxyArgs({})).toEqual({});
  });

  it('R2: an empty value is treated as unset, not as an invalid proxy server', () => {
    expect(browserProxyArgs({ [E2E_PROXY_ENV]: '' })).toEqual({});
  });

  it('R3: whitespace-only is unset too — never hand Chromium "   " as a server URL', () => {
    expect(browserProxyArgs({ [E2E_PROXY_ENV]: '   ' })).toEqual({});
  });

  it('R4: a real value becomes exactly { proxy: { server } }', () => {
    expect(browserProxyArgs({ [E2E_PROXY_ENV]: 'http://127.0.0.1:7891' })).toEqual({
      proxy: { server: 'http://127.0.0.1:7891' },
    });
  });

  it('R5: surrounding whitespace is trimmed so a copied value still works', () => {
    expect(browserProxyArgs({ [E2E_PROXY_ENV]: '  http://127.0.0.1:7890  ' })).toEqual({
      proxy: { server: 'http://127.0.0.1:7890' },
    });
  });

  it('R6: nothing else is injected, so tests keep Chromium default bypass behaviour', () => {
    const args = browserProxyArgs({ [E2E_PROXY_ENV]: 'http://127.0.0.1:7891' });
    expect(Object.keys(args)).toEqual(['proxy']);
    expect(Object.keys(args.proxy ?? {})).toEqual(['server']);
  });

  it('R7: defaults to the live environment, so callers can use it bare', () => {
    const previous = process.env[E2E_PROXY_ENV];
    try {
      delete process.env[E2E_PROXY_ENV];
      expect(browserProxyArgs()).toEqual({});
      process.env[E2E_PROXY_ENV] = 'http://127.0.0.1:7891';
      expect(browserProxyArgs()).toEqual({ proxy: { server: 'http://127.0.0.1:7891' } });
    } finally {
      if (previous === undefined) delete process.env[E2E_PROXY_ENV];
      else process.env[E2E_PROXY_ENV] = previous;
    }
  });

  it('R8 wiring guard: both consumers resolve the proxy here and neither re-reads the env var', () => {
    const config = source('playwright.config.ts');
    const setup = source('e2e/global-setup.ts');

    expect(config).toContain('browserProxyArgs()');
    expect(setup).toContain('chromium.launch(browserProxyArgs())');
    // A second hand-written read is how the two sides drifted apart in the
    // first place: the test browsers got a proxy, the prewarm browser did not.
    expect(config).not.toContain('process.env.E2E_PROXY');
    expect(setup).not.toContain('process.env.E2E_PROXY');
  });
});
