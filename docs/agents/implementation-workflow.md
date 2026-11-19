# Implementation Workflow（分级层）

> 底本 `~/Documents/code/agent-harness/core/implementation-workflow.md`。本 repo 的 8 步清单在 `AGENTS.md`「Mandatory Implementation Workflow」；本文件只补**分级**：Planning Scale 决定是否创建 Spec/Tickets，Risk 决定验证强度。

## 1. 授权与自动推进

用户明确要求实施后才改文件；授权后自动推进，不逐条请示。仅在：关键产品决策有多个合理答案、需要选 prototype、不可逆操作或 consequential external action（部署、远端 tracker 写入、发布）、环境/凭据缺失时暂停。

## 2. Skill 调用契约

- **Model-invoked**（`grilling`、`domain-modeling`、`research`、`tdd`、`code-review`、`diagnosing-bugs`）可直接调用。
- **User-invoked**（`grill-with-docs`、`to-spec`、`to-tickets`、`implement`）：execute-by-reference——读 `.agents/skills/<name>/SKILL.md` 作为方法来源，叠加本文件覆写，如实描述为「按 `<name>` 执行」。
- **降级**：skill/子 agent 不可用或缺必需工具时，主 agent 自己执行，完成标准不变，汇报里标注「阶段 N 降级 + 原因」。

## 3. Planning Scale

| 等级 | 判定 | 路线 | 本 repo 落点 |
| --- | --- | --- | --- |
| **S0** | 未授权改动，或只解释/调查/review | 检查并汇报 | 无 |
| **S1** | 决策与实施能在一个 context 完成 | 按需 Grill → 直接 Implement | 8 步中可跳过独立 Spec/Tickets；实现 + 测试 + 本地验证 + commit |
| **S2** | 路线清楚但实施跨多个 context | Grill → Spec → Tickets → 逐 ticket | 完整 8 步 + `docs/specs/` 落档 |
| **S3** | 目的地可命名但规划本身跨 session | Wayfinder → 转 S2 | 先解决策票 |

判定示例：改一个组件样式或文案 → S1；改 portfolio 数据流 + 新增派生字段 + E2E → S2；「重做持仓页信息架构」→ S3。

## 4. Risk

| 等级 | 判定 | 验证强度 |
| --- | --- | --- |
| **R0** | 无文件修改 | 无 |
| **R1** | 不改运行时行为、契约、发布路径（纯文档/注释/样式 token 不变） | 定向检查 + diff 自审 |
| **R2** | 有界的行为变化 | 场景矩阵 + 测试 + 受影响 E2E + review |
| **R3** | 命中下列触发 | 场景穷举 + 真实失败基线 + 全量相关验证 + 浏览器/真实数据证据 |

**R3 触发（本 repo）**：后端契约消费（`src/shared/market-contract/schemas.ts`、`src/types/aave.ts`、`schema-fingerprint`）；钱包/签名/授权链路；资金相关展示与计算（APY、LTV、清算阈值、借贷模拟）；部署与发布路径（`.github/workflows/*`、husky、vercel 配置）；跨多页共享的全局 store 或路由结构。

R3 实现前必须留下真实失败基线（失败测试、可复现的浏览器现象、对旧状态 fail 的静态门），仅声明「可以变红」不算证据。

## 5. 决策与实施

- **Grill**：需求/边界/seam 未决定时执行；R2/R3 按 `docs/conventions/scenario-enumeration-checklist.md` 穷举场景。
- **Spec**（S2/S3）：落 `docs/specs/`，含 Scenario & Risk Verification 矩阵；吸收已决定内容，不重开访谈。
- **Tickets**（S2/S3）：tracer-bullet 垂直切片，每片可独立验证。
- **实施**：R2/R3 先写失败测试再实现；改完跑 `npx --no-install vitest run <path>` → 相关 E2E → `npm run lint` / typecheck。
- **Runtime Verify**：前端 `npm run dev:staging` + 浏览器核心交互，截图/DOM 证据留档；不可跳过。
- **Review**：先 commit（只 commit 不 push）→ 记 `taskHead` → 审 `baseline...taskHead` → accepted finding 追加 commit。

## 6. 收尾汇报

先给产品视角结论（issue 原本要什么 / 用户现在看到什么），再列各步完成情况与证据，跳过的步骤显式标注原因。
