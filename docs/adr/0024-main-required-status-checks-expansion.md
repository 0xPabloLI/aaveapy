# ADR 0024: Expand Main Branch Required Status Checks

## Status

Accepted

## Context

Main branch previously had 5 required status checks: `lint`, `build`, `Analyze (javascript-typescript)`, `peer-dep-check`, `security-audit`. CodeQL and Socket Security checks were running on every PR but were not required — a PR could merge even if CodeQL found vulnerabilities or Socket Security flagged supply chain issues.

Additionally, `required_approving_review_count` was 0 on both `main` and `dev`, meaning no review approval is needed. The `GITHUB_TOKEN` approve in `hardcode-sync.yml` is therefore a no-op for branch protection purposes (though it does add a visual review record on the PR).

## Decision

1. Add 3 new required status checks to `main` branch protection:
   - `CodeQL` — CodeQL static analysis (runs in `.github/workflows/codeql.yml`)
   - `Socket Security: Project Report` — Socket supply chain security audit
   - `Socket Security: Pull Request Alerts` — Socket dependency alerts per PR

2. Full required checks list after change:
   - `lint`
   - `build`
   - `Analyze (javascript-typescript)`
   - `peer-dep-check`
   - `security-audit`
   - `CodeQL`
   - `Socket Security: Project Report`
   - `Socket Security: Pull Request Alerts`

3. No changes to `dev` branch protection (has no required checks or review requirements).

## Consequences

- Dependabot PRs that only upgrade one of three CodeQL action steps will fail (version mismatch). These must be closed and replaced with a single commit upgrading all three steps together.
- PRs to `main` now require 8 checks to pass before auto-merge can complete.
- This change was applied via GitHub API (`POST /branches/main/protection/required_status_checks/contexts`), not via code commit.

## Date

2026-07-08
