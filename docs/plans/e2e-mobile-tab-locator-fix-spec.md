# Spec: e2e mobile Supply/Borrow tab locator 修复（role 不匹配）

## Problem Statement

mobile self-loop / cross-asset e2e 在 Merkl 数据可用窗口内真实执行时，`fillBorrowAmountMobile` 的 Borrow tab click 等待 180s 超时失败。7/16 的 ARIA audit（AAV-1182~1186）给 mobile portfolio 卡片的 pill tab 加了显式 `role="tab"`（tablist/tab），Playwright 的 `getByRole('button')` 不再匹配显式 `role="tab"` 的元素。此前该路径被两件事掩盖：Merkl 数据缺失时的 skip 防御（测试从未执行到 click）和 main 上旧版 `readSupplyIncentiveAfter` 的硬断言 fail-fast（更早失败）。

## Solution

三处修复（e2e 测试代码，产品代码不动）：

1. **tab locator**：将 e2e 中 3 处 mobile tab 定位从 `getByRole('button', ...)` 改为 `getByRole('tab', ...)`（与组件的显式 ARIA role 一致）。
2. **supply 输入定位**：mobile 路径新增 `fillSupplyAmountMobile`，将 supply 输入限定到目标 reserveId 卡片内——portfolio 默认含 20 张多链卡片，全局 `first()` 可能填到其他链的同名 token。
3. **激励归零语义**：`readSupplyIncentiveAfter` 区分两种"无值"——own-borrow offset 把 supply 激励完全抵消后 UI 渲染**en dash（–）**占位，这是合法模拟结果，返回 0 让断言继续；cell 元素整体不存在才是数据缺失，返回 NaN 触发 skip。原实现用 em dash（—）匹配，字符不一致导致归零永远被判为数据缺失。

## User Stories

1. As a maintainer, I want e2e mobile tab 定位与组件 ARIA role 匹配, so that mobile self-loop / pairing 场景在数据可用时稳定执行。
2. As a maintainer, I want dev/main CI 的 e2e-mobile (1/2) job 稳定, so that dev→main PR 与 bot PR 不被间歇红阻塞。

## Implementation Decisions

- 修改点仅 3 处 locator：offset spec 的 Borrow click（fillBorrowAmountMobile）、offset spec 的 Supply tab（readSupplyIncentiveAfter mobile 分支）、asset-pairing spec 的 Borrow click（同名 helper）。
- desktop 路径不动：desktop 组件无 `role="tab"`（模拟输入常驻，无 tab 切换）。
- `readSupplyIncentiveAfter` 的 Supply tab 定位修复后，catch 容错保留（Merkl 缺失仍 skip）。
- 组件侧不动：`role="tab"`/`tablist` 是 ARIA audit 的正确产物，单测（textContent 过滤）不受影响。

## Testing Decisions

- e2e 文件不在 eslint/tsc 覆盖范围（eslint.config ignores e2e），修复的正确性验证 = 本地 Playwright 真实运行 mobile self-loop 场景（staging 数据可用窗口内）。
- Validation Gate 四连照跑（防其余部分回归）。

## Scenario & Risk Verification Matrix

| 场景 | 状态 | 期望 |
|------|------|------|
| mobile self-loop，Merkl 数据可用 | 修复后 | tab click 命中、supply 输入落在目标卡、场景完整执行（本地实测 passed） |
| mobile self-loop，Merkl 数据缺失 | 修复后 | cell 不存在 → NaN → `test.skip`（不 fail） |
| full/over offset 激励归零 | 修复后 | cell 显示 en dash → 返回 0，断言继续（本地实测 passed） |
| readSupplyIncentiveAfter mobile 分支 | 修复后 | Supply tab 正确切换（不再靠 catch 掩盖） |
| desktop 全路径 | 不受影响 | locator 未改动，行为不变（本地实测 passed） |
| 组件 ARIA / 单测 | 不受影响 | 组件零改动，Validation Gate 全绿 |
| 其他 e2e（不含此 helper） | 不受影响 | 未触碰 |

## Out of Scope

- main 上旧版 `readSupplyIncentiveAfter` 硬断言（已由 dev 现行版本修复，随 #607 进 main）。
- Merkl live 数据间歇缺失的治理。
- #605/#600 的合并策略。

## Further Notes

- 8/24 dev CI 的"绿"实为 skip 掩盖下的绿；8/25 起数据窗口打开后暴露 click 挂。desktop 版无 tab 切换故一直绿。
