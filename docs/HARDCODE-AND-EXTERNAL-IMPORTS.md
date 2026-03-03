# 硬编码与外部依赖清单（前端）

## 1. 上游来源与本地落点

| 主题 | 上游来源 | 本地文件 |
|---|---|---|
| 链图标映射 | `aave/interface/src/ui-config/networksConfig.ts` | `src/lib/chainIconMap.ts` |
| 市场名映射 | `aave/interface/src/ui-config/marketsConfig.tsx` | `src/lib/aaveLinks.ts` (`MARKET_NAME_MAP`) |
| reserve patch | `aave/interface/src/ui-config/reservePatches.ts` | `src/ui-config/reservePatches.ts` |
| token 图标素材 | `aave/interface/public/icons/tokens` + tokenlist/CoinGecko | `public/icons/tokens` |

说明：
- `chainId/chainName` 以运行时 API 数据为主，不维护静态总表。
- `chainIconMap` 已统一为单一来源：`src/lib/chainIconMap.ts`。

## 2. 已自动化（GitHub Actions）

| 工作流 | 频率 | 作用 |
|---|---|---|
| `.github/workflows/token-icon-sync.yml` | 每天 1 次 | 同步 token icons，变更自动开 PR |
| `.github/workflows/hardcode-drift-check.yml` | 每天 1 次 | 运行 drift checks（icons / reserve patches / market map / chain icon map） |

触发方式：
- `schedule`（每天）
- `repository_dispatch`（`event_type=upstream-change`，供 webhook relay 触发）

## 3. 未自动化（有意保留）

| 项目 | 原因 | 处理方式 |
|---|---|---|
| `ETHEREUM_MARKET_NAMES`、`TYDRO` 常量、Ink 参考点 | 业务策略常量，不是上游镜像数据 | 人工评审 |
| 固定品牌/合作方图标 | 自有资产，不依赖上游仓库 | 人工维护 |

## 4. N8N 是否必需

- 当前前端 hardcode 场景：**非必需**（GitHub Actions 已覆盖核心自动化）。
- 适合引入 N8N 的场景：
  - 失败后自动建单（Linear/Jira）并通知 owner。
  - 多仓联动编排（前后端同步、审批流、定时汇总）。
