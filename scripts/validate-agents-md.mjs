#!/usr/bin/env node
/**
 * AGENTS.md freshness validation.
 *
 * AGENTS.md drives every agent session in this repo, so stale references are
 * variance bugs: a command that no longer exists or a doc path that moved
 * silently derails agents. This check extracts
 *
 *   1. `npm run <name>` commands          → must exist in package.json scripts
 *   2. repo paths in backticks (docs/, scripts/, src/, e2e/, public/, supabase/)
 *                                          → must exist on disk
 *
 * and fails with the full list of broken references. Wired into CI
 * (content-security-adjacent job) and the pre-commit hook.
 *
 * Usage: node scripts/validate-agents-md.mjs
 */
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const AGENTS_MD = resolve(ROOT, 'AGENTS.md');

const content = readFileSync(AGENTS_MD, 'utf8');

const errors = [];

// ── 1. npm run <name> references ──
// Strip fenced code blocks first: multi-command blocks (e.g. the validation
// gate) are verified by running the gate in CI, not name-by-name here.
const prose = content.replace(/```[\s\S]*?```/g, '');

const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));
const scripts = Object.keys(pkg.scripts ?? {});

const npmRunPattern = /`npm run ([a-z0-9:._-]+)[` ]/g;
for (const match of prose.matchAll(npmRunPattern)) {
  const name = match[1];
  if (!scripts.includes(name)) {
    errors.push(`AGENTS.md references "npm run ${name}" but package.json has no such script`);
  }
}

// ── 2. repo path references in backticks ──
const pathPattern = /`((?:docs|scripts|src|e2e|public|supabase)\/[A-Za-z0-9_\-./]+)`/g;
for (const match of prose.matchAll(pathPattern)) {
  const relPath = match[1].replace(/\.$/, ''); // trailing "…" style truncation guard
  if (relPath.length < 4) continue;
  const abs = resolve(ROOT, relPath);
  if (!existsSync(abs)) {
    errors.push(`AGENTS.md references "${relPath}" but the path does not exist`);
    continue;
  }
  // Directory references should not point at files (and vice versa) so the
  // prose stays unambiguous for agents reading it.
  const isDir = statSync(abs).isDirectory();
  if (!isDir && relPath.endsWith('/')) {
    errors.push(`AGENTS.md references "${relPath}" with a trailing slash but it is a file`);
  }
}

if (errors.length > 0) {
  console.error('❌ AGENTS.md is stale:');
  for (const e of errors) console.error(`   - ${e}`);
  console.error(`\nFix AGENTS.md (or the repo) and re-run: node scripts/validate-agents-md.mjs`);
  process.exit(1);
}

console.log('✅ AGENTS.md references are consistent (scripts + paths).');
