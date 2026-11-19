#!/usr/bin/env node
/**
 * WIP 快照（`slots/wip-snapshot.md` 的最小实现）。
 *
 * 锁的是边界而不是 happy path：
 *   - 快照不改变现场：真实 index 仍为空、工作树文件仍在（`git stash create` 只覆盖
 *     跟踪改动，`stash push` 以收走改动为代价，两者都不合格）；
 *   - 未跟踪文件必须进快照——2026-11-18 事故里丢的就是未跟踪内容；
 *   - 干净工作树不制造空 ref，`--dry-run` 只报数量；
 *   - 非 git 目录非 0 退出（快照在错的地方静默通过，等于没有兜底）。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('./wip-snapshot.mjs', import.meta.url));

const withRepo = (fn) => {
  const root = mkdtempSync(join(tmpdir(), 'wip-snapshot-'));
  const git = (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).replace(/\n$/, '');
  try {
    git(['init', '-q', '-b', 'main']);
    git([
      '-c',
      'user.email=t@example.com',
      '-c',
      'user.name=t',
      '-c',
      'commit.gpgsign=false',
      'commit',
      '--allow-empty',
      '-m',
      'base',
    ]);
    fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

const run = (root, args = []) =>
  execFileSync(process.execPath, [SCRIPT, '--repo', root, ...args], { encoding: 'utf8' });

const refs = (root) =>
  execFileSync('git', ['for-each-ref', '--format=%(refname)', 'refs/wip'], { cwd: root, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);

test('clean tree creates no ref', () => {
  withRepo((root) => {
    assert.match(run(root), /clean — nothing to snapshot/);
    assert.deepEqual(refs(root), []);
  });
});

test('captures tracked edits and untracked files without touching index or worktree', () => {
  withRepo((root) => {
    writeFileSync(join(root, 'tracked.txt'), 'before\n');
    execFileSync('git', ['add', 'tracked.txt'], { cwd: root });
    execFileSync(
      'git',
      ['-c', 'user.email=t@example.com', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', 'commit', '-m', 'add'],
      {
        cwd: root,
      },
    );
    writeFileSync(join(root, 'tracked.txt'), 'after\n');
    writeFileSync(join(root, 'notes.txt'), 'untracked body\n');

    run(root, ['--label', 'start']);
    const refsNow = refs(root);
    assert.equal(refsNow.length, 1);
    const ref = refsNow[0];
    assert.equal(
      execFileSync('git', ['show', `${ref}:notes.txt`], { cwd: root, encoding: 'utf8' }).trim(),
      'untracked body',
    );
    assert.equal(execFileSync('git', ['show', `${ref}:tracked.txt`], { cwd: root, encoding: 'utf8' }).trim(), 'after');

    // 快照是副本，不是 stash：index 仍为空，工作树改动与未跟踪文件都还在。
    assert.equal(execFileSync('git', ['diff', '--cached', '--name-only'], { cwd: root, encoding: 'utf8' }).trim(), '');
    assert.equal(readFileSync(join(root, 'notes.txt'), 'utf8'), 'untracked body\n');
    assert.match(readFileSync(join(root, 'tracked.txt'), 'utf8'), /after/);
  });
});

test('dry-run reports paths and writes no ref', () => {
  withRepo((root) => {
    writeFileSync(join(root, 'scratch.txt'), 'x\n');
    assert.match(run(root, ['--dry-run']), /dry-run: 1 path/);
    assert.deepEqual(refs(root), []);
  });
});

test('works without ambient git identity', () => {
  const root = mkdtempSync(join(tmpdir(), 'wip-empty-'));
  const emptyHome = mkdtempSync(join(tmpdir(), 'wip-home-'));
  try {
    execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root });
    writeFileSync(join(root, 'notes.txt'), 'untracked body\n');

    const env = {
      ...process.env,
      HOME: emptyHome,
      XDG_CONFIG_HOME: emptyHome,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_CONFIG_SYSTEM: '/dev/null',
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'user.useConfigOnly',
      GIT_CONFIG_VALUE_0: 'true',
    };
    for (const key of ['GIT_AUTHOR_NAME', 'GIT_AUTHOR_EMAIL', 'GIT_COMMITTER_NAME', 'GIT_COMMITTER_EMAIL']) {
      delete env[key];
    }

    execFileSync(process.execPath, [SCRIPT, '--repo', root], { encoding: 'utf8', env });
    assert.equal(refs(root).length, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(emptyHome, { recursive: true, force: true });
  }
});

test('exits non-zero outside a git repository', () => {
  const plain = mkdtempSync(join(tmpdir(), 'wip-plain-'));
  try {
    assert.throws(
      () => execFileSync(process.execPath, [SCRIPT, '--repo', plain], { encoding: 'utf8', stdio: 'pipe' }),
      /not a git repository/,
    );
  } finally {
    rmSync(plain, { recursive: true, force: true });
  }
});
