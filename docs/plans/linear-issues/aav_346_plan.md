# 开发方案 - AAV-346 🚨 staging smoke test failed — deployment rolled back

## 1. Issue 概述
staging 环境部署后自动触发的 smoke test 失败，导致部署回滚未自动完成（因缺少预览分支或 token），需要排查失败根因，修复问题，确保后续部署稳定通过 smoke test，并完善自动回滚及告警处理流程。

## 2. 当前状态
- 状态：Backlog，未开始
- 目前仅有 GitHub Actions workflow 失败日志，未定位具体失败原因
- 自动回滚被跳过，需人工干预恢复环境

## 3. 影响范围
- 前端仓库：aaveapy（lovable 分支）
- CI/CD 配置：.github/workflows/deployment-smoke-test.yml
- 可能涉及后端接口稳定性或前端构建、测试流程

## 4. 实现方案

### 4.1 根因排查
- 查看失败的 workflow run 日志（链接：https://github.com/0xPabloLI/aaveapy/actions/runs/25904070523）
- 重点关注：
  - 哪个具体测试或检查步骤失败（如接口返回异常、构建失败、集成测试失败等）
  - 失败时使用的 commit `4dac8bc` 代码变更内容，定位相关改动
- 本地复现失败场景：
  - 拉取 `4dac8bc` commit，执行本地构建和测试
  - 调用后端接口确认是否正常响应
- 检查是否为环境配置、依赖版本、API 变更等导致

### 4.2 修复方案设计
- 针对定位到的具体问题，修改代码或配置：
  - 若是前端构建或测试失败，修复代码错误或测试用例
  - 若是后端接口异常，协调后端修复或调整前端调用
  - 若是环境变量或权限问题，完善 CI 环境配置
- 增加 smoke test 的健壮性和覆盖面，确保关键功能被验证

### 4.3 自动回滚和恢复流程优化
- 检查 `.github/workflows/deployment-smoke-test.yml` 中自动回滚逻辑
- 解决因“preview branch or token missing”导致跳过自动回滚的问题：
  - 确认 CI 配置中是否缺少必要的 secrets 或权限
  - 补充缺失的 token 或调整分支策略，保证自动回滚能正常触发
- 在 Vercel 项目设置中确认自动分配生产域名功能是否开启，避免手动干预

### 4.4 告警和 SOP 制定
- 优化 GitHub Actions 失败时的通知方式（邮件、Slack 等）
- 制定详细的失败排查和恢复 SOP，包括：
  - 如何快速定位失败步骤
  - 如何手动回滚或恢复环境
  - 如何通知相关负责人
- 在 README 或团队文档中补充该 SOP

## 5. 依赖关系
- 无直接依赖其他未完成的 Issue，但需与后端接口稳定性相关修复同步
- 需确保 CI/CD secrets 和权限配置完整

## 6. 验收标准
- 在 staging 环境成功部署后，smoke test 能全部通过，无失败
- 自动回滚功能正常触发，能自动恢复异常部署
- Vercel 自动分配生产域名功能正常，无需手动干预
- CI 失败时相关人员能及时收到告警通知
- 团队成员熟悉并能执行制定的告警处理 SOP

## 7. 复杂度评估
- Medium  
  理由：需要排查具体失败原因，可能涉及前后端代码和 CI/CD 配置多方面调整，同时需完善自动回滚和告警机制，涉及跨系统协作和权限配置。