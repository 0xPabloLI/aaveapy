import path from 'path';
import { execFileSync } from 'child_process';

export function runIconManifestGenerators({
  nodeExecutable = process.execPath,
  rootDir = process.cwd(),
  run = execFileSync,
} = {}) {
  const scripts = [
    path.join(rootDir, 'scripts', 'generate-token-icon-manifest.mjs'),
    path.join(rootDir, 'scripts', 'generate-chain-icon-manifest.mjs'),
    path.join(rootDir, 'scripts', 'generate-explorer-icon-manifest.mjs'),
    path.join(rootDir, 'scripts', 'generate-pt-icon-fallback.mjs'),
  ];

  for (const scriptPath of scripts) {
    run(nodeExecutable, [scriptPath], { stdio: 'inherit' });
  }
}
