# PR #67 评估：@eslint/js 9 → 10 升级

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

## 6. 总结表

| 问题 | 答案 |
|------|------|
| PR 67 有 conflict，值不值得只解冲突并合并？ | **不值得**。只升 @eslint/js 会导致与 eslint 9 的 peer 不匹配。 |
| 是否有 breaking change？ | **有**。ESLint 10 有 Node、recommended、config、规则行为等多处 breaking changes。 |
| 推荐操作 | 关闭 PR 67 的 major 升级，保持 9；若要做 10 升级，单独开 PR 做 **eslint + @eslint/js 整栈 10** 并处理新规则与 CI。 |
