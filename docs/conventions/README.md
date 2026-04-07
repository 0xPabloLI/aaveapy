# Conventions Index

This folder holds engineering process and contract conventions.

Use this index to decide what can move to a new project and what is repo-specific.

## Migration fit

| File | Fit | Why |
| --- | --- | --- |
| `api-contract-checklist.md` | High | Generic API breaking-change checklist; replace endpoints and schema names. |
| `peer-dependency-guard.md` | High | Generic React version-safety pattern. |
| `merge-summary.md` | High | Project-agnostic merge hygiene. |
| `frontend-regression-checklist.md` | Medium | Reusable UI refactor checklist; adapt component names. |
| `api-base-urls.md` | Medium | Useful for multi-env apps; replace hostnames and env vars. |
| `vercel-deployment-smoke-test.md` | Medium | Transferable if the new project uses Vercel. |
| `ci-live-schema-cloudflare.md` | Low | Cloudflare-specific edge mitigation. |

## Reading guide

- Start here if you are moving engineering conventions into a new repo.
- Read the specific file when you are changing API contracts, deployment checks, or React dependency safety.
- Keep project-specific behavior out of this folder; put it in the repo’s own canonical docs instead.

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
