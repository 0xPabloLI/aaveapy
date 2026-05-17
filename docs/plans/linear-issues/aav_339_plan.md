# 开发方案：AAV-339 - 🚨 staging smoke test failed — deployment rolled back

## 1. Issue 概述
staging 环境的自动 smoke test 失败，导致部署回滚。需要排查失败根因，修复问题，确保后续部署稳定通过 smoke test，避免自动回滚或手动干预。

## 2. 当前状态
- 状态：Backlog（未开始）
- 失败的具体检查项需从 GitHub Actions workflow 日志中确认
- 自动回滚被跳过（preview branch 或 token 缺失），需手动恢复

## 3. 影响范围
- 主要涉及前端仓库 aaveapy（lovable 分支）部署流程
- 关联 GitHub Actions CI/CD 工作流 `.github/workflows/deployment-smoke-test.yml`
- 可能涉及后端接口稳定性（若 smoke test 涉及后端 API）

## 4. 实现方案

### 4.1 根因排查步骤
- 访问失败的 workflow 运行日志链接，定位具体失败的测试或检查步骤
- 重点检查：
  - API 响应是否正常（/api/markets、/api/meta/side-data、/health）
  - 前端页面渲染是否异常
  - 网络请求超时或错误
  - 依赖服务是否可用（后端服务是否正常）
- 对比本次失败 commit `91a45ed` 与上一次成功 commit 的差异，定位代码变更点
- 检查是否有环境变量、token 配置缺失或错误导致自动回滚跳过

### 4.2 修复方案
- 根据排查结果修复代码或配置问题
- 若是接口异常，排查后端服务状态及代码
- 若是前端构建或渲染问题，修复对应组件或依赖
- 补充或修正 GitHub Actions workflow 中的环境变量配置，确保自动回滚功能正常
- 本地及 CI 环境复现 smoke test，确保问题解决

### 4.3 防止复发措施
- 优化 smoke test 脚本，增加失败时的详细日志输出
- 增加关键接口的健康检查和超时重试机制
- 在 CI 配置中确保自动回滚条件和触发机制准确无误
- 定期审查和更新依赖，避免环境不一致导致失败
- 编写 SOP 文档，明确部署失败后的快速响应流程

### 4.4 告警处理 SOP
- 发现 smoke test 失败时，自动创建 GitHub Issue（已存在）
- 指定负责人及时跟进，优先排查日志和代码变更
- 手动恢复部署（vercel promote）并通知相关团队
- 失败原因确认后，推送修复并重新触发部署
- 记录故障原因和处理过程，完善知识库

## 5. 依赖关系
- 无直接依赖其他 Issue，但需配合后端服务稳定性保证
- 需关注 AAV-320、AAV-330~AAV-348 系列 smoke test 相关问题的整体改进

## 6. 验收标准
- 在 staging 环境成功触发并通过 smoke test，部署不回滚
- GitHub Actions workflow 无错误，日志中无异常
- 自动回滚功能正常触发（可通过模拟失败测试验证）
- 相关团队确认部署流程稳定，故障响应流程完善

## 7. 复杂度评估
- 复杂度：Medium
- 理由：需要综合分析 CI/CD 流程、前后端代码和环境配置，涉及多系统联动，排查和修复需一定时间和调试，但无底层架构改动

---

此方案旨在快速定位并修复 staging smoke test 失败问题，确保后续部署流程稳定可靠，提升自动化运维效率。