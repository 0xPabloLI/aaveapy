import { describe, expect, it } from 'vitest';

import {
  GITHUB_ACTIONS_RULE_NOTE_PREFIX,
  planGithubActionsAllowlistSync,
} from './cloudflare-gh-actions-allowlist.mjs';

describe('planGithubActionsAllowlistSync', () => {
  it('creates missing CIDRs and deletes stale managed rules', () => {
    const plan = planGithubActionsAllowlistSync({
      desiredCidrs: ['4.148.0.0/14', '20.201.28.151/32', '4.148.0.0/14'],
      existingRules: [
        {
          configuration: { target: 'ip_range', value: '20.201.28.151/32' },
          id: 'keep-me',
          mode: 'whitelist',
          notes: `${GITHUB_ACTIONS_RULE_NOTE_PREFIX} (managed)`,
        },
        {
          configuration: { target: 'ip_range', value: '140.82.112.0/20' },
          id: 'delete-me',
          mode: 'whitelist',
          notes: `${GITHUB_ACTIONS_RULE_NOTE_PREFIX} old`,
        },
        {
          configuration: { target: 'ip_range', value: '1.1.1.1/32' },
          id: 'ignore-me',
          mode: 'whitelist',
          notes: 'Manual allowlist',
        },
      ],
    });

    expect(plan.toCreate).toEqual(['4.148.0.0/14']);
    expect(plan.toDelete).toEqual([
      {
        cidr: '140.82.112.0/20',
        id: 'delete-me',
      },
    ]);
  });

  it('ignores non-whitelist or non-ip-range rules', () => {
    const plan = planGithubActionsAllowlistSync({
      desiredCidrs: ['4.148.0.0/14'],
      existingRules: [
        {
          configuration: { target: 'ip', value: '4.148.0.1' },
          id: 'single-ip',
          mode: 'whitelist',
          notes: `${GITHUB_ACTIONS_RULE_NOTE_PREFIX} single`,
        },
        {
          configuration: { target: 'ip_range', value: '4.148.0.0/14' },
          id: 'challenge-rule',
          mode: 'challenge',
          notes: `${GITHUB_ACTIONS_RULE_NOTE_PREFIX} wrong-mode`,
        },
      ],
    });

    expect(plan.toCreate).toEqual(['4.148.0.0/14']);
    expect(plan.toDelete).toEqual([]);
  });
});
