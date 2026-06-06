import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(__dirname, '..', '..');
const WORKFLOW_PATH = resolve(REPO_ROOT, '.github', 'workflows', 'ci-auto-remediation.yml');

function readWorkflow(): string {
  return readFileSync(WORKFLOW_PATH, 'utf8');
}

describe('CI auto-remediation workflow guard', () => {
  it('ci-auto-remediation.yml exists as a separate workflow', () => {
    expect(existsSync(WORKFLOW_PATH), `${WORKFLOW_PATH} must exist`).toBe(true);
  });

  it('has concurrency group with cancel-in-progress', () => {
    const yaml = readWorkflow();
    expect(yaml).toMatch(/concurrency:/);
    expect(yaml).toMatch(/cancel-in-progress:\s*true/);
  });

  it('concurrency group key includes branch identifier for dedup', () => {
    const yaml = readWorkflow();
    expect(yaml).toMatch(/group:.*ci-auto-remediation-/);
  });

  it('skips remediation when CI failure contains ERESOLVE', () => {
    const yaml = readWorkflow();
    expect(yaml).toMatch(/ERESOLVE/);
    expect(yaml).toMatch(/skip/);
  });

  it('skips remediation when peer-dep-check fails (peer dep conflict)', () => {
    const yaml = readWorkflow();
    expect(yaml).toMatch(/peer-dep-check/);
  });

  it('triggers on workflow_run from CI workflow', () => {
    const yaml = readWorkflow();
    expect(yaml).toMatch(/workflow_run:/);
    expect(yaml).toMatch(/workflows:\s*\[\s*["']CI["']/);
  });

  it('workflow_run branches allow list does not include bot/** (prevents infinite loop)', () => {
    const yaml = readWorkflow();
    const branchesMatch = yaml.match(/branches:\s*\n((?:\s*-\s*.+\n?)+)/);
    expect(branchesMatch, 'workflow_run.branches section must exist').toBeTruthy();
    const branchesList = branchesMatch![1];
    expect(branchesList, 'allow list must not contain bot/** patterns').not.toMatch(/bot\//);
  });

  it('declares actions:read permission for log download', () => {
    const yaml = readWorkflow();
    expect(yaml).toMatch(/actions:\s*read/);
  });

  it('creates PR with delete-branch:true to avoid orphan branches', () => {
    const yaml = readWorkflow();
    expect(yaml).toMatch(/delete-branch:\s*true/);
  });

  it('auto-merge uses SQUASH method (not MERGE)', () => {
    const yaml = readWorkflow();
    expect(yaml).toMatch(/mergeMethod:\s*SQUASH/);
  });
});
