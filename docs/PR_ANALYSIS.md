# PR 分析与合并策略

本文档基于近期 PR 分析（见 PR #70），作为仓库的 **PR 合并策略** 与 **频率优化** 参考。

> Status: **Active policy document** for PR batching/merge decisions in this repository.
> Historical examples in this file are illustrative; operational rules above them are canonical.

**Scope split:** This file is canonical for **when to batch PRs**, **automerge labeling**, and **independent vs combined PRs**. For **GitHub merge execution** (`/merge`), **`dev`/`main` tip alignment after merge**, and **forbidden cosmetic resolution of PR review threads** (`resolveReviewThread` / bulk Resolve without fixes), see root **`AGENTS.md`** (Commit & Pull Request Guidelines) and **`.claude/commands/merge.md`** (keep aligned with `~/.cursor/commands/merge.md`). Doc map: **`docs/DOCS-INDEX.md`**.

---

## Breaking Changes 判定

- **API 与导出**：组件 props、导出函数签名未变 → 无 breaking change。
- **依赖**：仅 minor/patch 更新、无 major 升级 → 兼容。
- **行为**：仅内部优化（缓存、fallback、日志、manifest），对外结果一致 → 向后兼容。

**结论**：满足上述条件时可安全 automerge。

---

## Automerge 建议

### 适合打 `automerge` 的情况

- 无 API breaking changes
- 以性能优化、配置、工具脚本为主
- 依赖更新为 minor/patch
- 变更范围清晰、有测试或易验证

### 建议条件（与现有 `.github/workflows/automerge.yml` 一致）

- CI 通过
- `automerge.yml` 仅对 **`automerge`** 标签生效（与 GitHub「Auto-merge」能力同名，便于和文档/示例对齐）
- 变更类型为 chore / docs / refactor 时优先考虑打 `automerge`
- 新功能、大重构需人工 review，不依赖 automerge

---

## PR 频率优化（批量合并策略）

### 推荐：方案 1 — 批量合并

- 将**相关**的小变更合并到一个 PR（例如：Token Icon 优化 + 依赖更新 + 配置改进 → 一个 "chore: improvements and optimizations" PR）。
- 设置**最小变更阈值**（例如：至少 5 个相关文件或 3 个相关功能点）再开 PR。
- PR 标题与描述清晰，便于 review 与回溯。

### 可选：方案 2–4

- **Draft PR**：先开 Draft，积累若干变更后再 Ready for Review。
- **工作流约定**：在 AGENTS.md 中约定最小变更阈值、合并策略、PR 频率上限（如每周 2–3 个）。
- **分类合并**：配置/工具 → 每周一批；UI/UX → 按功能模块；依赖更新 → 每月一批；Bug 修复 → 单独立即合；新功能 → 独立 PR。

---

## 何时合并到一个 PR vs 独立 PR

### 可以合并在一起

- 多个小的性能/体验优化
- 配置与工具脚本更新
- 依赖更新（minor/patch）
- 文档与注释
- 代码风格统一

### 应独立 PR

- 新功能（需独立 review）
- Bug 修复（希望快速合并）
- Breaking changes（需讨论与说明）
- 安全相关更新（需立即处理）

---

## 推荐行动

1. **日常**：chore/docs/refactor 类、无 breaking change、CI 通过 → 可打 `automerge`。
2. **频率**：采用批量合并策略，相关小变更合并为一个 PR，控制 PR 数量。
3. **规范**：在 AGENTS.md 中引用本策略，Agent 开 PR 时遵循「合并 vs 独立」与最小变更阈值。

---

## 变更统计参考（历史）

此前分析过的 PR（22 files, +836/-201）主要涉及：Token Icon、preloadUtils、generate-token-icon-manifest、依赖与配置文件。此类组合适合作为「单次批量优化 PR」的范例。
