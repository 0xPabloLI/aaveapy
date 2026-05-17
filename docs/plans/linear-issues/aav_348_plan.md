# 开发方案 - AAV-348 🚨 staging smoke test failed — deployment rolled back

## 1. Issue 概述
staging 环境部署后自动触发的 smoke test 失败，导致部署回滚未自动执行（因预览分支或 token 缺失），需要排查失败原因，修复问题，确保后续部署顺利通过 smoke test 并自动发布。

## 2. 当前状态
- 状态：Backlog，尚未开始
- 部署触发的 GitHub Actions workflow 运行失败，具体失败点需查看日志确认

## 3. 影响范围
- 主要涉及前端仓库：`aaveapy`（lovable 分支）
- 关联 CI/CD 配置：`.github/workflows/deployment-smoke-test.yml`
- 可能涉及 Vercel 项目设置（自动分配域名）

## 4. 实现方案

### 4.1 根因排查步骤
- 查看失败的 workflow 运行日志（[View logs](https://github.com/0xPabloLI/aaveapy/actions/runs/25967072690)）
- 确认具体失败的测试用例或检查点（如接口请求失败、页面渲染异常、环境变量缺失等）
- 检查对应 commit `61fdaaf` 的代码变更，定位可能引入问题的改动
- 检查 CI 配置文件 `.github/workflows/deployment-smoke-test.yml` 是否有配置错误或依赖的环境变量缺失
- 确认 Vercel 项目设置中是否启用了自动分配域名，是否有权限或 token 配置问题导致自动回滚失败

### 4.2 修复方案
- 针对日志中发现的具体错误，修复代码或配置问题
- 如为测试脚本问题，更新测试用例或修复测试环境依赖
- 确保所有必需的环境变量和 secrets 在 GitHub Actions 和 Vercel 项目中正确配置
- 如自动回滚因权限或 token 缺失，补充或更新相关凭证，确保自动回滚功能正常
- 优化 CI 脚本，增加失败时的详细日志输出，便于后续排查

### 4.3 防止复发措施
- 在 CI 流程中增加对关键环境变量和凭证的预检查步骤
- 增加 smoke test 的覆盖面，确保关键功能和接口均被检测
- 配置 GitHub Actions 的告警和自动 issue 创建（已存在，确认正常工作）
- 在 Vercel 项目设置中开启自动分配域名和自动回滚功能，并定期验证

### 4.4 告警处理 SOP
- 发现 smoke test 失败后，第一时间查看 GitHub Actions 失败日志
- 根据日志定位问题，快速修复并提交代码触发新部署
- 若自动回滚失败，手动执行回滚或使用 `vercel promote` 恢复稳定版本
- 记录问题原因和处理过程，更新团队文档和知识库

## 5. 依赖关系
- 无直接功能依赖，但需保证 CI/CD 配置和 Vercel 项目权限配置正确
- 依赖 GitHub Actions 现有的 smoke test 脚本和告警机制

## 6. 验收标准
- 修复后，staging 分支部署触发的 smoke test 能够全部通过
- 部署失败时，自动回滚功能正常触发，且自动分配域名功能正常
- GitHub Actions workflow 运行日志无错误，且告警机制正常工作
- 团队文档中更新了故障排查和处理流程

## 7. 复杂度评估
- Medium  
  理由：需要结合 CI/CD 流程和 Vercel 配置进行排查，涉及多系统联动，修复后需验证自动化流程稳定性。代码改动可能较少，重点在于配置和流程优化。