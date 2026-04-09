# Reusable Engineering Docs

Project-agnostic engineering patterns extracted from production experience.

These documents are **generic templates** — drop them into any project's `docs/` and adapt variable names, endpoints, and component references to fit.

| Document | Topic |
|----------|-------|
| `api-contract-checklist.md` | API contract migration and drift prevention |
| `peer-dependency-guard.md` | Core library version mismatch prevention |
| `merge-summary.md` | Merge summary convention |
| `frontend-regression-checklist.md` | Display-layer refactor verification |
| `deployment-smoke-test.md` | Post-deploy smoke test and auto-rollback |

## How to use

1. Copy the relevant file(s) into your project's `docs/conventions/` (or equivalent).
2. Replace placeholder references with your project's actual file paths, URLs, and component names.
3. Reference from your project's `AGENTS.md`, `CONTRIBUTING.md`, or equivalent contributor guide.
