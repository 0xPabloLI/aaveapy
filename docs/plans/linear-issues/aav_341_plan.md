# 开发方案 - AAV-341 🚨 staging smoke test failed — deployment rolled back

## 1. Issue 概述
本 Issue 是针对 staging 环境部署后自动触发的 Smoke Test 失败，导致部署被回滚。需要排查失败根因，修复问题，确保后续部署通过 Smoke Test，保障 staging 环境稳定。

## 2. 当前状态
- 状态：Backlog，尚未开始处理
- 已有失败的 GitHub Actions Workflow 运行日志可供排查

## 3. 影响范围
- 主要涉及前端仓库：`aaveapy`（lovable 分支）
- 可能涉及后端仓库：`aave-protocol-analysis`（railway 分支），视具体失败点而定
- CI/CD 配置仓库（.github/workflows/deployment-smoke-test.yml）

## 4. 实现方案

### 4.1 根因排查步骤
- 下载并详细查看失败的 Workflow 运行日志（链接：https://github.com/0xPabloLI/aaveapy/actions/runs/25896995693）
- 确认失败的具体 Smoke Test 用例（如接口请求失败、页面渲染异常、API 返回错误等）
- 对照最新提交 `3c39369` 的代码变更，定位可能引入的问题
- 本地复现失败场景，确认问题是否可复现
- 检查 Vercel 部署日志，确认部署过程是否有异常

### 4.2 修复方案设计
- 针对定位到的具体问题，修改对应代码：
  - 若是前端接口调用失败，检查 API 地址、参数、数据格式
  - 若是后端接口异常，检查后端服务状态、接口实现
  - 若是环境变量或配置问题，修正 CI/CD 配置或 Vercel 环境变量设置
- 本地及开发环境复测，确保问题解决
- 提交修复代码，触发新的 CI/CD 流程验证

### 4.3 防止复发措施
- 增强 Smoke Test 覆盖率，确保关键路径均被检测
- 在 CI/CD 流程中增加失败告警通知（Slack/Email）
- 编写 Smoke Test 失败处理 SOP，明确回滚及恢复流程
- 检查并完善 Vercel 自动分配生产域名设置，避免手动操作遗漏

### 4.4 告警处理 SOP
- 发现 Smoke Test 失败后，第一时间查看日志定位问题
- 若自动回滚未执行，手动回滚至上一个稳定版本
- 通知相关开发人员跟进修复
- 修复完成后，重新部署并确认 Smoke Test 通过
- 记录故障原因及处理过程，更新团队知识库

## 5. 依赖关系
- 无直接依赖其他 Issue，但需关注近期相关代码变更（commit `3c39369`）
- 需配合 DevOps 团队调整 CI/CD 配置及告警机制

## 6. 验收标准
- 新的 staging 部署通过所有 Smoke Test，无失败
- CI/CD 流程中失败告警机制正常工作
- 回滚及恢复流程文档完善且团队知晓
- Vercel 自动分配生产域名功能正常，无需手动干预

## 7. 复杂度评估
- Medium
- 原因：需结合 CI/CD、前后端代码及环境配置排查，涉及多方面协作，但问题定位明确，修复方案较为直接

---

此方案旨在快速定位并修复 Smoke Test 失败，保障 staging 环境稳定，提升自动化部署的可靠性。