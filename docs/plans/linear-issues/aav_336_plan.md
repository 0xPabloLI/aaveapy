# 开发方案 - AAV-336 🚨 staging smoke test failed — deployment rolled back

## 1. Issue 概述
本 Issue 反映在 staging 环境部署后，自动化 smoke test 失败，导致部署被回滚。需要排查失败根因，修复问题，确保后续部署通过 smoke test，避免自动回滚或手动干预。

## 2. 当前状态
- 状态：Backlog，尚未开始处理
- 通过查看 GitHub Actions workflow 日志可定位失败点

## 3. 影响范围
- 前端仓库：aaveapy（lovable 分支）
- 主要涉及 CI/CD 流程及部署自动化

## 4. 实现方案

### 4.1 根因排查
- 访问失败的 workflow 运行日志（链接见 Issue 描述）
- 重点查看 `deployment-smoke-test.yml` 中各步骤的输出，定位具体失败的测试用例或命令
- 检查最近提交（commit `6c63822`）的代码变更，确认是否引入了破坏性改动
- 检查 Vercel 部署日志，确认是否有环境配置、构建或运行时错误
- 如果 smoke test 涉及接口调用，确认后端服务是否正常响应

### 4.2 修复方案制定
- 根据排查结果，修复代码缺陷或配置错误
- 如为测试脚本问题，更新测试用例或修复测试依赖
- 如为环境变量或权限问题，调整 Vercel 项目设置或 GitHub Secrets
- 本地复现 smoke test 流程，确保问题彻底解决

### 4.3 防止复发
- 优化 smoke test 脚本，增加日志输出，便于快速定位问题
- 在合并到 lovable 分支前，增加本地或预提交钩子测试
- 配置 GitHub Actions 失败告警，及时通知相关开发人员
- 审查自动回滚策略，确保回滚后能自动恢复或人工快速介入

### 4.4 告警处理 SOP
- 发现 smoke test 失败后，立即查看 workflow 失败日志
- 评估失败影响，决定是否手动回滚或等待自动回滚
- 通过团队沟通快速定位责任人跟进修复
- 修复后推送新提交，触发新一轮部署和 smoke test
- 部署成功后执行 `vercel promote` 恢复生产域名自动分配（如被禁用）

### 4.5 需要创建/修改的文件
- 可能修改：`/.github/workflows/deployment-smoke-test.yml`（增加日志、调整测试步骤）
- 可能修改：`src/tests/smoke/` 下的 smoke test 脚本（修复或完善测试用例）
- 可能修改：Vercel 项目环境变量配置（非代码，需运维操作）

## 5. 依赖关系
- 无直接依赖其他 Issue，但建议结合 AAV-320、AAV-330~348 等其他 smoke test 相关问题统一排查和改进

## 6. 验收标准
- 在 staging 环境成功部署后，所有 smoke test 步骤通过，无失败
- GitHub Actions workflow 无自动回滚触发
- Vercel 域名自动分配正常，无需手动干预
- 团队收到失败告警时能快速响应并修复

## 7. 复杂度评估
- Medium
- 原因：需要综合分析 CI/CD 流程、测试脚本和部署环境，涉及多方协作和排查，修复后需验证多轮部署流程稳定性

---

此方案旨在快速定位并修复 staging 环境 smoke test 失败问题，保障部署流程稳定，提升自动化运维效率。