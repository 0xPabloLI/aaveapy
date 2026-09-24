#!/usr/bin/env node
// Hardcode chain runner: executes the hardcode:sync / hardcode:verify sub-command
// chains WITHOUT short-circuiting (`&&` chains stop at the first failure and take
// every later asset down with them — the #629 single point of failure), then
// aggregates results with the gate-tiering protocol:
//
//   0            clean
//   2            data gap (structural health confirmed, manual follow-up item) — advisory
//   any other    critical (structural failure) — blocks the bot PR
//
// Fail-closed: unknown exit codes / signal kills are classified as critical.
import { readFile, appendFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGE_JSON_PATH = path.join(ROOT, 'package.json');

export const CHAINS = {
  sync: [
    'npm run sync:reserve-patches-upstream',
    'npm run sync:market-name-map-upstream',
    'npm run sync:chain-icons-upstream',
    'npm run sync:chain-network-icons-upstream',
    'node scripts/generate-chain-icon-manifest.mjs',
    'npm run sync:coingecko-platform-map',
    'npm run sync-token-icons',
    'npm run sync:pool-addresses-upstream',
  ],
  verify: [
    'node scripts/generate-icon-manifests.mjs',
    'npm run check:hardcode-icons',
    'npm run check:reserve-patches-upstream',
    'npm run check:market-name-map-upstream',
    'npm run check:chain-icons-upstream',
    'npm run check:coingecko-platform-map-upstream',
    'npm run sync-token-icons -- --check',
    'npm run check:pool-addresses-upstream',
    'npm run check:chain-registry-upstream',
  ],
};

export function aggregate(results) {
  const criticals = results.filter((r) => r.code !== 0 && r.code !== 2);
  const gaps = results.filter((r) => r.code === 2);
  return {
    exitCode: criticals.length > 0 ? 1 : 0,
    criticals,
    gaps,
  };
}

export function extractNpmScriptNames(commands) {
  const names = [];
  for (const command of commands) {
    const match = command.match(/^npm run (\S+)/);
    if (match) names.push(match[1]);
  }
  return names;
}

export function formatGithubOutput({ hasGaps, gaps }) {
  const lines = [`has_gaps=${hasGaps ? 'true' : 'false'}`];
  if (hasGaps && gaps.length > 0) {
    lines.push('gap_summary<<EOF');
    for (const g of gaps) {
      lines.push(`${g.command} (exit ${g.code})`);
    }
    lines.push('EOF');
  }
  return `${lines.join('\n')}\n`;
}

export async function runChain({
  chainName,
  chains = CHAINS,
  scripts,
  spawnImpl,
  githubOutputPath,
  appendFileImpl = appendFile,
  log = console.log,
}) {
  const commands = chains[chainName];
  if (!Array.isArray(commands) || commands.length === 0) {
    throw new Error(`Unknown hardcode chain: '${chainName}'`);
  }

  // Guard: every npm script referenced by the chain must exist in package.json,
  // otherwise a renamed script would silently turn into a spawn failure.
  const missing = extractNpmScriptNames(commands).filter((name) => !scripts?.[name]);
  if (missing.length > 0) {
    const errors = [
      `Chain '${chainName}' references missing npm scripts: ${missing.join(', ')}`,
      'Update scripts/hardcode-chain-runner.mjs CHAINS to match package.json.',
    ];
    errors.forEach((e) => console.error(e));
    return { exitCode: 1, criticals: [], gaps: [], errors };
  }

  const results = [];
  for (let i = 0; i < commands.length; i++) {
    const command = commands[i];
    log(`[hardcode-chain:${chainName}] [${i + 1}/${commands.length}] ${command}`);
    const { code } = await spawnImpl(command);
    results.push({ command, code });
    log(`[hardcode-chain:${chainName}] [${i + 1}/${commands.length}] ${command} → exit ${code}`);
  }

  const { exitCode, criticals, gaps } = aggregate(results);

  if (gaps.length > 0) {
    console.log(`\nData gaps (advisory, PR will be labeled incomplete-asset):`);
    for (const g of gaps) {
      console.log(`- ${g.command} (exit 2)`);
    }
    console.log('::warning::' + `hardcode chain '${chainName}' has ${gaps.length} data gap(s); see log above.`);
  }

  if (criticals.length > 0) {
    console.error(`\nCritical failures (blocking):`);
    for (const c of criticals) {
      console.error(`- ${c.command} (exit ${c.code})`);
    }
  }

  if (githubOutputPath) {
    const output = formatGithubOutput({ hasGaps: gaps.length > 0, gaps });
    await appendFileImpl(githubOutputPath, output);
  }

  return { exitCode, criticals, gaps, errors: [] };
}

function spawnShell(command) {
  return new Promise((resolve) => {
    const child = spawn(command, { shell: true, stdio: 'inherit' });
    child.on('close', (code) => resolve({ code }));
    child.on('error', () => resolve({ code: 1 }));
  });
}

async function main() {
  const args = process.argv.slice(2);
  const chainName = args.find((a) => !a.startsWith('--'));
  const wantsGithubOutput = args.includes('--github-output');

  if (!chainName) {
    console.error('Usage: node scripts/hardcode-chain-runner.mjs <sync|verify> [--github-output]');
    process.exit(1);
  }

  const pkg = JSON.parse(await readFile(PACKAGE_JSON_PATH, 'utf8'));
  const { exitCode } = await runChain({
    chainName,
    scripts: pkg.scripts,
    spawnImpl: spawnShell,
    githubOutputPath: wantsGithubOutput ? process.env.GITHUB_OUTPUT : undefined,
  });
  process.exit(exitCode);
}

// Direct-run guard: importing this module from tests must not execute main().
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack || error.message : String(error));
    process.exit(1);
  });
}
