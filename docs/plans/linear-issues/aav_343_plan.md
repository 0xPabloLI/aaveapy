# 开发方案 - AAV-343 🚨 staging smoke test failed — deployment rolled back

## 1. Issue 概述
staging 环境部署后触发的自动 smoke test 失败，导致部署回滚未自动执行，需要排查失败原因，修复问题，确保后续部署稳定通过 smoke test，并完善防止复发的流程和告警机制。

## 2. 当前状态
- 状态：Backlog，尚未开始
- 失败发生在 commit `d913b4e`
- 自动回滚因预览分支或 token 缺失被跳过，需手动恢复

## 3. 影响范围
- 前端仓库：aaveapy / lovable 分支（部署在 Vercel staging）
- CI/CD 工作流：`.github/workflows/deployment-smoke-test.yml`

## 4. 实现方案

### 4.1 根因排查
- 查看 GitHub Actions 失败日志（[workflow logs](https://github.com/0xPabloLI/aaveapy/actions/runs/25900440054)）
- 确认具体失败的测试或检查点（如接口响应、页面渲染、环境变量等）
- 回溯相关代码变更，定位可能引入问题的 commit 代码段
- 检查 Vercel 部署设置，确认预览分支和 token 配置是否正确

### 4.2 修复问题
- 针对失败点，修改代码或配置：
  - 若是接口不通，检查后端服务状态和 API 地址配置
  - 若是环境变量缺失，补充或修正 Vercel 环境变量设置
  - 若是测试脚本错误，修正测试用例或依赖
- 本地及 CI 复现 smoke test，确保修复有效

### 4.3 防止复发
- 优化 smoke test 脚本，增加失败时的详细日志输出
- 在 GitHub Actions 中加入失败自动提醒（Slack/邮件）
- 确保 Vercel 项目设置中自动分配生产域名功能开启，避免手动操作遗漏
- 编写 SOP 文档，明确部署失败后的应急处理流程（包括手动回滚、通知流程）

### 4.4 相关文件修改
- `.github/workflows/deployment-smoke-test.yml`：检查并完善失败处理逻辑及告警
- Vercel 项目设置（Web UI）：确认自动分配生产域名配置
- `docs/operations/smoke-test-sop.md`（新建）：编写部署失败应急操作流程
- 可能涉及前端代码或测试脚本文件，根据具体失败点调整

### 4.5 数据流变更
- 无数据库或后端数据变更，主要为 CI/CD 流程和前端部署配置调整

## 5. 依赖关系
- 无直接依赖其他 Issue，但建议结合 AAV-329（Operations/SOP）统一完善运维流程

## 6. 验收标准
- 在 staging 分支推送修复后，GitHub Actions smoke test 成功通过，无失败回滚
- Vercel 自动分配生产域名功能正常，无需手动干预
- 失败时自动发送告警通知
- SOP 文档完成并通过团队评审

## 7. 复杂度评估
- Medium  
  理由：需要定位具体失败原因，涉及 CI/CD 流程和部署配置，需协调前端代码和运维设置，且需完善告警和操作流程，确保稳定性和团队协作效率。