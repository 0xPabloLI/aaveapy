# ADR 0023: Auto-Merge Enable-Early

## Status

Accepted

## Context

Bot PRs (hardcode-sync, dependabot) with the `automerge` label never auto-merged. The `automerge.yml` workflow used a "wait-then-enable" strategy: sleep 180s → poll checks until stable → call `enablePullRequestAutoMerge`. By the time enable was attempted, CI had already passed and the PR transitioned to `CLEAN`/`UNSTABLE`, causing GitHub to reject the mutation with `unstable status`. The `hardcode-sync.yml` workflow had no auto-merge step at all — it relied entirely on `automerge.yml`.

The repository already had a working enable-early pattern in `ci-auto-remediation.yml` (lines 171-215): approve + enable immediately after PR creation, before CI completes. Dependabot PRs also succeeded because they enable early natively.

## Decision

### 1. Enable-early over wait-then-enable

Enable auto-merge while the PR is still `BLOCKED` (required checks pending). GitHub's auto-merge mechanism then waits for checks/reviews to pass and merges automatically. No workflow sleep or polling needed.

**Trade-off**: We lose the "guarantee" that review bots (e.g., CodeRabbit) have completed before enabling. However, auto-merge itself won't fire until review requirements are satisfied, so this is safe.

### 2. Required status checks as the gate, not workflow sleep

Instead of sleeping 180s to wait for checks, rely on GitHub's branch protection required status checks. GitHub enforces these for both auto-merge and manual merge. Workflow sleep is redundant and unreliable.

**Trade-off**: Non-required checks (e.g., CodeQL, Socket Security) could be bypassed by auto-merge. Mitigation: promote critical security checks to required status checks (separate decision, not part of this ADR).

### 3. Approve + enable inline in the PR-creating workflow

The workflow that creates the bot PR also approves and enables auto-merge in the same job. This eliminates the cross-workflow race condition (PR created → separate automerge.yml triggers → too late).

**Trade-off**: The inline step runs with `GITHUB_TOKEN`, which may not satisfy required-review rules on branches like `dev`. This must be empirically tested. Fallback: dev bot PRs remain manual-merge until a dedicated bot identity is set up.

### 4. Fallback: mergePullRequest when CLEAN, retry when UNKNOWN

If `enablePullRequestAutoMerge` fails with `unstable status` and the PR is already `CLEAN`, call `mergePullRequest(SQUASH)` directly. If `UNKNOWN`, retry up to 3 times with 10s intervals. Never call `mergePullRequest` when checks are still pending.

## Consequences

- Bot PRs will auto-merge when CI passes (fixing the root problem)
- The `automerge.yml` workflow is simplified (no sleep, no polling, no `check_suite` trigger)
- The `hardcode-sync.yml` workflow becomes self-contained for auto-merge
- Dev branch auto-merge depends on `GITHUB_TOKEN` approve working (needs testing)
- Future: CodeQL/Socket Security should be promoted to required status checks to close the security gap
