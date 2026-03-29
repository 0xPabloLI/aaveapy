# Dependabot 行为说明

**当前策略**：**npm** 的 routine version PR 已关（`open-pull-requests-limit: 0`）。**GitHub Actions** 每周检查一次，且 `open-pull-requests-limit: 5`，用于在 workflow 里把第三方 action 钉到 **commit SHA** 后仍能通过 Dependabot 收到 SHA/版本 bump PR。**Security updates** 在 Repo → Settings → Code security and analysis → Dependabot security updates 中单独启用。

---

## 1. 只要有新版本就会提 PR 吗？还是只有漏洞才提？

**两种都会提，来源不同：**

| 类型 | 谁提的 | 触发条件 |
|------|--------|----------|
| **Version updates（版本更新）** | 你在 `.github/dependabot.yml` 里配置的「按周期检查」 | 本仓库：**npm** 为 `open-pull-requests-limit: 0`，**不会**开 routine 版本 PR；**github-actions** 在 schedule 跑到时仍可为钉 SHA 的 action 开 bump PR（最多 5 个并发）。不要求有 CVE。 |
| **Security updates（安全更新）** | GitHub 的 Dependabot 安全功能（Repo → Settings → Security → Dependabot） | 当某依赖被检出**有已知漏洞**时，会**额外**提一个专门修漏洞的 PR（可能比每周更早、更频繁）。 |

所以：**不是**「只有漏洞才提」；**有漏洞会提**。**npm** 的「有更新就提」已关掉；**Actions** 仍可按周收到版本/SHA 更新 PR（在 limit 内）。

---

## 2. 现在的 PR 会合并在一起提吗？

看你当前配置：

- **npm**：`open-pull-requests-limit: 0`，**不会**按周开 routine 版本 PR（与安全更新无关）。
- **github-actions**：未配置 `groups`，通常 **每个 action 仓库一条 PR**（受 `open-pull-requests-limit: 5` 限制同时 open 数量）。

---

## 3. 它会不会「只检测到有 Vulnerability 才提」？

不会。  
- **Version updates**：只看「有没有新版本」，**不**看是否有 CVE；有新版本就按 schedule 提。  
- **Security updates**：才是「检测到漏洞才提」；通常会在 Dependency graph 里看到 alert，然后 Dependabot 会开一个修该漏洞的 PR。

所以：**Actions 可有周更 bump PR**；**npm routine 版本 PR 无**；**安全 PR** 仍单独存在（若启用 Security updates）。

---

## 4. 更新那么快，新包有问题怎么办？

可以这样处理：

1. **先不合并**  
   主版本升级的 PR 在你仓库里会被 `dependabot-auto-triage` 打成 `manual-review`（不会 automerge），你可以等几天看社区/issue 再决定。

2. **关掉这个 PR 并忽略该主版本**  
   在 Dependabot 的 PR 里用评论：  
   `@dependabot ignore this major version`  
   这样 Dependabot 就不会再为这个 major 开新 PR，等该包修好再手动升级或取消 ignore。

3. **合并后发现问题**  
   正常流程：再开一个 PR 把该依赖降回旧版本或锁到已知好的版本号，或等上游发 patch 后接新的 Dependabot PR。

4. **想减少「一有更新就提」**  
   - 在 `dependabot.yml` 里把 `open-pull-requests-limit` 调小（例如 3），或  
   - 对某些包用 `ignore` 条件（例如忽略某个 major 或某几个包），这样就不会为它们提 version-update PR。安全更新仍可单独在 Settings → Dependabot 里启用，只接「有漏洞才提」的 PR。

---

## 5. 和你仓库配置的对应关系

- **Schedule**：每周（npm 与 github-actions 在 `dependabot.yml` 中各一条 `schedule: weekly`）。  
- **npm**：`open-pull-requests-limit: 0` → 无 routine 版本 PR。  
- **github-actions**：`open-pull-requests-limit: 5` → 第三方 action（钉 SHA）可收到 bump PR。  
- **自动审批**：`dependabot-auto-triage` 仍按 workflow 逻辑处理 Dependabot PR 标签（见该 workflow）。

总结：**npm 不按周开版本 PR**；**Actions 按周检查并可开最多 5 个相关 PR**；**安全更新**仍可在 Settings 中单独启用。

---

## 6. Peer Dependency 防护（见 `docs/conventions/peer-dependency-guard.md`）

React 生态中 `react` 和 `react-dom` **必须**是同一大版本。Dependabot 可能只升其中一个，导致白屏（编译通过但运行时崩溃）。

### 已落实的防线

| 防线 | 作用 |
|------|------|
| `package.json` 的 `overrides` | 强制所有子依赖使用同一版本的 react/react-dom |
| CI `peer-dep-check` job | 显式检查 react ≡ react-dom 版本 + 扫描所有 peer dep 冲突 |

### 本地诊断

```bash
node -p "require('react/package.json').version"
node -p "require('react-dom/package.json').version"
npm ls react 2>&1 | grep "invalid"
```

### 历史案例：2026-03-16 react@19 + react-dom@18 白屏

Dependabot 只升了 `react` 到 19，`react-dom` 留在 18 → `ReactCurrentDispatcher` undefined → 白屏。详见 `docs/conventions/peer-dependency-guard.md`。
