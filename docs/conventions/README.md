# Conventions Index

This folder holds engineering process and contract conventions.

Migration fit classification is maintained in [`../DOCS-INDEX.md`](../DOCS-INDEX.md#migration-fit-transferability).

## CI touchpoints

| Convention file | GitHub workflow touchpoint |
| --- | --- |
| `api-contract-checklist.md` | `ci.yml` (`live-schema-validation`, `apiSchemas` tests in scripts) and API drift checks in dedicated scheduled jobs |
| `api-base-urls.md` | CI env/variable usage in `ci.yml` and script invocations that read `LIVE_TEST_API_BASE_CI` |
| `vercel-deployment-smoke-test.md` | `.github/workflows/deployment-smoke-test.yml` |
| `ci-live-schema-cloudflare.md` | Operational playbook when live schema CI hits Cloudflare challenge responses |
| `peer-dependency-guard.md` | `ci.yml` (`peer-dep-check`) |
| `merge-summary.md` | PR/merge review flow and follow-up comments (merge policy docs and AGENTS/PR process) |
| `frontend-regression-checklist.md` | Manual verification gate used during UI refactor PRs, typically before/alongside `ci.yml` checks |
| `sort-stability.md` | Sort comparator must form total order — `reserveId` tiebreaker rule (AAV-203) |
| `partner-logo-variants.md` | SVG fill rules and dark/light variant pattern for partner logos (AAV-634) |
| `ui-copy-specification.md` | All user-visible text templates, parameters, and data sources for cap warnings, incentive notes, and UI buttons |
