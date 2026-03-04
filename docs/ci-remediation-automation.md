# CI Remediation Auto-Approve (Frontend)

This repo now uses a two-step remediation flow:

1. `.github/workflows/ci.yml`
   - On `push`, if `lint/build/audit` fails, it runs `npm run ci:auto-fix`.
   - If checks pass after fix and files changed, it opens:
     - `bot/ci-auto-remediation-<run_id>` PR
   - Base branch is the same source branch (`main/dev/railway/feature/**`).

2. `.github/workflows/auto-approve-remediation-pr.yml`
   - On `pull_request_target`, only for remediation bot PRs.
   - Policy-checks changed files, then:
     - auto-approves
     - enables squash auto-merge

## Current approval scope

Allowed changed files:

- `package.json`
- `package-lock.json`

If other files are changed, workflow comments on PR and blocks auto-approve/auto-merge.

## How to expand scope later

Edit one place:

- `allowed` set in `.github/workflows/auto-approve-remediation-pr.yml`

Recommended rule:

- only add dependency manifests / lockfiles
- avoid adding source code paths unless you also add stricter policy checks

## Token used for approval

- Preferred: `CODEX_BOT_TOKEN` secret (if configured)
- Fallback: `github.token`

If approval fails due to permissions, configure `CODEX_BOT_TOKEN` with review + merge permissions.
