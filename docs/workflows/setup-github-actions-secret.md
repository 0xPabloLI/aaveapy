# 设置 GitHub Actions Secrets

仓库 CI 里需要值的 secret 统一走 GitHub 仓库级 Secrets;本文是 Droid workflow 所需的 `FACTORY_API_KEY` 设置流程(其他 secret 同理替换)。

## 生成 key

1. 打开 https://app.factory.ai/settings/api-keys
2. 生成新 key(账户级别;同账户下所有仓库共用,`inside-china-ai` 与本仓库用的是同一个 key)

## 写入仓库 secret

**推荐(值不进 shell history / 聊天记录)**:

```bash
gh secret set FACTORY_API_KEY --repo 0xPabloLI/aaveapy
# 提示时粘贴 key,回车
```

或经 GitHub UI:仓库 Settings → Secrets and variables → Actions → New repository secret,Name 填 `FACTORY_API_KEY`。

## 为什么必须显式设置

Droid workflow 读的是 `${{ secrets.FACTORY_API_KEY }}`。Secret 不存在时:

- action 不会失败,而是**静默跳过**(exit 0,check 显示绿色 success)
- PR 上不会有任何 review 评论

也就是说:**CI 绿 ≠ Droid 在正常工作**。判断 Droid 是否真实工作的唯一方法是看 PR 上有没有出现 Droid 的 review,或在 run 日志里搜 `Skipping action due to workflow validation`。

## 已知限制(检测时别误判为配置错误)

1. **PR 自带 workflow 变更时,该 PR 的 Droid check 会跳过**——GitHub 安全机制:`pull_request` 事件只运行默认分支(main)上已存在的 workflow 定义。新 workflow 的第一次真实运行发生在合并进 main 之后的第一个 PR。
2. **key 无法从一个仓库"复制"到另一个仓库**——GitHub secrets 只写不可读。每个仓库单独 `gh secret set` 一次(值可以相同)。

## 验证

```bash
# 1. secret 存在(只能看到名字和日期)
gh secret list --repo 0xPabloLI/aaveapy | grep FACTORY_API_KEY

# 2. workflow 已在默认分支上
gh api /repos/0xPabloLI/aaveapy/contents/.github/workflows/droid-review.yml?ref=main --jq .name

# 3. 打开任意测试 PR,确认出现 Droid review;或检查 run 日志无 "Skipping action" 行
```
