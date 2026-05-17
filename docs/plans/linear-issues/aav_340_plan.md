# 开发方案 — AAV-340 🚨 staging smoke test failed — deployment rolled back

## 1. Issue 概述
staging 环境的自动 Smoke Test 失败，导致本次部署回滚。需要排查失败根因，修复问题，确保后续部署通过 Smoke Test 并恢复自动分配生产域名功能。

## 2. 当前状态
- 状态：Backlog（未开始）
- 代码分析：尚未排查具体失败原因，需查看 CI/CD workflow 日志定位

## 3. 影响范围
- 仓库：aaveapy（前端部署在 Vercel）
- 可能涉及：前端代码、CI/CD 配置、Vercel 项目设置

## 4. 实现方案

### Step 1 - 根因排查
- 访问 GitHub Actions 失败日志链接，详细查看 `deployment-smoke-test.yml` 运行日志，定位具体失败的测试用例或步骤。
- 重点检查：
  - API 请求是否成功（/api/markets、/api/meta/side-data、/health）
  - 页面渲染是否正常（首页、关键页面）
  - 依赖服务是否可用（后端服务是否响应）
  - 版本兼容或环境变量是否正确
- 检查对应提交 `95aa35b` 的代码变更，确认是否引入了破坏性改动。

### Step 2 - 本地复现与修复
- 在本地或开发环境复现 Smoke Test 失败场景，调试定位问题。
- 根据失败原因修复代码或配置问题：
  - 修复前端接口调用错误、组件渲染异常
  - 修正 CI/CD 配置或环境变量
  - 修复依赖服务接口变更或连接问题
- 编写或完善 Smoke Test 脚本，保证覆盖关键路径。

### Step 3 - 测试验证
- 在本地及 staging 环境重新运行 Smoke Test，确保所有检查通过。
- 通过 GitHub Actions 触发新的部署，验证自动 Smoke Test 成功。

### Step 4 - 恢复自动部署设置
- 由于回滚导致 Vercel 禁用自动生产域名分配，需手动执行：
  - 运行 `vercel promote` 命令将 staging 部署提升为生产
  - 或在 Vercel 项目设置中重新启用自动分配生产域名功能
- 确认生产环境访问正常。

### Step 5 - 防止复发
- 优化 Smoke Test 脚本，增加失败时的详细日志输出。
- 在 CI/CD 流程中增加失败告警，确保相关人员及时响应。
- 编写部署 SOP，包含回滚处理和自动恢复步骤。
- 定期复盘 Smoke Test 失败案例，持续改进。

## 5. 依赖关系
- 无直接依赖其他 Issue，但建议结合 AAV-320 等其他 Smoke Test 失败问题统一排查。

## 6. 验收标准
- 新提交代码在 staging 环境部署后，Smoke Test 全部通过。
- GitHub Actions workflow 无失败，且不再自动回滚。
- Vercel 生产域名自动分配功能正常。
- Smoke Test 脚本覆盖关键接口和页面，且日志充分。
- 部署失败时有明确告警和处理流程。

## 7. 复杂度评估
- Medium  
  需要定位具体失败原因，可能涉及前端代码、后端接口或 CI/CD 配置，需跨团队协作排查和修复。恢复自动部署设置操作简单，但确保稳定性需一定测试验证。