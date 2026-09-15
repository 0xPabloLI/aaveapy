# Spec: Chainlink Arc (V4) 新链接入 — chainIconMap + registry 对齐

**Status**: Ready for agent
**Date**: 2026-09-16
**关联**: GitHub #629 / AAV-1284 / AAV-1283 (无关), ADR-0020
**类型**: bug（CI verify 持续 fail）+ 新链接入

## Problem Statement

Hardcode Sync CI 在 dev/main/lovable 三分支每日 fail（自 2026-09-10 起，#629 已积累 6 次报警）。根因：`@aave-dao/aave-address-book@4.68.0` 新增 `AaveV4Arc` 模块（Chainlink Arc 链，chainId **5042**，SPOKES 架构）。CI 每日 `npm update address-book` 后，`discoverMainnetChainIds()` 与运行时 chainRegistry 均将 5042 计入，但 `chainIconMap` 无 5042 条目 → verify 报 `chainRegistry ↔ chainIconMap chainId mismatch` → exit 1。

用户视角影响：CI 报警噪音；若不修复，未来后端返回 5042 市场数据时 UI 链图标缺失（fallback 行为）。

## Solution

一次性完成新链 hardcode 接入四件套：升级 address-book（lock）→ chainIconMap 补 5042 → 占位 SVG → 重新生成 manifest。四者**必须同一 commit**（check 脚本双向对齐检查，缺一即反向 mismatch）。

## 实测事实链（evidence base）

- 本地 4.66.4：`check:chain-icons-upstream` 全绿（21 链对齐），`AaveV4Arc` 不存在 → CI/本地环境不一致
- 4.68.0 tarball 实测：`AaveV4Arc { CHAIN_ID: 5042, SPOKES: true }`；同链还有 `MiscArc`、`ChainlinkArc`（均无 POOL/SPOKES，不进 registry）
- 运行时 `chainRegistry.ts` 与 `scripts/lib/chain-utils.mjs` 发现逻辑一致（POOL 或 SPOKES）；`shouldIncludeModule('AaveV4Arc')` = true（不在排除表）
- check 脚本为**双向**检查（`inRegistryNotIcon` + `inIconNotRegistry`）→ 只改 map 不升包会触发反向 mismatch
- 上游 aave/interface `networksConfig.ts` 暂无 5042 → `check:chain-icons-upstream` 的 mapping/asset 段不涉及；`sync-chain-icon-map-upstream --write` 不会自动补 → 需手动加

## Test Seams（全部复用既有 seam，零新增）

1. `getChainIconSrc(chainId)` — `src/lib/chainIcons.test.ts`（既有 3 用例，最高运行时 seam）
2. `AAVE_V4_CHAIN_IDS` — `src/lib/chainRegistry.test.ts`（既有 V4 断言组）
3. `npm run check:chain-icons-upstream` — CI verify 的真实脚本，runtime smoke

## User Stories

1. As a维护者, I want hardcode-sync CI 恢复绿色, so that #629 停止每日重复报警
2. As a维护者, I want chainRegistry ↔ chainIconMap ↔ SVG 三方对齐保持 22 链, so that ADR-0020 契约持续成立
3. As a DeFi 用户, I want 未来后端返回 Chainlink Arc 市场时链图标正常渲染（占位）, so that 不出现 broken image 或纯文字 fallback
4. As a DeFi 用户, I want 现有 21 条链图标完全不受影响, so that 升级无回归
5. As an agent/未来维护者, I want registry 新链自动发现时有对应单测防回归, so that 下次新链接入不再靠 CI 日报警驱动
6. As a维护者, I want 本地与 CI 的 address-book 版本一致, so that hardcode:verify 本地可复现 CI 结果

## Implementation Decisions

1. **npm update address-book 4.66.4 → 4.68.0**（lock 变更提交）：与 CI 环境对齐；5042 成为运行时 V4 链。连带效应：`CHAIN_RPC_URLS` 无 5042 → 走既有 chainDiscovery fallback（chainid.network → chainlist.org），与 megaeth/plasma 等新链先例一致，不新增代码。
2. **chainIconMap 加 `5042: 'chainlink-arc'`**：遵循 ADR-0020 chainId 索引决策；格式必须满足脚本解析 regex `(\d+)\s*:\s*'([^']+)'`。
3. **占位 SVG（方案 A，用户已确认）**：`public/icons/networks/chainlink-arc.svg`，中性设计（圆底 + "CL" monogram），后续有正式 logo 可直接替换文件不动代码。
4. **重新生成 manifest**：`node scripts/generate-chain-icon-manifest.mjs` → `chainIconManifest.generated.ts` 追加 `"chainlink-arc": ["svg"]`。
5. **不加 pending allowlist**：`scripts/data/pending-chain-icon-bases.json` 是"允许无文件"逃生门；占位 SVG 已就位，走三方对齐正道。
6. **不改 check 脚本语义**：脚本与运行时逻辑已一致，mismatch 是真实的（包升级后），修数据不修检查器。
7. **分支策略**：fix 基于 dev（权威源）→ PR → dev。main 靠 #640（dev→main）带入；lovable 靠 dev→lovable sync。不单独开直通 main 的 PR。

## Testing Decisions

- 只测外部行为：`getChainIconSrc` 返回值、registry 集合成员、check 脚本退出码；不测内部实现
- 新增用例（先 red 后 green）：
  - `chainIcons.test.ts`: `getChainIconSrc(5042)` → `'/icons/networks/chainlink-arc.svg'`
  - `chainRegistry.test.ts`: `AAVE_V4_CHAIN_IDS` contains 5042；`getAaveProtocolVersion(5042)` → `'v4'`
- 回归护栏：既有 21 链测试不动（ethereum.svg / monad.svg / 999999-undefined 用例天然防回归）
- runtime smoke：`npm run check:chain-icons-upstream` 期望 `all 22 chainIds aligned`

## Scenario & Risk Verification Matrix

### Section 1: Modified Files Impact

| 文件 | 修改内容 | 风险等级 | 评估 |
|------|---------|---------|------|
| `package-lock.json` | address-book 4.66.4→4.68.0 | Medium | 激活 5042 为运行时 V4 链。后端 /markets 无该链数据则 UI 不显示（无用户可见变化）；V4 SPOKES 读取走既有 fallback。最坏后果：新链数据读取失败——与既有新链先例同路径，可接受 |
| `src/lib/chainIconMap.ts` | 追加 `5042: 'chainlink-arc'` | Low | 纯追加一行，不改现有逻辑；9 个消费方均有 `chainSrc &&` 空值保护 |
| `src/lib/chainIconManifest.generated.ts` | 生成文件追加条目 | Low | 生成脚本产物，不手改 |
| `public/icons/networks/chainlink-arc.svg` | 新增占位图标 | Low | 纯新增，无既有消费者 |
| `src/lib/chainIcons.test.ts` | 追加 5042 用例 | Low | 纯追加测试 |
| `src/lib/chainRegistry.test.ts` | 追加 V4/5042 用例 | Low | 纯追加测试 |

### Section 2: Behavioral Scenarios

| # | Scenario | Expected Behavior | Risk | Evidence | Mitigation |
|---|----------|-------------------|------|----------|------------|
| 1 | `getChainIconSrc(5042)` | 返回 `'/icons/networks/chainlink-arc.svg'` | Low | automated test（chainIcons.test.ts） | — |
| 2 | 5042 registry 归属（4.68.0 下） | `AAVE_V4_CHAIN_IDS` 含 5042；`getAaveProtocolVersion(5042)==='v4'` | Low | automated test（chainRegistry.test.ts） | — |
| 3 | check 脚本双向对齐 | `check:chain-icons-upstream` 输出 `all 22 chainIds aligned`，exit 0 | Low | runtime script smoke | — |
| 4 | 现有 21 链图标路径回归 | ethereum/monad 等既有路径不变；999999 仍 undefined | Low | automated test（既有用例 + 全量 vitest） | — |
| 5 | manifest 含新条目 | `CHAIN_ICON_MANIFEST["chainlink-arc"] === ["svg"]` | Low | static check（生成后 git diff + build） | — |
| 6 | UI 对 5042 无数据时的表现 | 后端 /markets 无 5042 reserves → UI 不出现新链（现状不变） | Low | runtime-real-data smoke（staging API） | — |
| 7 | 5042 有数据后的图标渲染 | 占位 SVG 正常显示（非 broken image） | Low | human acceptance | 当前无数据，deferred 至链上线后验证 |
| 8 | hardcode:verify 全链路 | 8 个 check 全过 | Low | runtime script smoke（本地全量跑） | — |

## Out of Scope

- Chainlink Arc 正式 logo 设计/获取（后续替换 SVG 文件即可）
- `MiscArc`/`ChainlinkArc` 模块（无 POOL/SPOKES，不进 registry，不处理）
- 5042 的 RPC URL 手工策划（`CHAIN_RPC_URLS`）——走 chainDiscovery fallback，等真实市场数据后再评估
- 后端（aave-protocol-analysis）侧的 address-book 升级——独立仓库独立节奏
- main/lovable 分支的直接修复——走既有同步流（#640 / dev→lovable sync）

## Further Notes

- CI 报错日志与本地复现的差异（本地全绿）源于 address-book 版本差，spec 的"实测事实链"已记录取证方法（npm pack + tarball grep），供未来同类 mismatch 排查复用
- #629 关闭条件：fix 进入 dev 后，hardcode-sync 次日 schedule 在 dev 分支 verify 通过即可关闭（main/lovable 的独立报警随同步流消失）