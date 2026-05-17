# 开发方案 - AAV-335 🚨 staging smoke test failed — deployment rolled back

## 1. Issue 概述
本 Issue 反映了在 staging 环境部署时，自动化 Smoke Test 失败导致部署回滚未成功，需排查失败原因，修复问题，确保后续部署稳定通过 Smoke Test，并完善自动回滚和告警机制。

## 2. 当前状态
- 状态：Backlog，未开始
- 已知信息：本次失败发生在 commit `103ee21`，自动回滚被跳过（preview branch 或 token 缺失），需人工干预恢复。

## 3. 影响范围
- 主要涉及仓库：`aaveapy`（前端，lovable 分支）
- 关联 GitHub Actions 工作流：`.github/workflows/deployment-smoke-test.yml`
- 可能涉及后端接口稳定性（`aave-protocol-analysis`）间接影响 Smoke Test 结果

## 4. 实现方案

### 4.1 根因排查
- **步骤1**：查看失败的 GitHub Actions 日志（[链接](https://github.com/0xPabloLI/aaveapy/actions/runs/25859119686)），定位具体失败检查点（如接口响应、页面渲染、API 返回数据等）
- **步骤2**：确认本次提交 `103ee21` 的代码变更内容，排查是否引入了破坏性改动或依赖变更
- **步骤3**：检查 `deployment-smoke-test.yml` 配置，确认自动回滚触发条件及权限（token）是否正确配置
- **步骤4**：确认 Vercel 项目设置中自动分配生产域名的状态，是否因回滚失败导致自动分配被禁用

### 4.2 修复方案
- **修复失败原因**：根据日志定位的具体失败点，修复代码或配置问题，确保 Smoke Test 能通过
- **完善自动回滚机制**：
  - 确认 workflow 中自动回滚步骤的 token 权限和环境变量配置完整
  - 增加失败时自动回滚的重试逻辑，避免因 token 缺失或网络异常导致跳过回滚
- **恢复自动分配生产域名**：
  - 在 Vercel 项目设置中重新启用自动分配生产域名功能
  - 或者在修复后执行 `vercel promote` 命令手动恢复生产环境部署
- **增加告警和监控**：
  - 在 GitHub Actions workflow 中增加失败告警（Slack/Email）
  - 编写 SOP 文档，明确 Smoke Test 失败后的快速响应流程

### 4.3 具体文件修改
- `.github/workflows/deployment-smoke-test.yml`
  - 增加失败回滚重试逻辑
  - 增加告警步骤
- `docs/operations/smoke-test-sop.md`（新建）
  - 编写 Smoke Test 失败处理流程文档
- 代码仓库中相关导致失败的代码文件（根据日志定位）

### 4.4 数据流变更
- 无数据库或接口数据结构变更，主要为 CI/CD 流程和部署配置调整

## 5. 依赖关系
- 无直接依赖其他 Issue，但需关注相关 Smoke Test 失败的其他 Issue（如 AAV-320, AAV-330-348）
- 需确保后端 API 稳定，可能需配合后端团队确认接口健康

## 6. 验收标准
- 在 staging 环境成功部署后，Smoke Test 全部通过，无失败
- 自动回滚机制在模拟失败时能正常触发并回滚
- 自动分配生产域名功能恢复正常
- 告警机制能在 Smoke Test 失败时及时通知相关人员
- SOP 文档完成并通过团队评审

## 7. 复杂度评估
- **复杂度**：Medium
- **理由**：涉及 CI/CD 流程调试、权限配置、自动化脚本编写及运维流程制定，需跨团队协作，但代码改动量较小，主要为流程和配置优化。

---

以上为 AAV-335 Issue 的详细开发方案，建议优先排查失败日志，快速定位问题根因，保证后续部署稳定。