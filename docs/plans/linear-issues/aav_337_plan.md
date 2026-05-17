# 开发方案：AAV-337 — 🚨 staging smoke test failed — deployment rolled back

## 1. Issue 概述
本 Issue 反映在 staging 环境的自动 smoke test 失败，导致部署被回滚。需要排查失败根因，修复问题，确保后续部署顺利通过 smoke test，避免自动回滚或手动恢复带来的风险和延迟。

## 2. 当前状态
- 状态：Backlog（未开始）
- 目前仅有 GitHub Actions workflow 失败日志，无具体代码修复
- 自动回滚因缺少 preview branch 或 token 被跳过，需手动干预

## 3. 影响范围
- 主要涉及前端仓库：`aaveapy`（lovable 分支）
- 可能涉及 CI/CD 配置（`.github/workflows/deployment-smoke-test.yml`）
- 可能间接影响后端接口稳定性（`aave-protocol-analysis`），需根据失败日志确认

## 4. 实现方案

### 4.1 根因排查
- **步骤1**：访问失败的 workflow 运行日志（[链接](https://github.com/0xPabloLI/aaveapy/actions/runs/25862115335)）
- **步骤2**：定位具体失败的测试或检查点（如接口请求失败、页面渲染异常、超时等）
- **步骤3**：结合对应 commit `876cb0f` 的代码变更，分析是否引入了破坏性改动
- **步骤4**：本地复现失败场景，确认问题范围（前端构建、API 请求、环境变量等）
- **步骤5**：检查 Vercel 项目设置，确认 auto-assign production domain 是否被禁用

### 4.2 修复问题
- **步骤1**：针对失败点进行代码修复（如接口兼容性、环境变量配置、依赖版本等）
- **步骤2**：本地及 CI 环境中反复运行 smoke test 脚本，确保通过
- **步骤3**：更新 `.github/workflows/deployment-smoke-test.yml`，增加失败时的日志输出和告警信息，方便后续排查
- **步骤4**：确认 Vercel 项目设置中自动分配生产域名功能开启，避免手动 promote 造成延迟

### 4.3 防止复发
- **步骤1**：完善 smoke test 覆盖面，增加关键接口和页面的健康检查
- **步骤2**：在 PR 流程中增加 smoke test 预检，阻止明显失败的代码合并到 staging
- **步骤3**：编写 SOP 文档，明确部署失败时的快速排查和恢复流程

## 5. 依赖关系
- 无直接依赖其他 Issue，但需关注相关后端接口稳定性（如有接口变更需同步）
- 需配合 DevOps 团队确认 Vercel 项目配置和权限设置

## 6. 验收标准
- 在 staging 环境成功执行 smoke test，所有检查项均通过
- GitHub Actions workflow 不再出现自动回滚失败
- Vercel 自动分配生产域名功能正常工作，无需手动 promote
- 部署失败时，日志清晰，告警及时，SOP 可执行

## 7. 复杂度评估
- 复杂度：Medium
- 理由：需结合 CI/CD 流程、前端代码和环境配置多方面排查，涉及自动化测试和部署配置，修复后需多轮验证

---

以上方案旨在快速定位和修复 staging smoke test 失败问题，保障持续集成和持续部署流程的稳定性和自动化。