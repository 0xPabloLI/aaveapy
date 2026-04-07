# Documentation Canonical Map

This index is the source of truth for doc ownership in this repository.

Use it to avoid duplicate policy text and to keep each topic in one canonical location.

**Entry points:** [`README.md`](../README.md) (onboarding), root [`DESIGN.md`](../DESIGN.md) (design links table), this file (full map).
**Migration index:** [`docs/transferable-docs.md`](./transferable-docs.md) (which docs are reusable).

_Last inventory pass: 2026-04-08._

## Canonical Structure

### Product and repo operation

- Canonical: `README.md` (project onboarding, scripts, high-level behavior)
- Canonical: `docs/PR_ANALYSIS.md` (PR batching/automerge policy)
- Canonical: `AGENTS.md` → **PR review threads: no cosmetic resolve** (merge / `resolveReviewThread` policy); workflow copy: `.claude/commands/merge.md` (keep aligned with `~/.cursor/commands/merge.md`)
- Canonical: `docs/dependabot-behavior.md` (Dependabot behavior summary + pointers)

### API, contracts, and CI conventions

- Supporting index: `docs/conventions/README.md` (migration fit map for engineering conventions)
- Canonical: `docs/conventions/api-contract-checklist.md`
- Canonical: `docs/conventions/api-base-urls.md`
- Canonical: `docs/conventions/vercel-deployment-smoke-test.md` (post-deploy smoke + rollback; ref normalization vs Vercel metadata)
- Canonical: `docs/conventions/ci-live-schema-cloudflare.md`
- Canonical: `docs/conventions/peer-dependency-guard.md`
- Canonical: `docs/conventions/merge-summary.md`

### Conventions transfer map

| File | Migration fit | Notes |
| --- | --- | --- |
| `docs/conventions/api-contract-checklist.md` | High | Generic API contract migration checklist; replace endpoints and schema names. |
| `docs/conventions/api-base-urls.md` | Medium | Useful if the new project has multiple environments and env-var overrides; replace hostnames. |
| `docs/conventions/peer-dependency-guard.md` | High | Generic React safety pattern; replace versions and package manager details as needed. |
| `docs/conventions/merge-summary.md` | High | Project-agnostic merge hygiene. |
| `docs/conventions/frontend-regression-checklist.md` | Medium | Strong reusable pattern for UI refactors; replace component names and high-risk surfaces. |
| `docs/conventions/vercel-deployment-smoke-test.md` | Medium | Transferable if the new project deploys on Vercel; otherwise adapt to the hosting platform. |
| `docs/conventions/ci-live-schema-cloudflare.md` | Low | Cloudflare-specific mitigation; keep only if the new project uses the same edge setup. |

### Conventions ↔ GitHub Actions mapping

| Convention doc | GitHub Actions touchpoint |
| --- | --- |
| `docs/conventions/vercel-deployment-smoke-test.md` | `.github/workflows/deployment-smoke-test.yml` (deploy smoke, SHA verification, rollback) |
| `docs/conventions/api-contract-checklist.md` | `apiSchemas.live.test.ts` / `apiSchemas.test.ts` / `sync-token-icons.mjs` checks in CI |
| `docs/conventions/ci-live-schema-cloudflare.md` | Operational follow-up when CI live schema checks hit Cloudflare challenge/block |
| `docs/conventions/merge-summary.md` | PR/merge workflow review artifacts (`commit body`/`PR comment`/summary hygiene) |
| `docs/conventions/peer-dependency-guard.md` | Dependency safety gates during install/upgrade in pipeline flows |
| `docs/conventions/frontend-regression-checklist.md` | Manual/local verification required before merge (often alongside PR validation) |

### Frontend runtime/data/simulation

- Canonical: `docs/frontend-data-loading-matrix.md`
- Canonical index: `docs/rate-calculation-formulas.md`
- Module docs: `docs/rate-calculation-native.md`, `docs/rate-calculation-merkl.md`, `docs/rate-calculation-display.md`, `docs/rate-calculation-cap-reference.md`
- Supporting snapshot note: `docs/merit-base-anchor-vs-last-round-staging.md`
- Historical execution archive: `docs/frontend-redundancy-review-2026-04-06.md`

### Design system and interaction

- Canonical (project profile): `docs/design/DESIGN.md`
- Canonical (reusable system rules): `docs/design/DESIGN-SYSTEM-REFERENCE.md`
- Canonical (product-critical interaction guardrails): `docs/design/frontend-interaction-guardrails.md`
- Canonical (mobile ASCII reference): `docs/design/mobile-reserve-card-ascii-layout.md`
- Redirect stubs (do not expand; see inventory table): `docs/design/ui-interaction-patterns.md`, `docs/design/toggle-switch-specification.md`, `docs/design/README.md`

  > `frontend-interaction-guardrails.md` is *not* under `docs/conventions/` because it is a product-behavior rulebook, not a repo-process convention.

### Ops and historical plans

- Canonical: `docs/HARDCODE-AND-EXTERNAL-IMPORTS.md`
- Canonical: `docs/ci-remediation-automation.md`
- Historical archive: `docs/plans/2026-03-26-cap-ceiling-unification-plan.md`

## Inventory and Action Classification

| Document | Purpose / audience | Last meaningful update | Canonicality | Overlap candidates | Action |
| --- | --- | --- | --- | --- | --- |
| `README.md` | Project onboarding and scripts | 2026-03-31 | Canonical | `docs/frontend-data-loading-matrix.md`, `docs/rate-calculation-formulas.md` | keep |
| `docs/PR_ANALYSIS.md` | PR batching / automerge / when to split PRs | 2026-04-05 | Canonical | `docs/dependabot-behavior.md`; merge execution + review-thread rules live in `AGENTS.md` / `.claude/commands/merge.md` | keep |
| `docs/dependabot-behavior.md` | Dependabot summary | 2026-03-31 | Derivative pointer | `.github/dependabot.yml`, `docs/PR_ANALYSIS.md` | keep |
| `docs/frontend-data-loading-matrix.md` | Data-loading architecture | 2026-03-27 | Canonical | `README.md` freshness notes | keep |
| `docs/rate-calculation-formulas.md` | Simulation formulas index | 2026-04-08 | Canonical index | module docs below | keep |
| `docs/rate-calculation-native.md` | Native rate math | 2026-04-08 | Canonical module | `docs/rate-calculation-formulas.md` | keep |
| `docs/rate-calculation-merkl.md` | Merkl forecast math | 2026-04-08 | Canonical module | `docs/rate-calculation-formulas.md` | keep |
| `docs/rate-calculation-display.md` | APR/APY display + net eligibility | 2026-04-08 | Canonical module | `docs/rate-calculation-formulas.md` | keep |
| `docs/rate-calculation-cap-reference.md` | Incentive cap / ceiling reference | 2026-04-08 | Canonical module | `docs/rate-calculation-formulas.md` | keep |
| `docs/merit-base-anchor-vs-last-round-staging.md` | Historical empirical snapshot | 2026-03-31 | Historical supporting note | `docs/rate-calculation-formulas.md` | keep |
| `docs/HARDCODE-AND-EXTERNAL-IMPORTS.md` | Upstream sync and hardcode map | 2026-03-31 | Canonical | none significant | keep |
| `docs/ci-remediation-automation.md` | CI auto-remediation workflow | 2026-03-15 | Canonical | none significant | keep |
| `docs/plans/2026-03-26-cap-ceiling-unification-plan.md` | Archived cap/ceiling plan (summary only) | 2026-03-31 | Historical archive | `docs/rate-calculation-formulas.md`, `AGENTS.md` | keep |
| `docs/design/DESIGN.md` | Project-specific design defaults | 2026-03-31 | Canonical | `docs/design/DESIGN-SYSTEM-REFERENCE.md` | keep |
| `docs/design/DESIGN-SYSTEM-REFERENCE.md` | Reusable design/interaction rules | 2026-03-31 | Canonical | old design split docs | keep |
| `docs/design/frontend-interaction-guardrails.md` | Product-critical normative interaction rules | 2026-03-31 | Canonical | parts of design docs | keep |
| `docs/design/mobile-reserve-card-ascii-layout.md` | Mobile reserve card ASCII reference | 2026-03-16 | Canonical | appendix references in DSR | keep |
| `docs/design/ui-interaction-patterns.md`, `toggle-switch-specification.md`, `README.md` | Legacy paths / short pointers (do not expand) | 2026-03-27 | Redirect stubs | `docs/design/DESIGN-SYSTEM-REFERENCE.md`, root `DESIGN.md`, `docs/design/DESIGN.md` | keep |
| `docs/conventions/vercel-deployment-smoke-test.md` | Vercel smoke test workflow, deploy SHA meta, rollback ref rules | 2026-04-05 | Canonical | `.github/workflows/deployment-smoke-test.yml` | keep |
| `docs/conventions/*` | API/CI/process conventions | 2026-03-16..2026-04-05 | Canonical set | small references in README/AGENTS | keep |

## Redirect Rule

If a topic is historical or split-legacy, keep a short pointer page and move all normative content to one canonical file only.

## Cross-reference hygiene

- Prefer **existing** headings: `docs/design/DESIGN.md` is a short project profile (§1–§4 only). Do not cite phantom sections (e.g. old “§4.4 Tooltip”).
- **Tooltip layout (multi-paragraph + Radix density):** canonical detail in `docs/design/frontend-interaction-guardrails.md` § A · Tooltip/Overlay; cursor/delay summary in `docs/design/DESIGN-SYSTEM-REFERENCE.md` §6.
