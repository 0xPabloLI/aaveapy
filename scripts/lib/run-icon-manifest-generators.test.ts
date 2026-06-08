import path from 'path';

import { describe, expect, it, vi } from 'vitest';

import { runIconManifestGenerators } from './run-icon-manifest-generators.mjs';

describe('runIconManifestGenerators', () => {
  it('runs token then chain manifest generators with the current node executable', () => {
    const run = vi.fn();

    runIconManifestGenerators({
      nodeExecutable: '/custom/node',
      rootDir: '/repo',
      run,
    });

    expect(run).toHaveBeenNthCalledWith(
      1,
      '/custom/node',
      [path.join('/repo', 'scripts', 'generate-token-icon-manifest.mjs')],
      { stdio: 'inherit' }
    );
    expect(run).toHaveBeenNthCalledWith(
      2,
      '/custom/node',
      [path.join('/repo', 'scripts', 'generate-chain-icon-manifest.mjs')],
      { stdio: 'inherit' }
    );
    const calledPaths = (run as unknown as ReturnType<typeof vi.fn>).mock.calls
      .map(([, args]) => (args as string[])[0])
      .filter((p): p is string => typeof p === 'string');
    expect(calledPaths).toEqual(
      expect.arrayContaining([
        path.join('/repo', 'scripts', 'generate-token-icon-manifest.mjs'),
        path.join('/repo', 'scripts', 'generate-chain-icon-manifest.mjs'),
        path.join('/repo', 'scripts', 'generate-explorer-icon-manifest.mjs'),
        path.join('/repo', 'scripts', 'generate-pt-icon-fallback.mjs'),
      ]),
    );
    expect(run).toHaveBeenCalledTimes(4);
  });
});
