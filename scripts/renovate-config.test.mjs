#!/usr/bin/env node
/**
 * Drift guard for renovate.json.
 *
 * Every rule asserted here corresponds to a decision that was already made and
 * then silently deformed once, usually by a config edit that kept the labels but
 * dropped the matchers:
 *
 * - the eslint ceiling landed on `@eslint/js` only, so an `eslint` v10 PR stayed
 *   possible (Dependency Dashboard listed `update dependency eslint to v10` on
 *   2026-10-09) — and `eslint-plugin-import` peers up to ^9, so that PR fails the
 *   strict `npm ci` behind dev's required `peer-dep-check`;
 * - dev's first Renovate config omitted `matchManagers` on the automerge rules,
 *   which would have put runtime dependencies on the automerge path (AAV-1301-era
 *   ruling is: only direct devDependencies, patch/minor);
 * - Node lives in two places (workflow `node-version` and the Dev Container
 *   image tag), and a bump that moved only one desynchronised CI from Codespaces.
 *
 * Config-only assertions: no network, no npm registry lookups.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(readFileSync(path.join(repoRoot, 'renovate.json'), 'utf8'));
const rules = config.packageRules ?? [];

/** Find the first rule whose description starts with the given marker. */
function ruleWhere(predicate) {
  return rules.find(predicate);
}

describe('renovate.json — ceilings and release gates', () => {
  it('the eslint ceiling caps BOTH @eslint/js and eslint, not half the pair', () => {
    const rule = ruleWhere((r) => r.allowedVersions === '<10');
    assert.ok(rule, 'an allowedVersions "<10" rule must exist');
    assert.deepEqual(
      [...rule.matchPackageNames].sort(),
      ['@eslint/js', 'eslint'],
      'eslint itself must be inside the ceiling: eslint-plugin-import peers up to ^9 only',
    );
    assert.deepEqual(rule.matchManagers, ['npm'], 'the ceiling must be npm-scoped');
  });

  it('automerge-bearing rules are manager-scoped (no accidental runtime-dep auto-merge)', () => {
    const automergeRules = rules.filter((r) => (r.labels ?? []).includes('automerge'));
    assert.ok(automergeRules.length >= 2, 'expected both the actions and the npm dev-dep rules');
    for (const rule of automergeRules) {
      assert.ok(rule.matchManagers, `rule "${rule.description?.slice(0, 40)}…" lacks matchManagers`);
      if (rule.matchManagers.includes('npm')) {
        assert.deepEqual(rule.matchDepTypes, ['devDependencies'], 'npm automerge stays devDependencies-only');
        assert.deepEqual([...rule.matchUpdateTypes].sort(), ['minor', 'patch'], 'npm automerge stays minor/patch only');
      }
    }
  });

  it('runtime dependencies never carry the automerge label', () => {
    const runtimeRules = rules.filter((r) => (r.matchDepTypes ?? []).includes('dependencies'));
    assert.ok(runtimeRules.length >= 1, 'the runtime-dependency rule must exist');
    for (const rule of runtimeRules) {
      assert.ok((rule.labels ?? []).includes('manual-review'), 'runtime deps must be manual-review');
      assert.ok(!(rule.labels ?? []).includes('automerge'), 'runtime deps must never be automerge');
    }
  });

  it('lockFileMaintenance stays off — routine npm churn belongs to hardcode-sync', () => {
    assert.equal(config.lockFileMaintenance?.enabled, false);
  });

  it('vitest and @vitest/* are grouped, so a major cannot arrive half-applied', () => {
    const rule = ruleWhere((r) => r.groupName === 'vitest');
    assert.ok(rule, 'a vitest family grouping rule must exist');
    for (const name of ['vitest', '/^@vitest\\//']) {
      assert.ok(rule.matchPackageNames.includes(name), `grouping must cover ${name}`);
    }
    assert.deepEqual(rule.matchManagers, ['npm']);
  });

  it('Node is grouped across its two sources of truth (workflow + devcontainer)', () => {
    const rule = ruleWhere((r) => r.groupName === 'node runtime');
    assert.ok(rule, 'the node runtime grouping rule must exist');
    for (const ds of ['node', 'docker']) {
      assert.ok(rule.matchDatasources.includes(ds), `grouping must cover datasource ${ds}`);
    }
    assert.ok(
      rule.matchPackageNames.some((n) => /typescript-node/.test(n)),
      'the Dev Container image tag must be inside the node group',
    );
  });

  it('minimumReleaseAge needs timestamp-optional once devcontainer is enabled', () => {
    assert.ok(config.enabledManagers.includes('devcontainer'), 'devcontainer is in scope');
    assert.equal(
      config.minimumReleaseAgeBehaviour,
      'timestamp-optional',
      'MCR/GHCR tags carry no push timestamp; the default timestamp-required would park these updates forever',
    );
  });

  it('config is read from the default branch, so baseBranchPatterns points at dev', () => {
    assert.deepEqual(config.baseBranchPatterns, ['dev']);
    assert.deepEqual(config.enabledManagers.sort(), ['devcontainer', 'github-actions', 'npm']);
  });
});
