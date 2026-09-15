# Spec: dev CI 修复 — @eslint/js 与 eslint 主版本对齐

## Problem Statement

dev 分支 CI 自 2026-08-24 起持续失败（lint + peer-dep-check 两个 job），阻塞 Production PR #607（dev → main）的合并，进而阻塞 main 上积压的 3 个 open PR 的发布链路。根因：`@eslint/js` 被升到 `^10.0.1` 而 `eslint` 仍为 `^9.39.4`——两者 peer 要求不兼容（@eslint/js v10 要求 eslint@^10），且 @eslint/js v10 的 recommended 规则集新增 `no-useless-assignment`，在现有测试代码上直接报 error。

## Solution

将 `@eslint/js` 回退到 `^9.39.4`（与 `eslint` ^9 主版本对齐），同步 `package-lock.json`。lint error 由规则集回退自动消除，测试源码不动。通过 fix 分支 → PR → auto-merge 进 dev，使 #607 重跑变绿。

## User Stories

1. As a maintainer, I want dev CI 全绿, so that dev → main 的 Production PR 可以推进合并。
2. As a maintainer, I want package.json 中 eslint 相关依赖主版本一致, so that `npm ls` 无 invalid peer、npm ci 严格安装成功。
3. As a maintainer, I want CI 的 peer-dep-check job 通过, so that 依赖树回归被持续监控。
4. As a maintainer, I want lint job 通过, so that ESLint 规则集与安装的 ESLint 主版本匹配。
5. As a maintainer, I want lockfile 不再被 `--legacy-peer-deps` 强行改写后直接合入, so that CI 与 Vercel preview 的严格安装路径可靠。
6. As a maintainer, I want 修复过程可追溯（spec + PR）, so that 后续排查 CI 历史时有据可查。

## Implementation Decisions

- **方案选择**：回退 `@eslint/js` 到 `^9.39.4` 而非升级 `eslint` 到 ^10。理由：eslint 10 为大版本升级，recommended 规则集变化不可控，超出本次 scoped 修复；回退恢复到 8/24 之前已验证绿色状态。
- **变更面**：仅 `package.json`（`@eslint/js` 一行）+ `package-lock.json`（npm install 重新解析）。不改任何源码、配置或 workflow。
- **测试源码不修**：`no-useless-assignment` error 来自 v10 recommended 规则集；回退后该规则不再启用，现有代码合法（lovable 分支同样代码 lint 绿）。
- **unused eslint-disable warnings 不处理**：`ReservesTable.tsx` / `useOnchainHealthFactor.ts` 的 2 个 warning 不阻塞 CI（warning 非 error），保持 scoped。
- **合并路径**：fix 分支 → PR → merge commit → auto-merge 进 dev（遵守 dev 分支保护，不直推）。
- **后续防复发（out of scope，另行处理）**：`dependabot-resolve-peer-conflicts` workflow 用 `--legacy-peer-deps` 强推 lockfile 是本次根因的进入通道，未来 dependabot major bump 仍可能复发。

## Testing Decisions

- 本任务为依赖版本修复，无可新增的业务单测；以**现有 seam 的验证命令**作为验收：
  - `npm ls --all` 全量 peer 校验（等价 CI peer-dep-check，排除 wagmi@3 已知豁免）；
  - `npm run lint`（等价 CI lint job）；
  - `npm test` / `npm run build` / `npx tsc --noEmit`（devDependency 变更不影响运行时，作回归防线）。
- 优良测试标准：外部可观测行为（命令退出码、CI job 结论），不测 lockfile 内部结构。
- Prior art：repo 的 Validation Gate 四连（lint → test → build → tsc）。

## Scenario & Risk Verification Matrix

| 场景 | 状态 | 期望 |
|------|------|------|
| 依赖树 peer 一致性 | `@eslint/js@9` + `eslint@^9` | `npm ls --all` 无 invalid（wagmi@3 已知豁免除外） |
| 严格安装 | 同步后的 lockfile | `npm ci` 成功（CI peer-dep-check 前置 + Vercel preview 路径） |
| lint 规则集回退 | @eslint/js v9 recommended | `npm run lint` 0 error（`no-useless-assignment` 不再启用） |
| 测试套件回归 | devDependency 变更 | `npm test` 全绿（运行时不受影响） |
| 类型与构建 | 同上 | `npm run build` + `npx tsc --noEmit` 成功 |
| PR head CI | fix 分支 PR | lint / peer-dep-check / build / test 全绿 → auto-merge 进 dev |
| Production PR 重跑 | dev head 更新后 | #607 的 lint + peer-dep-check job 变绿 |
| 复发风险 | 未来 dependabot major bump | 不在本 PR 处理；已识别进入通道并在汇报中标注 |

## Out of Scope

- `dependabot-resolve-peer-conflicts.yml` 的 `--legacy-peer-deps` 行为整改（根因通道，另行 ticket）。
- 2 个 unused eslint-disable warnings 清理。
- dependabot major bump 的 ignore 策略配置。
- PR #600 branch-flow-guard 豁免 / PR #605 的 e2e live 数据依赖问题。

## Further Notes

- dev CI 自 8/24 最后一次 success 后全红；8/24 之后的 dev commits 均为 dependabot bumps / hardcode sync / merge，代码面无新增 lint 面。
- @eslint/js v10 进入 dev 的通道：dependabot PR 的 peer conflict 被 `dependabot-resolve-peer-conflicts` workflow 以 legacy-peer-deps 强推 lockfile 后合入。
