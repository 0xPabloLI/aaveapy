# e2e 选择器不得钉死链名（数据漂移守卫）

指针：规则实现在 `scripts/lib/e2e-market-name-literals.mjs`，CLI 是 `npm run check:e2e-market-names`；本文记录为什么是这条规则、边界在哪、以及哪些部分**没有**自动强制。

## 起因

2026-09-30 上游 `/markets` 的链集合从含 Arbitrum/Celo 收敛到 **Arc / Avalanche / Base / Ethereum**（生产与 staging 一致，各 100 条 reserve）。两条 e2e 用例因此变红，但报的是**定位器超时**，第一眼像 flake：

- `reserves-table-mobile-interactions.spec.ts` 钉 `button:has-text("Arbitrum")`
- `reserves-table-interactions.spec.ts` 钉 `button:has-text("Celo")`

同一批数据变化还暴露了第二个形态假设：行内现在同时渲染 `Filter by <hub> hub` 与 `Filter by <market> market` 两个芯片，裸前缀选择器 `[aria-label^="Filter by "]` 会命中两个 → Playwright strict mode violation。

## 规则

**选择器字面量里不得出现链名；候选列表里可以。** 区别在于后者容忍缺席（`fallbackMarkets` 那种"探不到就换下一个"），前者把测试命运绑在一个会漂移的数据值上。仓库既有的正确写法是从渲染结果里取芯片（`pickAlternateVisibleMarket`），本守卫把这条约定变成机器可查。

词汇来源是 `src/lib/chainIconMap.ts`（chainId → slug），由 `check:chain-icons-upstream` 保持与上游同步。不在脚本里另立一份名单，否则守卫自己会先过期。

**为何不做「与 /markets 实时比对」**：那会把 PR 健康绑到外部 API（写这台机器上 curl 同一接口三次里断过两次），且离线规则已经能挡住本次事故形态。代价是守卫只认链名、且不判断"该名字今天还在不在数据里"。

## 已知覆盖边界

- 只覆盖链名。hub 名（`Core` / `Plus` / `Prime`）词义太通用，`has-text("Core")` 会大量误报，明确不纳入。
- 只扫选择器调用所在行（`has-text(` / `getByText(` / `getByPlaceholder(` / `getByRole(` / `locator(`）。数组字面量、变量、注释不进判定。
- 逃生阀：行内加 `market-name-guard: allow`（给"文案里恰好含链名"的合法情形，如 rate bucket 标签）。
- 词汇表解析为空时 CLI **报错退出**而非静默通过——否则上游改名会让守卫变成空跑。

## Section 1: Modified Files Impact

| 文件 | 修改内容 | 风险等级 | 评估 |
|------|---------|---------|------|
| `scripts/lib/e2e-market-name-literals.mjs` | 新建：纯函数扫描器 | Low | 无既有消费者 |
| `scripts/check-e2e-hardcoded-market-names.mjs` | 新建：CLI + 非空词汇守卫 | Low | 依赖只有 fs/path，符合 repo-policy「免 npm ci」前提 |
| `scripts/check-e2e-hardcoded-market-names.test.mjs` | 新建：11 条矩阵用例 | Low | 由 `node --test "scripts/**/*.test.mjs"`（pre-commit + `npm test`）执行 |
| `package.json` | 新增 `check:e2e-market-names` | Low | 纯追加；`check:agents-md` 只校验 AGENTS.md 引用，不受影响 |
| `.github/workflows/ci.yml` | `repo-policy` job 增加一步；注释 three→four | Medium | 该 job 已是策略检查聚集地，非 main 必需检查；失败可见但不阻塞发布 |
| `.husky/pre-commit` | 增加 `npm run check:e2e-market-names` | Medium | 纯本地文件扫描，耗时 <1s；不把红推给推送阶段才发现 |
| `e2e/marketChips.ts` | 新建 `pickChainChip()` seam | Low | 取代两处各写一遍的"跳过 All 芯片"循环 |
| `e2e/reserves-table-mobile-interactions.spec.ts` | Arbitrum 字面量 → `pickChainChip()` | Medium | 断言语义不变（切换市场后展开态不悬空），只换选芯片的方式 |
| `e2e/reserves-table-interactions.spec.ts` | Celo 字面量 → `pickChainChip()`；取消筛选改点 `All` 复位芯片；3 处 `Filter by ` 前缀补 `$=" market"` 后缀 | Medium | 位置化芯片在选中后列表可能重排，改点 `All` 更稳；后缀锚定防 hub 芯片串味 |
| `e2e/reserves-table-market-filter-pin.spec.ts`、`e2e/reserves-table-stick.spec.ts` | `marketChipForReserve()` 与 1 处前缀选择器补 ` market` 后缀 | Medium | **行为改变**：此前它们可能点中的是 hub 芯片（即测错了对象）。改后测的是市场芯片，11 条用例转绿 |

## Section 2: Behavioral Scenarios

| # | Scenario | Expected Behavior | Risk | Evidence |
|---|----------|-------------------|------|----------|
| 1 | 从 chainIconMap 文本取词汇 | 得到 `['arbitrum','base','ethereum','ink','megaeth']` 全集 | Medium | automated test |
| 2 | map 文本为空或不可解析 | 词汇为空集，且 CLI 侧**非零退出**而非放行 | High（空跑守卫） | automated test + runtime（`vocabulary.size === 0` 分支） |
| 3 | `locator('button:has-text("Arbitrum")')` | 命中，报告行号与名字 | High | automated test + 正对照（`git show` 事故前文件 → 命中 line 37 [Arbitrum]） |
| 4 | `getByText('Base')` / `{ name: /Ink/i }` / `{ name: "MegaETH" }` | 三种写法都命中 | Medium | automated test |
| 5 | `{ name: new RegExp(escapeRegExp(v)) }` | 不命中（变量而非字面量） | Medium | automated test |
| 6 | `const fallbackMarkets = ['Arbitrum', ...]` | 不命中（候选列表容忍缺席） | High（误报会让人关掉守卫） | automated test |
| 7 | 注释或散文里写 Arbitrum | 不命中 | Low | automated test |
| 8 | `getByText("Database")` vs `getByText("Base")` | 前者不命中、后者命中 | Medium | automated test |
| 9 | 词汇表外的链名（Fantom） | 不命中（词汇即边界） | Low | automated test |
| 10 | 行内含 `market-name-guard: allow` | 跳过该行 | Medium | automated test |
| 11 | `#base-rate`、`baseAsset` 这类相邻字符 | 不命中（`(?<![\w-])`…`(?![\w-])`） | Medium | automated test |
| 12 | 行内同时存在 hub 芯片与市场芯片 | 选择器只取市场芯片，测试点的是市场 | High | runtime（11 条桌面用例转绿；改前为 strict mode violation / 标签解析异常） |

## 证据

1. `node --test scripts/check-e2e-hardcoded-market-names.test.mjs` → **11/11**（先 red：引号配对版实现漏掉反引号嵌套的字面量，row 3 失败后改成整行 + 严格词边界）。
2. 正对照：对 `git show 0b6ed5e3:e2e/reserves-table-mobile-interactions.spec.ts` 运行扫描 → 命中 `line 37 [Arbitrum]`，即守卫会挡住本次事故形态，而不是只跟着修好的代码绿。
3. 现网全量：`npm run check:e2e-market-names` → `29 specs scanned, 22 names in vocabulary`，rc=0。
4. 运行时用例：mobile spec 2 passed；`reserves-table-interactions` + `market-filter-pin` + `stick` 合计 **11 passed / 1 skipped**（改前三处红：strict mode violation 与 `Filter by Plus hub` 解析异常）。
5. 静态门：`npm run typecheck` / `lint` / `knip` / `dup:check` 见提交说明。

## 未纳入本改动（如实记录）

- **e2e 里 42 处 `Parameters<typeof test>[0]['page']` 是类型错误**（该表达式解析到 Playwright `test` 的重载之一，首参是标题字符串，所以 `['page']` 不存在；正确写法是 `import type { Page }`）。横跨 8 个 spec，`tsconfig.app.json` 的 `include` 只有 `src`，所以仓库从未看见。本改动只在裸 `tsc` 下把它照出来，**未修**，应单独开票。
- `pickAlternateVisibleMarket`（interactions 内私有）与新 `pickChainChip` 形态部分重叠，未合并，避免本次范围外扩。
- hub 名、以及"名字今天是否还在数据里"不在守卫射程内（见「已知覆盖边界」）。
