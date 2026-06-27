# Design System: Aave APY

本文件为**入口索引**（避免与 `docs/design/DESIGN.md` 正文重复维护）。完整文档归属表见 [`docs/DOCS-INDEX.md`](docs/DOCS-INDEX.md)。

本项目的设计文档与规范集中在 **`docs/design/`** 目录：

| 文档 | 说明 |
|------|------|
| [docs/design/DESIGN.md](docs/design/DESIGN.md) | 本项目视觉主题、色彩、排版、组件概要 |
| [docs/design/DESIGN-SYSTEM-REFERENCE.md](docs/design/DESIGN-SYSTEM-REFERENCE.md) | **可复用**设计习惯与交互规范（Tooltip/光标/开关与芯片/色彩语义/移动端/无障碍等）；**单一事实来源** |
| [docs/design/frontend-interaction-guardrails.md](docs/design/frontend-interaction-guardrails.md) | 前端交互守则（含 AaveAPY 专项：Forecast UI、Reserves 表、InkAprCalculator、**Merkl whitelist（按 campaignId）** 等） |
| [docs/design/mobile-reserve-card-ascii-layout.md](docs/design/mobile-reserve-card-ascii-layout.md) | 移动端储备卡排版 ASCII（含 Current / Proposed） |
| [docs/design/tooltip-arrow.md](docs/design/tooltip-arrow.md) | Tooltip 箭头（callout arrow）规范：SVG 双 path + Radix `data-side` 自动 flip + 与 `IncentiveTooltip` 自定义箭头并排对比 |

修改 tooltip/筛选/forecast 等交互时，请同步更新 `docs/design/frontend-interaction-guardrails.md`；新增可复用设计习惯请更新 `docs/design/DESIGN-SYSTEM-REFERENCE.md`。
