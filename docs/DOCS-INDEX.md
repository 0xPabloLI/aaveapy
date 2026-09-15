# Documentation Canonical Map

This index is the source of truth for doc ownership in this repository.

Use it to avoid duplicate policy text and to keep each topic in one canonical location.

**Entry points:** [`README.md`](../README.md) (onboarding), root [`DESIGN.md`](../DESIGN.md) (design links table), this file (full map).
**Reusable templates:** [`docs/reusable/`](./reusable/) (project-agnostic engineering patterns, portable to any repo).

_Last inventory pass: 2026-07-06._

## Canonical Structure

### Product and repo operation

- Canonical: `README.md` (project onboarding, scripts, high-level behavior)
- Canonical: `docs/ARCHITECTURE.md` (技术架构：目录结构、数据流、shared schema、simulation、错误处理模式)
- Canonical: `docs/PR_ANALYSIS.md` (PR batching/automerge policy)
- Canonical: `AGENTS.md` → **PR review threads: no cosmetic resolve** (merge / `resolveReviewThread` policy); workflow copy: `.claude/commands/merge.md` (keep aligned with `~/.cursor/commands/merge.md`)
- Canonical: `docs/dependabot-behavior.md` (Dependabot behavior summary + pointers)

### API, contracts, and CI conventions

- Supporting index: `docs/conventions/README.md` (stub pointer to conventions; migration fit now in this file)
- Canonical: `docs/conventions/api-contract-checklist.md`
- Canonical: `docs/conventions/api-base-urls.md`
- Canonical: `docs/conventions/vercel-deployment-smoke-test.md` (post-deploy smoke + rollback; ref normalization vs Vercel metadata)
- Canonical: `docs/conventions/ci-live-schema-cloudflare.md`
- Canonical: `docs/conventions/post-deploy-checklist.md` (Production deployment verification: API endpoint, data, SEO, security, rollback)
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
- Canonical: `CONTEXT.md` (opinionated domain glossary: 正名 + _Avoid_ aliases)
- Canonical: `docs/TERMINOLOGY.md` (variable / field naming reference; full mapping chains + units)
- Canonical: `aaveapy-doc/v3-v4-sdk-field-mapping.md` (Aave V3 vs V4 SDK field mapping)
- Canonical: `docs/api-field-optimization.md` (API field-shape optimization analysis)
- Canonical: `docs/pool-explorer-links.md` (pool address explorer deep-link mapping; validation now in `src/lib/poolExplorerLinks.test.ts` — the `e2e/explorer-links-*.spec.ts` files were retired, see `docs/conventions/e2e-testing-boundary.md`)
- Implemented: Portfolio Simulation — 多 token 组合模拟（✅ 全部完成 2026-05-10）；5 Phase 实施完毕，文件：`src/types/portfolio.ts`, `src/hooks/usePortfolioSimulation.ts`, `src/lib/portfolioCalculator.ts`, `src/components/dashboard/Portfolio*.tsx`；三种添加入口：表格 checkbox / 展开面板按钮 / 搜索栏
- Historical supporting note: `docs/archive/merit-base-anchor-vs-last-round-staging.md`
- Historical execution archive: `docs/archive/frontend-redundancy-review-2026-04-06.md`
- Supporting implementation note: `docs/archive/2026-04-09-reserve-id-canonical-key.md`

### Design system and interaction

- Canonical (project profile): `docs/design/DESIGN.md`
- Canonical (reusable system rules): `docs/design/DESIGN-SYSTEM-REFERENCE.md`
- Canonical (product-critical interaction guardrails): `docs/design/frontend-interaction-guardrails.md`
- Canonical (mobile ASCII reference): `docs/design/mobile-reserve-card-ascii-layout.md`
- Canonical (tooltip callout arrow spec): `docs/design/tooltip-arrow.md` (SVG double-path, auto-flip via Radix `data-side`, side-by-side comparison with `IncentiveTooltip`'s custom arrow)
- Implemented: Tooltip 设计规范（✅ 已实施，测试全绿）；Radix Tooltip（轻量）+ IncentiveTooltip（丰富浮层）+ AssetActionMenu Popover 三组件使用场景、API、测试要求；核心规则已合入 DSR §6
- Entry stub: `docs/design/README.md` (index page only)

  > `frontend-interaction-guardrails.md` is *not* under `docs/conventions/` because it is a product-behavior rulebook, not a repo-process convention.

### Specs (live behavior contracts)

- Canonical: `docs/specs/reserve-table-market-hub-filtering.md`
- Canonical: `docs/specs/v4-reserveId-uniqueness.md`
- Canonical: `docs/specs/schema-pipeline-automation.md` (后端驱动全链路 schema 自动生成；Phase 1 ✅, Phase 2–3 pending AAV-1214/1216; ADR-0026)
- Implemented: 移动端 Simulation 表格 Grid 布局改造（✅ 已实施 2026-05-10）；核心结论已合入 `frontend-interaction-guardrails.md` § Simulation breakdown table — Grid layout (mobile)

### ADRs (Architecture Decision Records)

- Canonical: `docs/adr/` (001–026)
- Latest: ADR-0026 (Schema Pipeline Automation — backend-driven codegen, Phase 1 complete)

### Plans and PRDs

- Active plans: `docs/plans/frontend-triage-2026-06/` (14 phases, indexed by `00-overview.md`; 10 issues confirmed done via code comparison and removed 2026-07-21)
- Completed plans: `docs/plans/completed/` (8 handoff documents for done issues)
- Active PRDs: `docs/prd/PRD-simulation-sources-dispatch.md`, `docs/prd/input-surface-normalization.md`
- Completed PRDs: `docs/prd/completed/` (7 PRDs for done issues: AAV-761, AAV-978, AAV-979, AAV-833, AAV-952, brevis-sum-unification, incentive-note-copy)

### Ops and historical plans

- Canonical: `docs/HARDCODE-AND-EXTERNAL-IMPORTS.md`
- Canonical: `docs/ci-remediation-automation.md`
- Historical archive: `docs/archive/2026-04-02-mobile-reserve-ios-connector-plan.md`
- Historical archive: `docs/archive/2026-04-08-campaign-apr-reconciliation.md`
- Historical archive: `docs/archive/2026-04-08-campaign-apr-reconciliation-script.md`
- Archive folder: `docs/archive/` (historical notes, plans, and execution snapshots)

> **已清理的 archive plans**（摘要已合入主文档，源文件已删除）：
> - `2026-03-26-cap-ceiling-unification-plan.md` — 结论在 `docs/rate-calculation.md` + `AGENTS.md`
> - `2026-04-26-utilization-two-levels-design.md` — superseded by `DESIGN-SYSTEM-REFERENCE.md` §2.1

## Inventory and Action Classification

| Document | Purpose / audience | Last meaningful update | Canonicality | Overlap candidates | Action |
| --- | --- | --- | --- | --- | --- |
| `README.md` | Project onboarding and scripts | 2026-04-09 | Canonical | `docs/frontend-data-loading-matrix.md`, `docs/rate-calculation.md` | keep |
| `docs/PR_ANALYSIS.md` | PR batching / automerge / when to split PRs | 2026-04-05 | Canonical | `docs/dependabot-behavior.md`; merge execution + review-thread rules live in `AGENTS.md` / `.claude/commands/merge.md` | keep |
| `docs/dependabot-behavior.md` | Dependabot summary | 2026-04-01 | Derivative pointer | `.github/dependabot.yml`, `docs/PR_ANALYSIS.md` | keep |
| `docs/frontend-data-loading-matrix.md` | Data-loading architecture | 2026-04-27 | Canonical | `README.md` freshness notes | keep |
| `docs/rate-calculation.md` | Unified rate simulation formulas (native, Merkl, display, incentive caps) | 2026-04-28 | Canonical | none (consolidated) | keep |
| `docs/fallback-reference.md` | Frontend variable fallback chains | 2026-04-28 | Canonical | `docs/rate-calculation.md` | keep |
| `docs/TERMINOLOGY.md` | Variable / field naming reference | 2026-04-28 | Canonical | `aaveapy-doc/v3-v4-sdk-field-mapping.md` | keep |
| `aaveapy-doc/v3-v4-sdk-field-mapping.md` | Aave V3 vs V4 SDK field mapping | 2026-04-28 | Canonical | `docs/TERMINOLOGY.md`, `docs/fallback-reference.md` | keep |
| `docs/api-field-optimization.md` | API field-shape optimization analysis | 2026-04-20 | Canonical | none significant | keep |
| `docs/pool-explorer-links.md` | Pool address explorer deep-link mapping | 2026-04-16 | Canonical | live validation in `e2e/explorer-links-*.spec.ts` | keep |
| `docs/specs/reserve-table-market-hub-filtering.md` | Reserve table market/hub filtering behavior contract | 2026-04-22 | Canonical | `src/components/dashboard/ReservesTable.tsx` | keep |
| `docs/specs/v4-reserveId-uniqueness.md` | V4 reserveId uniqueness contract | 2026-04-22 | Canonical | `src/lib/reserveKey.ts`, `src/lib/apiSchemas.ts` | keep |
| `docs/specs/fcp-optimization.md` | FCP 优化 spec（钱包层 lazy 边界 + advancedChunks + 首屏守卫；含场景矩阵与验证证据） | 2026-08-29 | Canonical | `src/App.tsx`, `src/providers/WalletProviders.tsx`, `vite.config.ts`, `src/test/architecture-guard.test.ts` | keep |
| `docs/specs/e2e-wallet-connect-injected.md` | E2E 真实钱包连接测试 spec（mock EIP-1193 + EIP-6963；含场景矩阵与移动端弹窗发现） | 2026-09-05 | Canonical | `e2e/eip1193-mock.ts`, `e2e/wallet-connect-injected.spec.ts`, `docs/conventions/wallet-js-injection-testing.md` | keep |
| `docs/archive/2026-08-29-fcp-optimization-handoff.md` | FCP 优化 session 交接（已被 spec 取代） | 2026-08-29 | Historical archive | `docs/specs/fcp-optimization.md` | keep |
| `docs/archive/2026-08-29-fcp-chunk-defer-tickets.md` | FCP Round 2 tickets（全部完成） | 2026-08-29 | Historical archive | `docs/specs/fcp-optimization.md` | keep |
| `docs/archive/2026-09-06-scenario-pin-reorder-window-fix.md` | Scenario-pin e2e flake 根因与修复（pagination reorder-grow；含场景矩阵与验证证据） | 2026-09-06 | Historical archive | `src/hooks/reserves-table/useReservesPagination.ts`, `docs/design/frontend-interaction-guardrails.md` | keep |
| `docs/archive/merit-base-anchor-vs-last-round-staging.md` | Historical empirical snapshot | 2026-03-31 | Historical supporting note | `docs/rate-calculation.md` | keep |
| `docs/HARDCODE-AND-EXTERNAL-IMPORTS.md` | Upstream sync and hardcode map | 2026-04-04 | Canonical | none significant | keep |
| `docs/ci-remediation-automation.md` | CI auto-remediation workflow | 2026-03-15 | Canonical | none significant | keep |
| `docs/archive/2026-04-02-mobile-reserve-ios-connector-plan.md` | Mobile reserve iOS connector design plan | 2026-04-09 | Historical archive | `docs/design/mobile-reserve-card-ascii-layout.md` | keep |
| `docs/archive/2026-04-08-campaign-apr-reconciliation.md` | Campaign APR reconciliation analysis | 2026-04-09 | Historical archive | `scripts/reconcile-campaign-apr.mjs` | keep |
| `docs/archive/2026-04-08-campaign-apr-reconciliation-script.md` | Campaign APR reconciliation script notes | 2026-04-09 | Historical archive | `scripts/reconcile-campaign-apr.mjs` | keep |
| `docs/archive/2026-04-09-reserve-id-canonical-key.md` | Reserve key canonicalization note | 2026-04-09 | Supporting implementation note | `src/lib/reserveKey.ts`, `src/hooks/useRateSimulation.ts` | keep |
| `docs/archive/frontend-redundancy-review-2026-04-06.md` | Frontend redundancy review | 2026-04-06 | Historical archive | none significant | keep |
| `docs/design/DESIGN.md` | Project-specific design defaults | 2026-04-26 | Canonical | `docs/design/DESIGN-SYSTEM-REFERENCE.md` | keep |
| `docs/design/DESIGN-SYSTEM-REFERENCE.md` | Reusable design/interaction rules | 2026-04-26 | Canonical | old design split docs | keep |
| `docs/design/frontend-interaction-guardrails.md` | Product-critical normative interaction rules | 2026-04-28 | Canonical | parts of design docs | keep |
| `docs/design/mobile-reserve-card-ascii-layout.md` | Mobile reserve card ASCII reference | 2026-04-26 | Canonical | appendix references in DSR | keep |
| `docs/design/README.md` | Design docs entry/index page | 2026-04-16 | Entry stub | `docs/design/DESIGN-SYSTEM-REFERENCE.md`, root `DESIGN.md`, `docs/design/DESIGN.md` | keep |
| `docs/conventions/vercel-deployment-smoke-test.md` | Vercel smoke test workflow, deploy SHA meta, rollback ref rules | 2026-04-05 | Canonical | `.github/workflows/deployment-smoke-test.yml` | keep |
| `docs/conventions/*` | API/CI/process conventions | 2026-03-16..2026-04-30 | Canonical set | small references in README/AGENTS | keep |
| `docs/conventions/e2e-testing-boundary.md` | E2E boundary: what belongs in Playwright vs Vitest | 2026-08-30 | Canonical | `docs/specs/e2e-suite-boundary-cleanup.md`, `AGENTS.md` E2E skip rule | keep |

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
