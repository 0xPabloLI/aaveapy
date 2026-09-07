# Agent Harness 本地改编登记

> core 通用层的唯一编辑入口在 agent-harness 核心仓（`~/Documents/code/agent-harness`，其 MANIFEST.md 是跨 repo 全景与拷贝映射）。本文件只登记**本 repo 相对 core 的偏离**：同步 core 时按此表保留本地化，防止覆盖；不承担组件地图职责。

## 本地改编登记（相对 core 的偏离）

| 文件 | 偏离 | 原因 |
| --- | --- | --- |
| 实施工作流 | **内联在 AGENTS.md**（8 步 + Session 结束 checklist），无独立 `implementation-workflow.md` | 历史；S0–S3×R0–R3 双分流未引入。若 AGENTS.md 膨胀再考虑拆出 |
| issue-tracker.md | core 后端无关契约 + 本 repo Linear 段（teamId/AAV/MCP 工具/wayfinding/sub-issue 坑） | 后端是 Linear |
| git 纪律 | 无独立 git-workflow.md；规则在 AGENTS.md（stash 禁令、禁本地切分支、commit cadence 外链） | 内联模式；core 的「写入者独占 worktree」规则未整体引入，仅保留禁切分支部分 |
| proposal-review.md | **未引入** | AGENTS.md 无对应路由；需要引入时同时加路由行 |
| git-concurrent-recovery.md | **未引入** | 单写者纪律下竞态应急未触发过；触发时从 core 仓取 |
| scenario 两文件 | 住 `docs/conventions/`，用 core 合并版原样 | 与 core 一致 |
| AGENTS.md 设计段 | Users/Brand/Aesthetic/Principles/Token 全套内联（AAVE repos 中最完整） | 本 repo 的插槽值；core 不收品牌内容 |
