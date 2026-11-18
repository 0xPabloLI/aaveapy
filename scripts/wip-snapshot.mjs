#!/usr/bin/env node
/**
 * wip-snapshot.mjs — pin the working tree as a commit without touching the
 * index or the worktree.
 *
 * Why not `git stash create`: it snapshots tracked changes only. The damage
 * this guards against (`reset --hard`, `clean -fdx`) hits untracked files too,
 * so the tree is built in a throwaway index instead: read-tree HEAD, add -A,
 * write-tree, commit-tree, update-ref refs/wip/<stamp>.
 *
 * Usage:
 *   node scripts/wip-snapshot.mjs [--label <slug>] [--repo <dir>] [--keep <n>] [--dry-run]
 *
 * Exit: 0 = snapshot created or nothing to snapshot, 1 = not a git repo.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const arg = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < argv.length && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};
const label = arg('label');
const repo = arg('repo', process.cwd());
const keep = Number(arg('keep', '10'));
const dryRun = argv.includes('--dry-run');

const git = (args, env = {}) => execFileSync('git', args, { encoding: 'utf8', env: { ...process.env, ...env } }).trim();

let top;
try {
  top = git(['-C', repo, 'rev-parse', '--show-toplevel']);
} catch {
  console.error(`[wip] not a git repository: ${repo}`);
  process.exit(1);
}

const status = git(['-C', top, 'status', '--porcelain', '--untracked-files=all']);
if (!status) {
  console.log(`[wip] clean — nothing to snapshot (${top})`);
  process.exit(0);
}

const changed = status.split('\n').length;
if (dryRun) {
  console.log(`[wip] dry-run: ${changed} path(s) would be snapshotted in ${top}`);
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
const ref = `refs/wip/${stamp}${label ? `-${label.replace(/[^a-zA-Z0-9._-]/g, '-')}` : ''}`;
const head = (() => {
  try {
    return git(['-C', top, 'rev-parse', '--verify', 'HEAD']);
  } catch {
    return null;
  }
})();

const indexDir = mkdtempSync(join(tmpdir(), 'wip-index-'));
const env = { GIT_INDEX_FILE: join(indexDir, 'index') };
try {
  git(['-C', top, 'read-tree', head ? 'HEAD' : '--empty'], env);
  git(['-C', top, 'add', '-A'], env);
  const tree = git(['-C', top, 'write-tree'], env);
  const message = `wip snapshot ${stamp}${label ? ` ${label}` : ''}`;
  const commit = head
    ? git(['-C', top, 'commit-tree', tree, '-p', head, '-m', message])
    : git(['-C', top, 'commit-tree', tree, '-m', message]);
  git(['-C', top, 'update-ref', ref, commit]);

  const refs = git(['-C', top, 'for-each-ref', '--sort=-refname', '--format=%(refname)', 'refs/wip'])
    .split('\n')
    .filter(Boolean);
  for (const stale of refs.slice(Math.max(keep, 1))) git(['-C', top, 'update-ref', '-d', stale]);

  console.log(`[wip] ${ref} ${commit.slice(0, 12)} (${changed} path(s))`);
  console.log(`[wip] inspect: git -C ${top} diff ${commit.slice(0, 12)} -- .`);
  console.log(`[wip] restore: git -C ${top} checkout ${commit.slice(0, 12)} -- .`);
  console.log(`[wip] pin count: ${Math.min(refs.length, keep)} (--keep ${keep})`);
} finally {
  rmSync(indexDir, { recursive: true, force: true });
}
