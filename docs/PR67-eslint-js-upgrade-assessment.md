# PR #67 评估：@eslint/js 9 → 10 升级

**已执行**：CI Node 已统一升到 **22**，**eslint** 与 **@eslint/js** 已升到 **^10.0.1**，并修了 ESLint 10 新增规则 `no-useless-assignment` 的一处报错；安装使用 `legacy-peer-deps`（因 eslint-plugin-react-hooks 尚未声明对 eslint 10 的 peer）。下面内容保留作背景与「谁触发了 PR」的说明。

---

## 结论（先看这个）

| 项目 | 结论 |
|------|------|
| **是否有 Breaking Change** | ✅ **有**，且较多 |
| **单合 PR 67 是否值得** | ❌ **不值得**：只升 @eslint/js 会与当前 eslint 9 不匹配 |
| **若要做完整升级** | 需连同 **eslint 10** 一起升，并处理新规则与 Node 要求 |

---

## 1. PR 67 现状

- **内容**：Dependabot 将 `@eslint/js` 从 9.39.2 提到 **10.0.1**（仅改 package.json + package-lock.json）。
- **状态**：与当前分支 **CONFLICTING**，需解决冲突。

---

## 2. 为何不能“只升 @eslint/js”

- `@eslint/js` 10 的 **peerDependency** 要求使用 **eslint 10**（见 [eslint#20467](https://github.com/eslint/eslint/issues/20467)）。
- 当前仓库是 **eslint ^9.32.0**，若只把 `@eslint/js` 升到 10：
  - 会出现 peer 依赖不满足（npm 会告警或按策略装 eslint 10，但版本策略不清晰）。
  - 官方设计是 **@eslint/js 与 eslint 主版本一致**，单独升一个而不升另一个容易处于未支持组合。

因此：**仅解决冲突并合并 PR 67，不值得**；要么整条 ESLint 栈一起升 10，要么保持 9。

---

## 3. ESLint 10 的 Breaking Changes（与本次相关）

| 项 | 影响 |
|----|------|
| **Node 版本** | 需 **^20.19.0 \|\| ^22.13.0 \|\| >=24**。当前 CI 用 Node 20，需确认为 20.19+（一般 `node-version: "20"` 会随镜像更新，通常满足）。 |
| **eslint:recommended 更新** | 新增 3 条规则：`preserve-caught-error`、`no-useless-assignment`、`no-unassigned-vars`。升级后可能多出一批 lint 报错，需修或关规则。 |
| **eslint-env 注释** | 不再支持，会报错。当前仓库 **未发现** `eslint-env` 注释，无影响。 |
| **配置格式** | 已弃用 eslintrc，仅支持 flat config。当前已是 `eslint.config.js` flat config，无影响。 |
| **no-shadow-restricted-names** | 默认会报 `globalThis`。若用到该规则，可能需调配置。 |
| **其他** | 如 rule-tester、SourceCode API、chalk→styleText 等，主要影响插件/自定义规则开发，对仅“用 ESLint 跑 lint”的本仓库影响小。 |

---

## 4. 值得升级吗？

- **安全**：10.0.1 修了 minimatch 相关安全问题（#20519），从安全角度升级有收益。
- **成本**：
  - 必须 **eslint 与 @eslint/js 一起升到 10**，并跑一遍 `npm run lint`，处理新规则产生的报错（或按需关闭/放宽规则）。
  - 确认 CI 与本地 Node 满足 20.19+。
- **建议**：
  - **短期**：对 PR 67 使用 **“Dependabot ignore this major version”** 关闭，避免只升 @eslint/js 导致版本错配；继续使用 eslint 9 + @eslint/js 9。
  - **计划内升级**：若你打算做一次“ESLint 栈 10”升级，再开一个**独立 PR**：同时把 `eslint` 和 `@eslint/js` 升到 10，解决冲突、修新规则、确认 CI，然后合并。不必在 PR 67 上只解冲突就合。

---

## 5. 若你决定做完整升级（ESLint 10）

1. 在 **同一 PR** 中升级：`eslint` 与 `@eslint/js` 均改为 `^10.0.0`（或 10.0.1）。
2. `npm install` 后执行 `npm run lint`，根据报错：
   - 修代码，或
   - 在 `eslint.config.js` 中关闭/放宽新增的 recommended 规则（如 `no-useless-assignment`、`no-unassigned-vars` 等）。
3. 确认 CI 使用 Node 20.19+（若未指定小版本，可显式设为 `"20.19"` 或 `"22"` 更稳妥）。
4. 再跑 `npm run build` 与现有 CI，确保无回归。

---

## 6. 「Breaking change」是谁触发了 PR？Repo 里为什么会多出这个 PR？

- **谁开的 PR**：**Dependabot**（GitHub 自带的依赖更新机器人）。仓库里若启用了 Dependabot（通常有 `.github/dependabot.yml` 或 GitHub 仓库 Settings → Security → Dependabot），它会按配置的周期扫描 `package.json`（及 lockfile），发现 npm 上有**新版本**就自动提一个 PR，把依赖改到新版本。
- **和「breaking change」的关系**：这里说的「breaking change」**不是**某条「规则」或「开关」触发了 PR，而是 **semver 主版本号**的含义：`@eslint/js` 从 9.x 升到 10.x 是 **major 升级**，按 [semver](https://semver.org/) 约定表示「可能包含不兼容的 API/行为变更」。Dependabot 只是「发现 10.0.1 比当前 9.x 新 → 开个 PR 建议你升级」，它不会单独因为「这是 breaking change」才开 PR；**任何**依赖有新版本（包括 minor/patch）都可能收到 Dependabot 的 PR，只是 major 升级的 PR 需要你额外评估兼容性。
- **小结**：Repo 里多出来的 PR 是 **Dependabot 检测到 @eslint/js 有新版本 10.0.1 后自动提的**；「breaking change」指的是这次升级本身是 **主版本升级**，可能带来不兼容变更，需要你决定是否接、以及是否顺带升 Node / eslint 整栈。

---

## 7. 总结表

| 问题 | 答案 |
|------|------|
| PR 67 有 conflict，值不值得只解冲突并合并？ | **不值得**。只升 @eslint/js 会导致与 eslint 9 的 peer 不匹配。 |
| 是否有 breaking change？ | **有**。ESLint 10 有 Node、recommended、config、规则行为等多处 breaking changes。 |
| 推荐操作 | 关闭 PR 67 的 major 升级，保持 9；若要做 10 升级，单独开 PR 做 **eslint + @eslint/js 整栈 10** 并处理新规则与 CI。 |
| 谁触发了这个 PR？ | **Dependabot** 发现 @eslint/js 有新版本 10.0.1 后自动提的；「breaking change」= 主版本号升级（9→10），需人工评估是否升级。 |
