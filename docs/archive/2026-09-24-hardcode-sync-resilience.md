# Handoff: Hardcode Sync 韧性改进 + 三分支同步流程

> 日期：2026-09-24
> 触发：Chainlink Arc（chainId 5042）接入导致 Hardcode Sync 卡死 14 天（GitHub #629 / AAV-1284）
> 关联 Issue：#667（韧性改进）、#668（chainIconMap 自动化）
> 状态：方案已定，待实施

## 1. 事件复盘

### 现象
- #629 自 2026-09-10 起 14 次失败评论，Hardcode Sync（04:20 UTC）+ Drift Check（05:00 UTC）每日报红
- main / lovable 的 Chainlink Arc 链图标缺失

### 根因
`@aave-dao/aave-address-book` 新增 `AaveV4Arc`（chainId 5042，SPOKES）。dev 通过 PR #642 手工接入三件套（chainIconMap + 占位 SVG + tokenPriceResolver），但 main / lovable 未同步。

**机制故障**：`hardcode:sync` 的 `sync:chain-icons-upstream` 无法从 aave/interface 自动补 5042（上游未收录）→ verify 两轮 fail → 不建 PR（`hardcode-sync.yml` 第 129-131 行）→ 同步瘫痪。

### 已采取的止血
- PR #640 dev→main 冲突解除（冲突仅在 package-lock.json，取 dev 版本）
- PR #666 dev→lovable 创建（fast-forward）
- PR #654 / #664 合并，#662 关闭（重复）
- 冗余分支 fix/chainlink-arc-5042 清理

## 2. 改进项

### 2.1 Hardcode Sync 韧性（#667）
缺陷（按严重度）：
1. 「全或无」门禁 + 不可自动修复项 = 单点故障
2. 缺降级路径（SVG 有 pending 白名单，chainIconMap 无）
3. sync 脚本 dry-run 当修复用（`sync:chain-icons-upstream` 不带 `--write`）
4. 告警无升级机制
5. e2e flaky 阻塞大批 PR

### 2.2 chainIconMap 自动化（#668）
- `sync-chain-icon-map-upstream.mjs` 已有 `--write` 能力，但数据源只有 aave/interface
- 方案：增加 `discoverMainnetChainIds()` 数据源，对 registry 有而 map 无的 chainId 自动生成占位条目
- 难点：slug 推导（5042 → 'chainlink-arc'），需 address-book 模块名映射 / chainlist API / 手工补充表

## 3. 三分支同步流程优化

### 现状
- 流程：lovable → dev → main（`branch-flow-guard` 强制）
- 问题：三方各自漂移（main 曾落后 dev 77、lovable 落后 20）；release PR #640 长期 open 累积冲突；bot 对三分支各开 PR 成本高

### 方案（保持三分支，用户 2026-09-24 确认）
1. **发布节奏固定**：dev → main 每周固定窗口发布，避免累积大量 commits
2. **bot PR 收敛**：hardcode-sync 只对 dev 开 PR；dev → main / lovable 由发布流程同步
3. **冲突预防**：dev → main PR 定期 update-branch（rebase）避免冲突累积
4. **staging gate**：dev 部署后 deployment-smoke-test 必须通过才允许 dev → main 合并

## 4. 实施顺序
1. chainIconMap 自动化（#668）→ 解除单点故障
2. verify 拆 required / optional → 容忍待人工项
3. 发布节奏 + bot 收敛 → 减少漂移
4. e2e flaky 修复 → 解除 PR 阻塞