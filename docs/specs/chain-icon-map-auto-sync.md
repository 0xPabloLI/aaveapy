# Spec: chainIconMap 自动同步 — 从 registry 自动生成占位条目

**Status**: Draft（待用户确认）
**Date**: 2026-09-24
**关联**: AAV-1297 / GitHub #668、AAV-1296（后续）、#629 / AAV-1284（前车）、ADR-0020
**类型**: enhancement（CI hardcode sync 韧性）
**前置阅读**: docs/archive/2026-09-24-hardcode-sync-resilience.md、docs/specs/chainlink-arc-v4-chain-onboarding.md（手工接入先例）

## Problem Statement

CI 每日 `npm update @aave-dao/aave-address-book` → registry 新链（如 5042 AaveV4Arc）进入 `discoverMainnetChainIds()` → `check:chain-icons-upstream` 的 registry↔map 双向校验发现 `chainIconMap` 缺条目 → verify fail。而 `sync-chain-icon-map-upstream.mjs` 数据源只有 aave/interface networksConfig（上游未收录 5042），且 `hardcode:sync` 调用不带 `--write`（dry-run）→ 无法自愈 → 两轮失败不建 PR → 同步瘫痪（#629 瘫痪 14 天）。

实测事实链：本地 lock 4.66.4（21 链全绿、无 AaveV4Arc）vs CI 4.68+（22 链、含 5042）。dev 已手工接入 `5042: 'chainlink-arc'` + SVG（PR #642）；main/lovable 靠本任务自动收敛。

## Solution

### 双源统一模型

`sync-chain-icon-map-upstream.mjs`（--write 模式）处理两条数据源，每条链的最终 slug 收敛规则：

1. **upstream iconBase**（networksConfig 已收录）：真值，`iconBaseFromPath(networkLogoPath)`。若 map 现值 ≠ iconBase → **rename 自愈**（改条目 + SVG 对齐）。
2. **registry-only 链**（registry 有、map 无、networksConfig 无）：slug 六级推导，追加占位条目。

### Slug 推导链（registry-only 链）

| 级 | 来源 | 规则 | 示例 |
|---|------|------|------|
| 0 | upstream iconBase | networksConfig 收录时直接用（rename 收敛方向） | 5042 → `chainlink-arc` |
| 1 | `scripts/data/chain-slug-overrides.json` | 人工指派表（upstream 未收录时） | `{"5042": "chainlink-arc"}` |
| 2 | address-book 模块名 | 剥 `AaveV3`/`AaveV4` 前缀 + camelCase→kebab | `AaveV4Arc` → `arc` |
| 3 | viem/chains 本地查找 | id → name → kebab，零网络 | 8453 → `base` |
| 3.5 | chainid.network API | 3s 超时 + catch，viem 查不到时的兜底 | — |
| 4 | 安全兜底 | `chain-${chainId}` | 9999 → `chain-9999` |

约定：overrides 值大写自动 lowercase；含非法字符（非 `[a-z0-9-]`）fail-fast（人工维护表，静默规范化掩盖拼写错误）。同一 chainId 多模块时模块名排序取第一（确定性）。

### 占位 SVG

- registry-only 链追加条目时：若 `public/icons/networks/<slug>.svg` 不存在 → 生成占位 SVG（复刻手工版形态：200×200 圆形中性渐变底 + monogram，monogram = slug 首段前 2 字符大写的机械规则，`arc` → `AR`）。注意：dev 手工版 `chainlink-arc.svg` 用品牌缩写 `CL`，机械规则推出 `CH` —— dev 同步到 main/lovable 时可能与自动生成版产生一次性 add/add 冲突，由同步流程人工解决（取 dev 版），之后三分支一致。
- rename 时新 slug 无文件 → 优先从 upstream 下载（`UPSTREAM_PUBLIC_ROOT` + networkLogoPath，fetchWithTimeout），失败降级生成占位。
- 已存在的 SVG 文件一律不覆盖。
- manifest 无需显式联动：`hardcode:sync` 链条中 `sync:chain-icons-upstream` 排在 `generate-chain-icon-manifest.mjs` 之前，SVG 落盘后自动拾取。

### 原子性

所有占位 SVG 生成成功后才写 chainIconMap；任一失败 exit 1 且不写 map。

### verify 闭环

`--write` 后 registry↔map 必然对齐（Level 4 兜底保证总能产出条目）→ `check:chain-icons-upstream` 通过 → bot PR 正常创建。main/lovable 下次 schedule 自动补 5042（overrides 命中 `chainlink-arc`）→ 三分支收敛。

### dry-run 语义保留

不传 `--write` 时仅报告 gaps 并 exit 1（现状语义）；npm script 接线传 `--write`。

## Test Seams

- **新建 `scripts/lib/chain-slug.mjs`**（纯函数模块）：`deriveChainSlug({ chainId, moduleName, overrides, viemChains, fetchImpl })` → `{ slug, source }`；`renderPlaceholderSvg(monogram)`；`loadSlugOverrides(content)`。
- **sync 脚本导出**：`computeRegistryGaps` / `applyUpstreamRenames`（实施时定名）。
- 测试文件 `scripts/sync-chain-icon-map-upstream.test.mjs`，框架 node:test（先例 `sync-reserve-patches-upstream.test.mjs`），全部注入数据、零真实网络（L3.5 真实端点单独 runtime smoke）。
- vitest 配置显式 exclude `scripts/**`，故入口挂 `npm test`：`node --test scripts/`。

## User Stories

1. As a 维护者, I want registry 新链自动出现在 chainIconMap + SVG + manifest, so that 新链接入不再手工、不再阻塞 verify。
2. As a 维护者, I want main/lovable 的 5042 缺口下次 CI 自动修复, so that 三分支收敛、#629 类瘫痪不再发生。
3. As a 维护者, I want upstream 收录后 map 条目自动向 iconBase 收敛, so that rename 不需要人工介入。
4. As an agent, I want slug 推导有纯函数单测, so that 回归在本地 gate 拦截而非 CI 日报警驱动。

## Implementation Decisions

1. **Level 3 用 viem/chains + Level 3.5 chainid.network**（用户确认两者都接）：viem 是直接依赖（^2.51.3，715 链导出）零网络；chainid.network 带 3s 超时作 L3.5 兜底。偏离 issue 评论原方案（仅 chainid.network）的理由：审查建议本身强调避免外部网络依赖（CI 曾被 Cloudflare/DNS 拦截）。
2. **rename 自愈纳入**（用户确认）：无自愈则上游收录时 verify 必然再挂一次（mapping check 按 iconBase 值判定，sync gap 按 chainId 判定，维度不同）。
3. **npm script 加 `--write`**：`sync:chain-icons-upstream": "node scripts/sync-chain-icon-map-upstream.mjs --write"`。drift-check workflow 纯只读（已核实无 sync 调用）不受影响。
4. **测试入口挂 `npm test`**：`"test": "node scripts/generate-icon-manifests.mjs && vitest run && node --test scripts/"`。本地与 ci:remote 一次跑全；顺带激活既有死测试 sync-reserve-patches-upstream.test.mjs。
5. **registry import 失败 fail-fast**（exit 1）：与 networksConfig fetch 失败行为一致，静默降级会掩盖"新链未同步"。
6. **不动 check 脚本语义**（与 5042 先例 spec 决策 6 一致）：mismatch 是真实问题，sync --write 修数据。verify 拆分归 AAV-1296。
7. **本地不动 lock**：address-book 停留 4.66.4，真实 5042 场景由 CI 环境验证；单测用注入数据覆盖。
8. **chain-utils.mjs 新增 `discoverMainnetChainModules()`**：返回 `Map<chainId, moduleName>`（L2 输入），现有 `discoverMainnetChainIds()` 不动（check 脚本继续用）。

## Scenario & Risk Verification Matrix

### Section 1: Modified Files Impact

| 文件 | 修改内容 | 风险等级 | 评估 |
|------|---------|---------|------|
| `scripts/sync-chain-icon-map-upstream.mjs` | +registry 第二数据源、slug 推导接入、占位 SVG 生成、rename 自愈、纯函数导出 | Medium | networksConfig 源 gap 判定（`has(chainId)`）与写入格式（`  <id>: '<base>',`）不变；新增逻辑独立分支不影响既有路径；最坏后果：写入格式错 → verify fail → CI 报警（与现状同级），写入格式有单测（场景 12） |
| `scripts/lib/chain-slug.mjs` | 新建：slug 六级推导 + overrides 加载 + SVG 渲染纯函数 | Low | 纯新增模块，无既有消费者；被 sync 脚本与测试共同引用 |
| `scripts/lib/chain-utils.mjs` | 新增 `discoverMainnetChainModules()` | Low | 纯新增导出；`discoverMainnetChainIds()` 与其消费方（check 脚本、chainRegistry）不动 |
| `scripts/data/chain-slug-overrides.json` | 新建 `{"5042": "chainlink-arc"}` | Low | 纯新增；加载失败 fail-fast |
| `package.json` | `sync:chain-icons-upstream` 加 `--write`；`test` 追加 `node --test scripts/` | Medium | sync 链从 dry-run 报错变为自动写入+建 PR（即修复目标）；drift-check 只读不受影响（workflow 已核实）；npm test 时间增量 <1s；既有死测试被激活（其通过性在 T1 验证） |

### Section 2: Behavioral Scenarios

| # | Scenario | Expected Behavior | Risk | Evidence | Mitigation |
|---|----------|-------------------|------|----------|------------|
| 1 | registry-only 链 + overrides 命中（CI 上 5042） | 追加 `5042: 'chainlink-arc'` + 占位 SVG 落盘 | Low | automated test | overrides 首条目即真实案例 |
| 2 | registry-only + overrides 未命中 + `AaveV4Arc` | L2 推导 `arc` | Low | automated test | — |
| 3 | L2 未命中模块名（非 AaveV3/V4 前缀） | camelCase→kebab（如 `BnbChain` → `bnb-chain`） | Low | automated test | — |
| 4 | 无模块名 → viem/chains 命中 | kebab(name)（8453 → `base`） | Low | automated test（真实 viem 导出） | — |
| 5 | viem 未命中 → chainid.network | 3s 超时 + catch 后采用结果 | Medium | runtime-real-data smoke（真实端点）+ automated test（注入 fetch 超时） | 超时不阻塞：catch 后落 L4 |
| 6 | L3.5 失败/超时 | `chain-<id>` 兜底，永不 throw | Low | automated test | L4 保证 verify 闭环 |
| 7 | chainId 已在 map | 不追加、不覆盖 | Low | automated test | — |
| 8 | map 现值 ≠ upstream iconBase | rename 条目 + SVG 对齐（下载优先/占位降级） | Medium | automated test（注入 fetch 失败） | rename 方向单向收敛到 iconBase |
| 9 | rename 目标 slug 已有文件 | 不覆盖既有 SVG | Low | automated test | — |
| 10 | 任一 SVG 生成失败 | 不写 map，exit 1（原子性） | Low | automated test | map 与盘上文件不一致是唯一不一致态，靠 fail-fast 排除 |
| 11 | dry-run（无 --write） | 仅报告 gaps，exit 1 | Low | runtime smoke（本地） | 语义与现状一致 |
| 12 | 写入格式跨 step 契约 | 写后回读满足 check regex `(\d+)\s*:\s*'([^']+)'` | High | automated test（写后 parse 往返） | 契约破坏 = verify 挂 → CI 报警 |
| 13 | registry import 失败 | exit 1 fail-fast | Low | static review | 与 networksConfig fetch 失败行为一致 |
| 14 | 本地 4.66.4（无新链） | 无 gap，exit 0 不误报 | Low | runtime smoke（本地 dry-run） | — |
| 15 | SVG 落盘 → manifest 拾取 | hardcode:sync 链条顺序保证（sync 在 generate-manifest 前） | Low | static check（package.json 顺序）+ runtime smoke | — |
| 16 | overrides 值大写 / 非法字符 | 大写自动 lowercase；非法字符 fail-fast | Low | automated test | — |
| 17 | 同 chainId 多模块 | 模块名排序取第一，确定性 | Low | automated test | — |
| 18 | CI 端到端：main/lovable 自动补 5042 + bot PR | 三分支 map/SVG 收敛，verify 绿 | Medium | human acceptance（合并后次日观察 hardcode-sync run） | overrides 表保证与 dev 手工值一致 |
| 19 | npm test 激活 scripts 测试 | node --test scripts/ 全绿（含既有死测试） | Low | runtime smoke（本地 npm test） | — |
| 20 | UI 渲染（map + manifest + SVG 齐备时占位显示） | `getChainIconSrc` 既有机制，不新增行为 | Low | static（既有 chainIcons.test.ts 覆盖机制） | — |

## Out of Scope

- AAV-1296 的 verify 拆分（critical/advisory 门禁分级）
- chainIconMap 孤儿条目清理（registry 与 upstream 均无的 map 条目 → verify 报警人工处理，sync 不删）
- Chainlink Arc 正式 logo 设计（后续替换 SVG 文件即可）
- `MiscArc` / `ChainlinkArc` 模块（无 POOL/SPOKES，不进 registry）
- `hardcode:sync` 其他子命令（reserve-patches / market-name-map 等）的 --write 语义
- 本地 address-book lock 升级（走 CI npm update 自然演进）
- 后端仓库侧改动

## Further Notes

- 三个设计决策已经用户确认（2026-09-24）：L3 双源（viem + chainid.network）、rename 自愈纳入、测试入口挂 npm test。
- 5042 的正确 slug 必须靠 overrides 表（L2 推导出 `arc` ≠ dev 手工值 `chainlink-arc`）；overrides 表是三分支收敛一致性的锚点。
- rename 场景的概率评估：上游 aave/interface 收录新链通常滞后 address-book 数周，窗口期内 L2/L4 占位条目先落地，收录时 rename 自愈接管。
