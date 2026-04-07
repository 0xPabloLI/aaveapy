# 可迁移文档统一入口（Transferable Docs Index）

这里按“能否直接迁移到其他项目”把当前仓库文档归类。

## 高可迁移（直接可复用）

- `docs/conventions/README.md`
- `docs/conventions/api-contract-checklist.md`
- `docs/conventions/peer-dependency-guard.md`
- `docs/conventions/merge-summary.md`
- `docs/design/DESIGN-SYSTEM-REFERENCE.md`

## 中可迁移（可复用，需改项目上下文）

- `docs/DOCS-INDEX.md`（迁移前仓库索引逻辑可复用）
- `docs/conventions/api-base-urls.md`
- `docs/conventions/vercel-deployment-smoke-test.md`
- `docs/conventions/frontend-regression-checklist.md`
- `docs/rate-calculation-formulas.md`（索引页）
- `docs/rate-calculation-native.md`
- `docs/rate-calculation-merkl.md`
- `docs/rate-calculation-display.md`
- `docs/rate-calculation-cap-reference.md`
- `docs/frontend-data-loading-matrix.md`

## 低可迁移（项目/平台特化）

- `docs/conventions/ci-live-schema-cloudflare.md`
- `docs/design/DESIGN.md`
- `docs/design/frontend-interaction-guardrails.md`
- `docs/design/mobile-reserve-card-ascii-layout.md`

## 迁移建议

- 如果你想做**新项目模板**，优先取高可迁移 + 中可迁移中的基础部分。
- 如果你想做**同类金融产品迁移**，建议再带上 `frontend-data-loading-matrix.md` 和 rate 模块文档。
- 如果你想做**通用工程规范模板**，先从 `docs/conventions/README.md` 和各 convention 开始。
