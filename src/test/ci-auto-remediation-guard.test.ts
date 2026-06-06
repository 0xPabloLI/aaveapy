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

  it('does not run on its own bot branches (prevents infinite loop)', () => {
    const yaml = readWorkflow();
    expect(yaml).toMatch(/bot\/ci-auto-remediation-/);
  });
});
