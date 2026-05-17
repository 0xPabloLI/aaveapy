# 开发方案 - AAV-320 🚨 staging smoke test failed — deployment rolled back

## 1. Issue 概述
本 Issue 反映在 staging 环境部署后，自动 smoke test 失败，导致部署被回滚（rollback）。需要定位失败原因，修复问题，确保后续部署的稳定性和自动化流程正常。

## 2. 当前状态
- 状态：Backlog，尚未开始排查和修复
- 失败发生在 commit `b695f51` 的 staging 部署
- 自动回滚跳过（preview branch 或 token 缺失），需人工干预恢复环境

## 3. 影响范围
- 主要影响前端仓库 `aaveapy`（lovable 分支）部署流程
- 可能涉及 GitHub Actions CI/CD 工作流配置（`.github/workflows/deployment-smoke-test.yml`）
- 可能关联后端接口稳定性（`aave-protocol-analysis`），若 smoke test 依赖后端 API

## 4. 实现方案

### 4.1 根因排查步骤
1. **查看失败日志**
   - 访问 [GitHub Actions 失败日志](https://github.com/0xPabloLI/aaveapy/actions/runs/25724517502)
   - 定位具体失败的测试用例或检查点（如接口响应、页面渲染、API 返回数据格式等）
2. **复现问题**
   - 在本地或临时环境使用相同 commit `b695f51` 代码，运行 smoke test 脚本
   - 确认是否能复现失败，便于调试
3. **分析代码变更**
   - 对比 `b695f51` 与前一个成功 commit 的差异，重点关注：
     - 前端关键组件改动
     - API 请求路径或数据结构变更
     - CI/CD 配置文件变更
4. **检查依赖服务状态**
   - 确认后端 API 是否正常运行，接口是否有变更未同步
   - 检查外部依赖（如第三方 API）是否异常

### 4.2 修复方案
1. **修正代码缺陷**
   - 根据排查结果修复前端或后端代码中的错误
   - 确保接口调用和数据格式与后端保持一致
2. **完善测试用例**
   - 补充或修正 smoke test 脚本，确保覆盖关键功能和边界情况
3. **优化 CI/CD 配置**
   - 确认 `.github/workflows/deployment-smoke-test.yml` 中的环境变量（如 token）配置正确
   - 确保自动回滚和自动分配生产域名功能正常
4. **手动恢复环境**
   - 如果 staging 环境因回滚被禁用自动分配域名，执行 `vercel promote` 恢复
   - 或在 Vercel 项目设置中重新启用自动分配

### 4.3 防止复发措施
- 增加 smoke test 失败的告警通知（Slack/Email）
- 在 PR 合并前增加 smoke test 预检测，阻止不合格代码合入
- 定期审查和更新 smoke test 脚本，保持与代码同步

## 5. 依赖关系
- 无直接依赖其他 Issue，但需确保后端 API 稳定（可能关联 AAV-320 相关后端问题）
- 需配合 DevOps 团队确认 Vercel 项目配置和权限

## 6. 验收标准
- staging 环境部署后，smoke test 全部通过，无失败
- 自动回滚机制正常触发且能正确恢复环境
- 自动分配生产域名功能正常，无需手动干预
- CI/CD 工作流日志无异常，且失败时能及时告警

## 7. 复杂度评估
- Medium
- 理由：需要跨团队协作排查多方因素，涉及前端、后端和 CI/CD 配置，且需保证部署流程的稳定性和自动化水平

---

此方案旨在快速定位并修复 staging smoke test 失败问题，保障后续部署流程顺畅，提升项目交付质量。