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
    expect(run).toHaveBeenCalledTimes(2);
  });
});
