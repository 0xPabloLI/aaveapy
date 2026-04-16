# Reusable Engineering Docs

Project-agnostic engineering patterns extracted from production experience.

These documents are **generic templates** — drop them into any project's `docs/` and adapt variable names, endpoints, and component references to fit.

| Document | Location | Topic |
|----------|----------|-------|
| API Contract Checklist | `docs/conventions/api-contract-checklist.md` | API contract migration and drift prevention |
| Peer Dependency Guard | `docs/conventions/peer-dependency-guard.md` | Core library version mismatch prevention |
| Merge Summary Convention | `docs/conventions/merge-summary.md` | Merge summary convention |
| Frontend Regression Checklist | `docs/conventions/frontend-regression-checklist.md` | Display-layer refactor verification |
| Vercel Deployment Smoke Test | `docs/conventions/vercel-deployment-smoke-test.md` | Post-deploy smoke + rollback |

## How to use

1. Copy the relevant file(s) from `docs/conventions/` into your project's `docs/conventions/` (or equivalent).
2. Replace placeholder references with your project's actual file paths, URLs, and component names.
3. Reference from your project's `AGENTS.md`, `CONTRIBUTING.md`, or equivalent contributor guide.
