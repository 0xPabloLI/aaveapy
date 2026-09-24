#!/usr/bin/env node
/**
 * Generates public/health.json — the runtime liveness endpoint for uptime
 * monitors (Better Uptime, UptimeRobot, Vercel checks, …).
 *
 * The file is generated at build time (gitignored — it carries the build
 * timestamp) so a monitor hitting /health.json verifies three things at once:
 *   1. the CDN/edge still serves the deployment (transport liveness)
 *   2. the deployed bundle matches a real build (stale-cache detection)
 *   3. which commit is live (deploy verification; pairs with the
 *      aaveapy-deploy-sha meta injected by vite.config.ts)
 *
 * Wire into: `npm run build` (see package.json) and the post-deploy smoke
 * test (.github/workflows/deployment-smoke-test.yml).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

let commitSha = '';
try {
  commitSha = execSync('git rev-parse --short HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
} catch {
  commitSha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || 'unknown';
}

const payload = {
  status: 'ok',
  app: pkg.name,
  version: pkg.version,
  commit: commitSha,
  builtAt: new Date().toISOString(),
};

mkdirSync(join(ROOT, 'public'), { recursive: true });
writeFileSync(join(ROOT, 'public/health.json'), `${JSON.stringify(payload, null, 2)}\n`);
console.log(`✓ public/health.json (v${payload.version} @ ${payload.commit})`);
