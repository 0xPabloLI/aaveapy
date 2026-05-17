# AAV-345 开发方案

## 1. Issue 概述
本 Issue 是一次 staging 环境的 Smoke Test 失败导致部署回滚的告警。需要排查失败的根因，修复问题，防止类似失败再次发生，并完善告警处理流程。

## 2. 当前状态
- 状态：Backlog，尚未开始排查和修复
- 失败发生在 commit `9966dae` 的部署过程中
- 自动回滚被跳过（preview branch 或 token 缺失）
- 需要人工介入恢复

## 3. 影响范围
- 前端仓库：aaveapy / lovable 分支（部署在 Vercel staging）
- CI/CD 工作流：`.github/workflows/deployment-smoke-test.yml`
- 可能涉及后端接口的可用性（若 Smoke Test 依赖后端）

## 4. 实现方案

### 4.1 根因排查
- 查看 GitHub Actions 失败的具体日志（[workflow run logs](https://github.com/0xPabloLI/aaveapy/actions/runs/25903871396)）
- 确认失败的具体测试项（接口响应、页面渲染、关键功能等）
- 回溯 commit `9966dae` 的代码变更，分析是否引入了破坏性改动
- 检查 Vercel 部署日志，确认部署是否成功完成，环境变量是否正确配置
- 检查自动回滚跳过的原因，确认 preview branch 和 token 配置是否正确

### 4.2 修复方案
- 针对失败的测试项进行代码修复，确保功能正常
- 如果是环境配置问题，补充缺失的 token 或修正 preview branch 设置
- 本地及 CI 环境复现 Smoke Test，确保修复有效
- 提交修复 PR，触发新的 staging 部署

### 4.3 防止复发
- 优化 Smoke Test 脚本，增加更全面的覆盖和异常捕获
- 在 CI 流程中增加对环境变量和 token 的校验步骤
- 配置 Vercel 项目，确保自动回滚功能正常启用
- 在 GitHub Actions 中增加失败自动提醒和责任人通知

### 4.4 告警处理 SOP
- 制定标准操作流程文档，明确 Smoke Test 失败后的排查步骤和责任分配
- 配置 GitHub Issue 自动创建规则，确保失败信息及时跟踪
- 定期回顾和优化 Smoke Test 流程，减少误报和漏报

## 5. 依赖关系
- 无直接依赖其他 Issue，但建议结合 AAV-320、AAV-330~348 相关 Smoke Test 失败问题统一处理

## 6. 验收标准
- 修复后 staging 环境 Smoke Test 全部通过，无失败记录
- 自动回滚功能正常触发，且自动分配域名功能正常
- CI/CD 流程中环境变量和 token 校验通过
- 告警处理流程文档完成并被团队认可

## 7. 复杂度评估
- Medium  
  理由：需要综合分析 CI/CD 流程、环境配置和代码变更，涉及多系统联动，但不涉及核心业务逻辑改动，修复周期中等。