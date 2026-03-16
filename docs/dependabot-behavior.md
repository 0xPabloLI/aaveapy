# Dependabot 行为说明

**当前策略**：已关闭 **Version updates**（不再按周提「有新版本」的 PR），仅保留 **Security updates**（有漏洞时提 PR）。Version updates 由 `.github/dependabot.yml` 的 `updates` 控制（现为空）；Security updates 在 Repo → Settings → Code security and analysis → Dependabot security updates 中单独启用。

---

## 1. 只要有新版本就会提 PR 吗？还是只有漏洞才提？

**两种都会提，来源不同：**

| 类型 | 谁提的 | 触发条件 |
|------|--------|----------|
| **Version updates（版本更新）** | 你在 `.github/dependabot.yml` 里配置的「按周期检查」 | **只要有新版本**就会在 schedule 跑到时提 PR（每周一 03:00 UTC 查 npm，03:15 查 GitHub Actions）。不要求有 CVE。 |
| **Security updates（安全更新）** | GitHub 的 Dependabot 安全功能（Repo → Settings → Security → Dependabot） | 当某依赖被检出**有已知漏洞**时，会**额外**提一个专门修漏洞的 PR（可能比每周更早、更频繁）。 |

所以：**不是**「只有漏洞才提」；**有漏洞会提**，**没有漏洞但版本更新了也会提**（按你配置的每周一次）。

---

## 2. 现在的 PR 会合并在一起提吗？

看你当前配置：

- **会合并成一批的**：只有 **minor** 和 **patch**。  
  `dependabot.yml` 里写了 `groups: npm-minor-patch`，且 `update-types: ["minor", "patch"]`，所以同一周期内多个「小版本/补丁」更新会被 **合并成一个或少数几个 PR**（受 `open-pull-requests-limit: 5` 限制）。
- **不会合并、一个依赖一个 PR 的**：**Major 主版本升级**。  
  配置里没有把 `major` 放进任何 group，所以每个 major（例如 @eslint/js 9→10、react-resizable-panels 2→4）都会**单独一个 PR**。  
  因此你会看到 PR 67、66、69、68 等**各自一个**，不会和 minor/patch 混在一起。

---

## 3. 它会不会「只检测到有 Vulnerability 才提」？

不会。  
- **Version updates**：只看「有没有新版本」，**不**看是否有 CVE；有新版本就按 schedule 提。  
- **Security updates**：才是「检测到漏洞才提」；通常会在 Dependency graph 里看到 alert，然后 Dependabot 会开一个修该漏洞的 PR。

所以：**既有「有更新就提」的周更 PR，也有「有漏洞才提」的安全 PR**。

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

- **Schedule**：每周一 03:00 UTC（npm）、03:15（github-actions）。  
- **合并策略**：仅 **minor + patch** 分组；**major 不分组**，一个依赖一个 PR。  
- **上限**：npm 最多同时 5 个 open PR（`open-pull-requests-limit: 5`）。  
- **自动审批**：`dependabot-auto-triage` 只对「patch/minor + 开发依赖」打 `automerge` / 自动 approve；**major 和生产依赖**会打 `manual-review`，需要你人工看。

总结：**有更新就提（按周） + 有漏洞也会提（安全更新）**；**只有 minor/patch 会合并成批，major 不会**；新包有问题就先用 ignore 或先不合并，等稳定再升。
