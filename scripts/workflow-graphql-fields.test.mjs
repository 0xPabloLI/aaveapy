#!/usr/bin/env node
/**
 * Drift guard for the auto-merge GraphQL selection in our workflows.
 *
 * Why this exists: `sync-dev-with-main.yml` opened its ancestry PR but the
 * `enablePullRequestAutoMerge` call was rejected, because the mutation selected
 * `autoMergeRequest { enabledUntil }` — `enabledUntil` is an *argument* name, not a
 * field on the `AutoMergeRequest` type. GraphQL validates the whole document first,
 * so an unknown field means the mutation never executes: the PR exists, auto-merge is
 * unset, and the workflow still reports success (it only warns). Every release then
 * needs a human to click Merge, which is exactly what this job was written to avoid.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LEGAL_AUTO_MERGE_FIELDS,
  extractAutoMergeSelections,
  findIllegalAutoMergeFields,
} from './lib/workflow-graphql-fields.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const syncWorkflow = readFileSync(path.join(repoRoot, '.github/workflows/sync-dev-with-main.yml'), 'utf8');

describe('workflow auto-merge GraphQL selection', () => {
  it('the guard is not vacuous: the sync workflow really selects on autoMergeRequest', () => {
    const selections = extractAutoMergeSelections(syncWorkflow);
    assert.ok(
      selections.length >= 1,
      'sync-dev-with-main.yml must contain an autoMergeRequest selection, or this test proves nothing',
    );
    assert.ok(
      /enablePullRequestAutoMerge/.test(syncWorkflow),
      'and it must be inside the enablePullRequestAutoMerge mutation',
    );
  });

  it('every field it selects exists on AutoMergeRequest', () => {
    const violations = findIllegalAutoMergeFields(syncWorkflow);
    assert.deepEqual(violations, [], `unknown fields reject the whole mutation: ${violations.join(', ')}`);
  });

  it('a non-existent field IS reported (positive control — the bug being pinned)', () => {
    const broken =
      'mutation { enablePullRequestAutoMerge(input: $i) { pullRequest { autoMergeRequest { enabledUntil } } } }';
    assert.deepEqual(findIllegalAutoMergeFields(broken), ['enabledUntil']);
  });

  it('nested selection sets are not flattened into the outer field list', () => {
    const nested = 'autoMergeRequest { enabledAt enabledBy { login } mergeMethod }';
    assert.deepEqual(extractAutoMergeSelections(nested), [['enabledAt', 'enabledBy', 'mergeMethod']]);
    assert.deepEqual(findIllegalAutoMergeFields(nested), []);
  });

  it('the pinned legal list carries the fields the workflow relies on', () => {
    for (const f of ['enabledAt', 'mergeMethod']) {
      assert.ok(LEGAL_AUTO_MERGE_FIELDS.includes(f), `legal list must include ${f}`);
    }
  });
});
