#!/usr/bin/env node
/**
 * Build performance measurement.
 *
 * Runs the production build once, measures wall-clock duration and output
 * sizes (raw + gzip, per chunk), and reports them as:
 *   - a console table (local runs)
 *   - a markdown job summary (CI: $GITHUB_STEP_SUMMARY)
 *   - dist/build-metrics.json (machine-readable, per-run artifact)
 *
 * This makes build duration and bundle weight *deliberate* signals: CI runs
 * it on every PR/push (see ci.yml build job), so a regression in either is
 * visible in the run summary instead of being discovered by users.
 *
 * Usage: node scripts/measure-build.mjs   (or: npm run build:metrics)
 */
import { spawnSync } from 'node:child_process';
import { readdirSync, statSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const ROOT = resolve(import.meta.dirname, '..');
const DIST = join(ROOT, 'dist');

console.log('▶ Running production build…');
const startedAt = Date.now();
const build = spawnSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit' });
const durationMs = Date.now() - startedAt;
if (build.status !== 0) {
  console.error(`❌ Build failed after ${(durationMs / 1000).toFixed(1)}s — nothing to measure.`);
  process.exit(build.status ?? 1);
}

/** @returns {{ path: string, raw: number, gzip: number }[]} */
function collectDistFiles(dir = DIST, prefix = '') {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...collectDistFiles(join(dir, entry.name), rel));
    else if (entry.isFile()) {
      const buf = readFileSync(join(dir, entry.name));
      out.push({ path: rel, raw: buf.length, gzip: gzipSync(buf).length });
    }
  }
  return out;
}

const files = collectDistFiles();
const totalRaw = files.reduce((s, f) => s + f.raw, 0);
const totalGzip = files.reduce((s, f) => s + f.gzip, 0);
const top = [...files].sort((a, b) => b.gzip - a.gzip).slice(0, 10);

const fmt = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

const metrics = {
  timestamp: new Date().toISOString(),
  durationMs,
  totalRawBytes: totalRaw,
  totalGzipBytes: totalGzip,
  files: files.length,
  topGzip: top.map(({ path, raw, gzip }) => ({ path, raw, gzip })),
};

mkdirSync(DIST, { recursive: true });
writeFileSync(join(DIST, 'build-metrics.json'), `${JSON.stringify(metrics, null, 2)}\n`);

const md = [
  '## 🏗️ Build performance',
  '',
  `| Metric | Value |`,
  `| --- | --- |`,
  `| Build duration | **${(durationMs / 1000).toFixed(1)}s** |`,
  `| Output files | ${files.length} |`,
  `| Total size (raw / gzip) | ${fmt(totalRaw)} / ${fmt(totalGzip)} |`,
  '',
  'Top chunks by gzip size:',
  '',
  '| File | raw | gzip |',
  '| --- | --- | --- |',
  ...top.slice(0, 8).map((f) => `| ${f.path} | ${fmt(f.raw)} | ${fmt(f.gzip)} |`),
  '',
].join('\n');

console.log(`\n⏱️  build: ${(durationMs / 1000).toFixed(1)}s · dist: ${fmt(totalRaw)} raw / ${fmt(totalGzip)} gzip`);
console.log(md);

if (process.env.GITHUB_STEP_SUMMARY) {
  writeFileSync(process.env.GITHUB_STEP_SUMMARY, md, { flag: 'a' });
}
