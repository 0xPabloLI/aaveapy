# 开发方案 - AAV-331 🚨 staging smoke test failed — deployment rolled back

## 1. Issue 概述
本 Issue 报告 AaveAPY 项目在 staging 环境的自动 smoke test 失败，导致部署被回滚。需要排查失败根因，修复问题，确保后续部署通过 smoke test，避免类似回滚和自动分配域名失效的问题。

## 2. 当前状态
- 状态：Backlog，尚未开始排查和修复。
- 失败发生在 staging 环境，具体失败点需通过 GitHub Actions workflow 日志确认。

## 3. 影响范围
- 主要涉及前端仓库 `aaveapy/lovable` 的 CI/CD 流程（GitHub Actions + Vercel 部署）。
- 可能涉及后端接口稳定性（`aave-protocol-analysis/railway`）如果 smoke test 依赖后端 API。

## 4. 实现方案

### 4.1 根因排查步骤
- **查看失败日志**  
  访问 [workflow run logs](https://github.com/0xPabloLI/aaveapy/actions/runs/25831661906)，定位具体失败的测试用例或步骤（如 API 请求失败、页面渲染异常、环境变量缺失等）。
- **确认失败类型**  
  - 是前端构建失败？  
  - 是 smoke test 脚本中接口请求失败？  
  - 是环境配置（如 Vercel Token）缺失导致自动回滚跳过？
- **检查最近代码变更**  
  通过 `b62b62d` commit 对比，确认是否有改动影响部署或测试。
- **本地复现**  
  在本地或测试环境运行相同 smoke test 脚本，确认问题是否可复现。

### 4.2 修复方案
- **修复代码或配置问题**  
  - 如果是代码 bug，修复相关逻辑或依赖。  
  - 如果是环境变量缺失，补充 Vercel Token 或相关配置。  
  - 如果是测试脚本问题，修正测试用例或超时设置。
- **完善 CI/CD 流程**  
  - 确保自动回滚机制配置正确，避免跳过自动回滚。  
  - 配置 Vercel 项目自动分配生产域名，避免手动干预。  
  - 增加 smoke test 前置检查，提前捕获环境问题。
- **增加监控和告警**  
  - 在 GitHub Actions 中增加失败告警（邮件/Slack）。  
  - 记录失败原因，方便后续分析。

### 4.3 具体文件及代码修改
- `.github/workflows/deployment-smoke-test.yml`  
  - 增加失败日志收集和告警步骤。  
  - 确认 Vercel Token 配置和自动回滚逻辑。
- `scripts/smoke-test.js` 或相关测试脚本  
  - 修复测试逻辑或超时设置。
- Vercel 项目设置（非代码）  
  - 启用自动分配生产域名。  
  - 配置正确的环境变量。

## 5. 依赖关系
- 无直接依赖其他 Issue，但需确保后端 API 稳定，可能关联后端服务健康状态。
- 依赖正确配置 Vercel Token 和项目设置。

## 6. 验收标准
- 在 staging 分支推送修复后，GitHub Actions 自动部署成功且 smoke test 通过，无回滚。
- 自动分配生产域名功能正常，无需手动干预。
- 失败时能自动生成告警，方便快速响应。
- 本地及 CI 环境均能复现并验证 smoke test 成功。

## 7. 复杂度评估
- **Medium**  
  需要排查 CI/CD 流程、环境配置和测试脚本，涉及多系统联动。修复后需验证多次部署流程，保证稳定性。

---

此方案重点在于快速定位 smoke test 失败根因，修复并完善自动化部署流程，避免未来类似回滚和域名分配问题，提升发布稳定性和可维护性。