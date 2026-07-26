import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const WORKFLOW_PATH = resolve(__dirname, '..', '..', '.github', 'workflows', 'ci.yml');

function getJobBlock(workflow: string, jobName: string): string {
  const start = workflow.indexOf(`  ${jobName}:\n`);
  const remainder = workflow.slice(start + 1);
  const nextJob = remainder.search(/\n {2}[A-Za-z0-9_-]+:\n/);
  return workflow.slice(start, nextJob === -1 ? undefined : start + 1 + nextJob);
}

describe('OpenAPI CI workflow guard', () => {
  it('openapi-check uses step-based API target selection', () => {
    const workflow = readFileSync(WORKFLOW_PATH, 'utf8');
    const checkBlock = getJobBlock(workflow, 'openapi-check');

    // Must have a "Determine API target" step
    expect(checkBlock).toContain('Determine API target');
    // Must reference production API for main branch
    expect(checkBlock).toContain('https://api.aaveapy.com/api');
    // Must reference staging API as fallback
    expect(checkBlock).toContain('staging-api.aaveapy.com');
    // Must use step output, not hardcoded env
    expect(checkBlock).toContain('steps.api_target.outputs.api_base');
  });

  it('openapi-sync uses step-based API target selection', () => {
    const workflow = readFileSync(WORKFLOW_PATH, 'utf8');
    const syncBlock = getJobBlock(workflow, 'openapi-sync');

    // Must have a "Determine API target" step
    expect(syncBlock).toContain('Determine API target');
    // Must reference production API for main branch
    expect(syncBlock).toContain('https://api.aaveapy.com/api');
    // Must reference staging API as fallback
    expect(syncBlock).toContain('staging-api.aaveapy.com');
    // Must use step output, not hardcoded env
    expect(syncBlock).toContain('steps.api_target.outputs.api_base');
  });

  it('both openapi-check and openapi-sync use the same API target logic', () => {
    const workflow = readFileSync(WORKFLOW_PATH, 'utf8');
    const checkBlock = getJobBlock(workflow, 'openapi-check');
    const syncBlock = getJobBlock(workflow, 'openapi-sync');

    // Both must have the Determine API target step
    expect(checkBlock).toContain('Determine API target');
    expect(syncBlock).toContain('Determine API target');

    // Both must reference the same production and staging URLs
    expect(checkBlock).toContain('https://api.aaveapy.com/api');
    expect(syncBlock).toContain('https://api.aaveapy.com/api');
  });
});
