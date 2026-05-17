# 开发方案 — AAV-342 🚨 staging smoke test failed — deployment rolled back

## 1. Issue 概述
staging 环境部署后自动触发的 smoke test 失败，导致部署回滚未自动执行（因缺少 preview branch 或 token），需要排查失败根因，修复问题，确保后续部署顺利通过 smoke test 并自动或手动恢复。

## 2. 当前状态
- 状态：Backlog，尚未开始处理
- 已有 GitHub Actions workflow 运行日志，包含失败信息
- 自动回滚未执行，需手动介入恢复

## 3. 影响范围
- 仓库：aaveapy（前端，lovable 分支）
- 可能涉及部署配置、CI/CD workflow、前端代码或后端接口调用

## 4. 实现方案

### 4.1 根因排查步骤
- 查看 GitHub Actions workflow 运行日志（[链接](https://github.com/0xPabloLI/aaveapy/actions/runs/25900208459)）
  - 确认具体失败的测试用例或检查点（如接口响应、页面渲染、API 数据正确性等）
  - 结合最近提交 `b583a91` 的代码变更，定位可能引入的问题
- 检查 Vercel 部署日志，确认是否有构建失败或环境变量配置异常
- 确认是否有外部依赖（如后端 API）不可用或接口变更导致前端请求失败

### 4.2 修复方案
- 针对发现的具体错误，修改对应代码或配置
  - 若是接口变更，确认后端接口兼容性或前端适配
  - 若是环境变量缺失，补充 Vercel staging 环境配置
  - 若是测试用例本身问题，修正测试逻辑
- 本地及 CI 复现 smoke test，确保问题彻底解决

### 4.3 部署与验证
- 提交修复代码，触发新的 staging 部署
- 观察 GitHub Actions workflow 是否通过所有 smoke test
- 若自动回滚未触发，手动执行 `vercel promote` 恢复生产环境，或重新开启 Vercel 自动分配功能

### 4.4 防止复发措施
- 优化 smoke test 脚本，增加失败时详细日志输出
- 在 CI workflow 中增加环境变量和权限校验，避免因 token 缺失导致自动回滚失败
- 编写部署异常处理 SOP，明确手动恢复流程及责任人

## 5. 依赖关系
- 无直接依赖其他 Issue，但需配合当前最新后端接口稳定性
- 需确保 staging 环境配置完整

## 6. 验收标准
- 新的 staging 部署通过所有 smoke test 检查
- 自动回滚机制正常触发（或手动恢复流程顺畅）
- 相关日志和告警信息清晰，方便后续问题排查
- 相关文档（SOP）更新完成

## 7. 复杂度评估
- Medium
- 需要定位具体失败原因，可能涉及多系统联动（前端、后端、CI/CD、Vercel）
- 修复后需多轮验证，保证部署流程稳定可靠

---

此方案旨在快速定位并修复 staging smoke test 失败问题，保障部署流程稳定，避免生产环境风险。