# Documentation Canonical Map

This index is the source of truth for doc ownership in this repository.

Use it to avoid duplicate policy text and to keep each topic in one canonical location.

**Entry points:** [`README.md`](../README.md) (onboarding), root [`DESIGN.md`](../DESIGN.md) (design links table), this file (full map).
**Reusable templates:** [`docs/reusable/`](./reusable/) (project-agnostic engineering patterns, portable to any repo).

_Last inventory pass: 2026-04-30._

## Canonical Structure

### Product and repo operation

- Canonical: `README.md` (project onboarding, scripts, high-level behavior)
- Canonical: `docs/PR_ANALYSIS.md` (PR batching/automerge policy)
- Canonical: `AGENTS.md` → **PR review threads: no cosmetic resolve** (merge / `resolveReviewThread` policy); workflow copy: `.claude/commands/merge.md` (keep aligned with `~/.cursor/commands/merge.md`)
- Canonical: `docs/dependabot-behavior.md` (Dependabot behavior summary + pointers)

### API, contracts, and CI conventions

- Supporting index: `docs/conventions/README.md` (stub pointer to conventions; migration fit now in this file)
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
- Canonical: `docs/rate-calculation.md`
- Canonical: `docs/fallback-reference.md` (frontend variable fallback chains)
- Canonical: `docs/TERMINOLOGY.md` (variable / field naming reference)
- Canonical: `docs/v3-v4-sdk-field-mapping.md` (Aave V3 vs V4 SDK field mapping)
- Canonical: `docs/api-field-optimization.md` (API field-shape optimization analysis)
- Canonical: `docs/pool-explorer-links.md` (pool address explorer deep-link mapping; e2e validation in `e2e/explorer-links-*.spec.ts`)
- Historical supporting note: `docs/archive/merit-base-anchor-vs-last-round-staging.md`
- Historical execution archive: `docs/archive/frontend-redundancy-review-2026-04-06.md`
- Supporting implementation note: `docs/archive/2026-04-09-reserve-id-canonical-key.md`

### Design system and interaction

- Canonical (project profile): `docs/design/DESIGN.md`
- Canonical (reusable system rules): `docs/design/DESIGN-SYSTEM-REFERENCE.md`
- Canonical (product-critical interaction guardrails): `docs/design/frontend-interaction-guardrails.md`
- Canonical (mobile ASCII reference): `docs/design/mobile-reserve-card-ascii-layout.md`
- Entry stub: `docs/design/README.md` (index page only)

  > `frontend-interaction-guardrails.md` is *not* under `docs/conventions/` because it is a product-behavior rulebook, not a repo-process convention.

### Specs (live behavior contracts)

- Canonical: `docs/specs/reserve-table-market-hub-filtering.md`
- Canonical: `docs/specs/v4-reserveId-uniqueness.md`

### Ops and historical plans

- Canonical: `docs/HARDCODE-AND-EXTERNAL-IMPORTS.md`
- Canonical: `docs/ci-remediation-automation.md`
- Historical archive: `docs/archive/2026-03-26-cap-ceiling-unification-plan.md`
- Historical archive: `docs/archive/2026-04-02-mobile-reserve-ios-connector-plan.md`
- Historical archive: `docs/archive/2026-04-08-campaign-apr-reconciliation.md`
- Historical archive: `docs/archive/2026-04-08-campaign-apr-reconciliation-script.md`
- Historical archive: `docs/archive/2026-04-26-utilization-two-levels-design.md`
- Archive folder: `docs/archive/` (historical notes, plans, and execution snapshots)

## Inventory and Action Classification

| Document | Purpose / audience | Last meaningful update | Canonicality | Overlap candidates | Action |
| --- | --- | --- | --- | --- | --- |
| `README.md` | Project onboarding and scripts | 2026-04-09 | Canonical | `docs/frontend-data-loading-matrix.md`, `docs/rate-calculation.md` | keep |
| `docs/PR_ANALYSIS.md` | PR batching / automerge / when to split PRs | 2026-04-05 | Canonical | `docs/dependabot-behavior.md`; merge execution + review-thread rules live in `AGENTS.md` / `.claude/commands/merge.md` | keep |
| `docs/dependabot-behavior.md` | Dependabot summary | 2026-04-01 | Derivative pointer | `.github/dependabot.yml`, `docs/PR_ANALYSIS.md` | keep |
| `docs/frontend-data-loading-matrix.md` | Data-loading architecture | 2026-04-27 | Canonical | `README.md` freshness notes | keep |
| `docs/rate-calculation.md` | Unified rate simulation formulas (native, Merkl, display, cap/ceiling) | 2026-04-28 | Canonical | none (consolidated) | keep |
| `docs/fallback-reference.md` | Frontend variable fallback chains | 2026-04-28 | Canonical | `docs/rate-calculation.md` | keep |
| `docs/TERMINOLOGY.md` | Variable / field naming reference | 2026-04-28 | Canonical | `docs/v3-v4-sdk-field-mapping.md` | keep |
| `docs/v3-v4-sdk-field-mapping.md` | Aave V3 vs V4 SDK field mapping | 2026-04-28 | Canonical | `docs/TERMINOLOGY.md`, `docs/fallback-reference.md` | keep |
| `docs/api-field-optimization.md` | API field-shape optimization analysis | 2026-04-20 | Canonical | none significant | keep |
| `docs/pool-explorer-links.md` | Pool address explorer deep-link mapping | 2026-04-16 | Canonical | live validation in `e2e/explorer-links-*.spec.ts` | keep |
| `docs/specs/reserve-table-market-hub-filtering.md` | Reserve table market/hub filtering behavior contract | 2026-04-22 | Canonical | `src/components/dashboard/ReservesTable.tsx` | keep |
| `docs/specs/v4-reserveId-uniqueness.md` | V4 reserveId uniqueness contract | 2026-04-22 | Canonical | `src/lib/reserveKey.ts`, `src/lib/apiSchemas.ts` | keep |
| `docs/archive/merit-base-anchor-vs-last-round-staging.md` | Historical empirical snapshot | 2026-03-31 | Historical supporting note | `docs/rate-calculation.md` | keep |
| `docs/HARDCODE-AND-EXTERNAL-IMPORTS.md` | Upstream sync and hardcode map | 2026-04-04 | Canonical | none significant | keep |
| `docs/ci-remediation-automation.md` | CI auto-remediation workflow | 2026-03-15 | Canonical | none significant | keep |
| `docs/archive/2026-03-26-cap-ceiling-unification-plan.md` | Archived cap/ceiling plan (summary only) | 2026-03-31 | Historical archive | `docs/rate-calculation.md`, `AGENTS.md` | keep |
| `docs/archive/2026-04-02-mobile-reserve-ios-connector-plan.md` | Mobile reserve iOS connector design plan | 2026-04-09 | Historical archive | `docs/design/mobile-reserve-card-ascii-layout.md` | keep |
| `docs/archive/2026-04-08-campaign-apr-reconciliation.md` | Campaign APR reconciliation analysis | 2026-04-09 | Historical archive | `scripts/reconcile-campaign-apr.mjs` | keep |
| `docs/archive/2026-04-08-campaign-apr-reconciliation-script.md` | Campaign APR reconciliation script notes | 2026-04-09 | Historical archive | `scripts/reconcile-campaign-apr.mjs` | keep |
| `docs/archive/2026-04-09-reserve-id-canonical-key.md` | Reserve key canonicalization note | 2026-04-09 | Supporting implementation note | `src/lib/reserveKey.ts`, `src/hooks/useRateSimulation.ts` | keep |
| `docs/archive/2026-04-26-utilization-two-levels-design.md` | Utilization two-levels design exploration | 2026-04-28 | Historical archive | `docs/design/frontend-interaction-guardrails.md` | keep |
| `docs/archive/frontend-redundancy-review-2026-04-06.md` | Frontend redundancy review | 2026-04-06 | Historical archive | none significant | keep |
| `docs/design/DESIGN.md` | Project-specific design defaults | 2026-04-26 | Canonical | `docs/design/DESIGN-SYSTEM-REFERENCE.md` | keep |
| `docs/design/DESIGN-SYSTEM-REFERENCE.md` | Reusable design/interaction rules | 2026-04-26 | Canonical | old design split docs | keep |
| `docs/design/frontend-interaction-guardrails.md` | Product-critical normative interaction rules | 2026-04-28 | Canonical | parts of design docs | keep |
| `docs/design/mobile-reserve-card-ascii-layout.md` | Mobile reserve card ASCII reference | 2026-04-26 | Canonical | appendix references in DSR | keep |
| `docs/design/README.md` | Design docs entry/index page | 2026-04-16 | Entry stub | `docs/design/DESIGN-SYSTEM-REFERENCE.md`, root `DESIGN.md`, `docs/design/DESIGN.md` | keep |
| `docs/conventions/vercel-deployment-smoke-test.md` | Vercel smoke test workflow, deploy SHA meta, rollback ref rules | 2026-04-05 | Canonical | `.github/workflows/deployment-smoke-test.yml` | keep |
| `docs/conventions/*` | API/CI/process conventions | 2026-03-16..2026-04-30 | Canonical set | small references in README/AGENTS | keep |

## Migration Fit (Transferability)

Documents classified by portability to other projects.

### High (directly reusable)

- `docs/conventions/api-contract-checklist.md` — Generic API breaking-change checklist
- `docs/conventions/peer-dependency-guard.md` — Generic React version-safety pattern
- `docs/conventions/merge-summary.md` — Project-agnostic merge hygiene

### Medium (reusable with context adaptation)

- `docs/conventions/api-base-urls.md` — Multi-env app URL conventions; replace hostnames
- `docs/conventions/vercel-deployment-smoke-test.md` — Transferable if deploying on Vercel
- `docs/conventions/frontend-regression-checklist.md` — UI refactor checklist; adapt component names
- `docs/rate-calculation.md` — Rate simulation reference; adapt formulas to new domain
- `docs/frontend-data-loading-matrix.md` — Data loading architecture; adapt endpoints

### Low (project/platform specific)

- `docs/conventions/ci-live-schema-cloudflare.md` — Cloudflare-specific edge mitigation
- `docs/design/DESIGN.md` — Project-specific design defaults
- `docs/design/frontend-interaction-guardrails.md` — Product-specific interaction rules
- `docs/design/mobile-reserve-card-ascii-layout.md` — Product-specific mobile layout

## Redirect Rule

If a topic is historical or split-legacy, keep a short pointer page and move all normative content to one canonical file only.

## Cross-reference hygiene

- Prefer **existing** headings: `docs/design/DESIGN.md` is a short project profile (§1–§4 only). Do not cite phantom sections (e.g. old "§4.4 Tooltip").
- **Tooltip layout (multi-paragraph + Radix density):** canonical detail in `docs/design/frontend-interaction-guardrails.md` § A · Tooltip/Overlay; cursor/delay summary in `docs/design/DESIGN-SYSTEM-REFERENCE.md` §6.
