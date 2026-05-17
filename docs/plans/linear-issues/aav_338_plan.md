# 开发方案 - AAV-338 🚨 staging smoke test failed — deployment rolled back

## 1. Issue 概述
本 Issue 反映在 staging 环境部署后，自动 smoke test 失败，导致部署被回滚。需要排查失败根因，修复问题，确保后续部署稳定通过 smoke test，并完善防复发机制和告警处理流程。

## 2. 当前状态
- 状态：Backlog，尚未开始排查和修复
- 仅有 GitHub Actions workflow 失败日志，未明确具体失败点

## 3. 影响范围
- 前端仓库：`aaveapy`（lovable 分支）
- CI/CD 流程相关（`.github/workflows/deployment-smoke-test.yml`）

## 4. 实现方案

### 4.1 根因排查
- 访问失败的 Workflow Run 日志（[链接](https://github.com/0xPabloLI/aaveapy/actions/runs/25862201036)）
- 定位失败的具体步骤（如接口响应异常、超时、断言失败等）
- 对比当前提交 `bba7cf1` 与前一个成功提交的差异，重点关注：
  - 代码变更（前端页面、API调用）
  - 依赖库升级
  - CI 配置变更
- 本地或测试环境复现 smoke test 流程，确认问题

### 4.2 修复问题
- 根据排查结果，修改对应代码或配置：
  - 若接口响应异常，检查后端接口是否正常，或前端调用是否正确
  - 若超时，考虑增加超时阈值或优化接口性能
  - 若断言错误，确认测试用例是否合理或数据是否正确
- 本地及 CI 复测，确保 smoke test 通过

### 4.3 防止复发
- 优化 GitHub Actions workflow：
  - 增加失败时的详细日志输出
  - 增加重试机制（如适用）
- 在 PR 流程中增加 smoke test 预跑，避免问题合入主分支
- 配置 Vercel 项目，确保自动分配生产域名功能正常，避免手动干预

### 4.4 告警处理 SOP
- 编写并发布 Smoke Test 失败处理文档，包含：
  - 如何查看失败日志
  - 常见失败类型及排查步骤
  - 如何手动回滚和恢复部署
  - 联系人和响应时间要求
- 在 GitHub Issue 模板中加入自动生成的失败信息，便于快速响应

### 4.5 具体文件修改建议
- `.github/workflows/deployment-smoke-test.yml`
  - 增加日志详细度和重试策略
- `docs/operations/`（新建或更新）
  - 新增 Smoke Test 失败处理 SOP 文档
- 相关前端代码文件（根据排查结果）
  - 修复导致测试失败的代码

## 5. 依赖关系
- 无直接依赖其他 Issue，但需关注近期合入的变更（可能关联其他未解决的 Bug）
- 需配合后端接口稳定性确认

## 6. 验收标准
- 在 staging 环境成功部署后，smoke test 全部通过，无失败
- GitHub Actions workflow 运行稳定，无频繁误报
- 告警处理文档完成并通过团队评审
- Vercel 自动分配生产域名功能正常，无需手动干预

## 7. 复杂度评估
- 复杂度：Medium
- 理由：需排查 CI/CD 流程和代码变更，涉及多系统联动，但修复方案明确，且已有完善的自动化测试框架支持

---

此方案旨在快速定位并修复 smoke test 失败根因，保障 staging 部署稳定，同时完善流程和告警机制，提升整体运维效率。