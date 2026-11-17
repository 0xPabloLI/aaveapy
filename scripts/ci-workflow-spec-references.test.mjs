#!/usr/bin/env node
/**
 * Guard: workflows must not reference Playwright spec files that no longer exist,
 * and must not write pixel baselines (AAV-1334).
 *
 * The bug this pins: `generate-snapshots` was `workflow_dispatch`-only, so push/PR
 * CI skipped it forever. It kept pointing at two visual specs deleted in `7c48ae01`,
 * making every manual CI dispatch fail with "No tests found" while the normal gates
 * stayed green.
 *
 * Row numbers refer to the Scenario & Risk Verification Matrix in
 * docs/specs/aav-1334-remove-dead-generate-snapshots-job.md.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  extractPlaywrightTestCommands,
  extractSpecPaths,
  findMissingWorkflowSpecPaths,
  findSnapshotUpdateCommands,
} from './lib/workflow-playwright-specs.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const WORKFLOW_DIR = join(ROOT, '.github', 'workflows');
const workflowFiles = readdirSync(WORKFLOW_DIR).filter((file) => /\.ya?ml$/.test(file));
const workflows = Object.fromEntries(
  workflowFiles.map((file) => [file, readFileSync(join(WORKFLOW_DIR, file), 'utf8')]),
);
const existsFromRoot = (specPath) => existsSync(join(ROOT, specPath));
const allCommands = Object.values(workflows).flatMap((source) => extractPlaywrightTestCommands(source));

/** The exact command that made manual dispatches fail, kept as a positive control. */
const DEAD_JOB_FIXTURE = `
jobs:
  generate-snapshots:
    if: github.event_name == 'workflow_dispatch'
    steps:
      - name: Generate Linux screenshot baselines
        run: npx playwright test e2e/segmented-toggle-visual.spec.ts e2e/portfolio-panel-header-visual.spec.ts --update-snapshots
`;

describe('AAV-1334 command extraction', () => {
  it('extracts explicit specs from the historical dead-job command (S1)', () => {
    const commands = extractPlaywrightTestCommands(DEAD_JOB_FIXTURE);
    assert.equal(commands.length, 1);
    assert.deepEqual(extractSpecPaths(commands[0].command), [
      'e2e/segmented-toggle-visual.spec.ts',
      'e2e/portfolio-panel-header-visual.spec.ts',
    ]);
  });

  it('ignores `playwright install` and commented-out commands (S5)', () => {
    const source = [
      '      - name: Install Playwright browsers',
      '        run: npx playwright install --with-deps chromium',
      '      # npx playwright test e2e/commented-out.spec.ts',
    ].join('\n');
    assert.deepEqual(extractPlaywrightTestCommands(source), []);
  });

  it('handles quoted specs and shell continuations (S6)', () => {
    const source = [
      '        run: |',
      '          npx playwright test "e2e/first.spec.ts"; \\',
      '            e2e/second.spec.ts',
    ].join('\n');
    const commands = extractPlaywrightTestCommands(source);
    assert.equal(commands.length, 1);
    assert.deepEqual(extractSpecPaths(commands[0].command), ['e2e/first.spec.ts', 'e2e/second.spec.ts']);
  });

  it('treats whole-suite invocations as having no explicit specs (S4)', () => {
    const commands = extractPlaywrightTestCommands(
      '        run: npx playwright test --project=chromium --shard=${{ matrix.shard }}/${{ matrix.total }}',
    );
    assert.equal(commands.length, 1);
    assert.deepEqual(extractSpecPaths(commands[0].command), []);
  });

  it('does not check glob patterns for existence (S10)', () => {
    const source = '        run: npx playwright test e2e/*.spec.ts';
    assert.deepEqual(
      findMissingWorkflowSpecPaths({ 'ci.yml': source }, () => false),
      [],
    );
  });

  it('does not treat option values as spec paths (--grep) (S5)', () => {
    const commands = extractPlaywrightTestCommands('        run: npx playwright test --grep "e2e/deleted.spec.ts"');
    assert.equal(commands.length, 1);
    assert.deepEqual(extractSpecPaths(commands[0].command), []);
  });

  it('recognises package-manager prefixed invocations (S7)', () => {
    const source = '        run: pnpm exec playwright test e2e/deleted.spec.ts';
    assert.equal(findMissingWorkflowSpecPaths({ 'ci.yml': source }, () => false).length, 1);
  });
});

describe('AAV-1334 missing-spec detection', () => {
  it('reports both deleted visual specs from the historical job (S1, S7)', () => {
    const violations = findMissingWorkflowSpecPaths({ 'ci.yml': DEAD_JOB_FIXTURE }, () => false);
    assert.deepEqual(
      violations.map((violation) => violation.path),
      ['e2e/segmented-toggle-visual.spec.ts', 'e2e/portfolio-panel-header-visual.spec.ts'],
    );
    assert.ok(violations.every((violation) => violation.workflow === 'ci.yml'));
  });

  it('does not report specs that exist (S4)', () => {
    const source = '        run: npx playwright test e2e/segmented-toggle.spec.ts';
    assert.deepEqual(
      findMissingWorkflowSpecPaths({ 'ci.yml': source }, () => true),
      [],
    );
  });

  it('the real workflow tree has no missing spec references (S2, S3, S7)', () => {
    assert.deepEqual(findMissingWorkflowSpecPaths(workflows, existsFromRoot), []);
  });

  it('the scan is not vacuous: it reads the workflow directory and finds commands (S9)', () => {
    assert.ok(workflowFiles.length >= 10, `expected ≥10 workflow files, scanned ${workflowFiles.length}`);
    assert.ok(
      allCommands.length >= 2,
      `expected ≥2 playwright test commands in the real workflows, found ${allCommands.length}`,
    );
  });
});

describe('AAV-1334 retired pixel baselines', () => {
  it('reports --update-snapshots, its mode form, and -u (S8)', () => {
    const source = [
      '        run: npx playwright test --update-snapshots',
      '        run: npx playwright test --update-snapshots=all',
      '        run: npx playwright test -u',
    ].join('\n');
    const violations = findSnapshotUpdateCommands({ 'ci.yml': source });
    assert.equal(violations.length, 3);
  });

  it('the real workflow tree never writes pixel baselines (S8)', () => {
    assert.deepEqual(findSnapshotUpdateCommands(workflows), []);
  });

  it('the dead dispatch-only job is gone from ci.yml (S2)', () => {
    const ci = workflows['ci.yml'];
    assert.ok(ci, 'ci.yml must exist');
    assert.ok(!/^\s{2}generate-snapshots:/m.test(ci), 'generate-snapshots must not be a job in ci.yml');
    assert.ok(!/linux-screenshot-baselines/.test(ci), 'the dead job artifact must not be produced');
  });
});
