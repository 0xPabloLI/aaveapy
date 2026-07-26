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

function getLiveApiBase(jobBlock: string): string | undefined {
  return jobBlock.match(/LIVE_API_BASE:\s*(.+)/)?.[1]?.trim();
}

describe('OpenAPI CI workflow guard', () => {
  it('checks and syncs the OpenAPI spec against the same backend', () => {
    const workflow = readFileSync(WORKFLOW_PATH, 'utf8');
    const checkApiBase = getLiveApiBase(getJobBlock(workflow, 'openapi-check'));
    const syncApiBase = getLiveApiBase(getJobBlock(workflow, 'openapi-sync'));

    expect(checkApiBase).toBe(
      "${{ secrets.LIVE_TEST_API_BASE_CI || 'https://staging-api.aaveapy.com/api' }}",
    );
    expect(syncApiBase).toBe(checkApiBase);
  });
});
