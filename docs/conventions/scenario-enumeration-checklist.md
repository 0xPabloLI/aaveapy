# Scenario Enumeration Checklist

> 在 R2/R3 的决策阶段逐类检查适用场景。S1 把结论记入当前 scope 与验证计划；S2/S3 固化到 spec 的 **Scenario & Risk Verification Matrix**。每行都必须有 evidence，但不一定各自对应一个自动化测试。
>
> 与 `scenario-matrix.md` 互补：本文档定义**查什么**，scenario-matrix 定义**怎么记**。
>
> 各类目中的示例混用了不同技术栈（React/缓存库/数据库/区块链等），按本 repo 的实际技术栈替换对应例子；**类目本身与「要问的问题」是通用的**。`[SLOT: 可追加本 repo 专属专项类目，如认证授权 / 内容发布 / 内存缓存]`

## 用法

1. 决策阶段：逐类过一遍「要问的问题」，只保留与本次改动相关的场景并给出明确答案。
2. 记录阶段：S1 写入当前 scope/验证计划；S2/S3 写入 Scenario & Risk Verification Matrix（含 Modified Files Impact + Behavioral Scenarios）。
3. 实施阶段：确定且可自动验证的行为走 TDD；其余场景使用静态检查、runtime/real-data smoke 或 human acceptance，并保留行到 evidence 的映射。

---

## 1. Null / Undefined / Empty 边界

**要问的问题**：

- 所有 optional 字段为 `undefined` 时行为是否定义？
- 空数组（`[]`）、空字符串（`""`）、空对象（`{}`）是否独立测试？
- `0` vs `null` vs `undefined` 的语义差异是否处理？
- 使用 `??` 还是 `||` 是否符合 `0`、`false`、`""`、`null`、`undefined` 的业务语义？

**常见陷阱**：

- `value ?? defaultValue` **只在 `value` 为 `null` 或 `undefined` 时走 fallback**，会保留 `0`、`false` 和 `""`。
- `value || defaultValue` 会把 `0`、`false` 和 `""` 也视为 falsy 并走 fallback；这些值有业务意义时常导致 bug。
- API 返回字段为 `null` vs 字段不存在——消费方需统一处理。
- `null` 表示「明确无值」（如文章无封面图），`undefined` 表示「未查询」——不可互换。

## 2. 数值精度

**要问的问题**：

- 金额/链上数量计算是否用整数最小单位而非浮点？
- 浮点比较是否用 `|delta| < epsilon` 而非 `===`？
- 百分比/比率计算是否明确单位（0-1 vs 0-100；raw vs human-readable）？
- 数据库/API 返回 numeric 的字符串化，是否正确转换？

**常见陷阱**：

- `0.1 + 0.2 !== 0.3` — 金额计算用整数最小单位避免浮点误差。
- `JSON.parse` 大整数丢精度 — 超过 `Number.MAX_SAFE_INTEGER` 用 `BigInt`。
- 百分比单位不一致（前端 0-1，后端 0-100）→ 显示 100x 偏差。
- 链上 raw（base units 含 decimals）与 value（human-readable）混用 → 千倍级错误。

## 3. 状态转换

**要问的问题**：

- 核心实体状态流转是否完整（draft → published → archived → deleted 等）？
- 用户角色/权限切换时 UI 是否正确响应？
- 数据获取层的 loading / error / success 状态组合是否覆盖？
- 组件 mount / unmount 期间的异步操作是否处理？

**常见陷阱**：

- 状态转换的中间态未处理（如并发编辑期间的状态漂移）。
- 角色变更后客户端缓存未清理 → 低权限用户看到高权限数据。
- 异步操作完成后组件已 unmount → setState on unmounted component。

## 4. 并发 / 竞态

**要问的问题**：

- 数据获取/缓存层的竞态是否自动处理？
- stale data 是否会覆盖 fresh data（staleTime/缓存配置是否合理）？
- 多用户/多进程同时写同一资源时的冲突处理？
- 实时订阅（WebSocket/Realtime）的消息顺序保证？

**常见陷阱**：

- `Promise.all` 中一个 reject 导致整体 fail → 应用 `Promise.allSettled`。
- 实时消息乱序到达 → 状态不一致。用乐观更新 + 冲突检测。
- 多个 mutation 并发触发 → 后到的覆盖先到的（last-write-wins 是否可接受？）。

## 5. 失败 / 降级

**要问的问题**：

- 依赖服务连接失败时降级路径是否定义？
- API 超时 / 5xx / 网络断开是否分别处理？
- 认证过期时是否自动刷新 / 重定向登录？
- 部分数据加载失败时是否保持其余数据？

**常见陷阱**：

- 降级返回 `undefined`，消费方未处理 → crash。应返回结构一致的数据。
- 认证过期未处理 → API 返回 401 但前端无感知，用户看到空白。
- Error boundary 未覆盖异步错误 → 白屏。
- 权限层拒绝访问时返回空数组而非错误 → 前端误以为「无数据」。

## 6. 跨系统键匹配

**要问的问题**：

- 前端 ID 与后端主键格式是否一致（UUID vs string vs number）？
- 路由参数与数据库查询的 ID 是否正确传递（编码 / 解码）？
- 外键/关联键是否正确（包括 null 外键）？
- Map key 或 channel name 等复合 key 的构造，生产方与消费方是否用同一个函数？

**常见陷阱**：

- UUID 大小写不一致（后端返回小写，前端比较时未标准化）。
- 路由参数 `encodeURIComponent` 后的 ID 与数据库查询不匹配。
- 跨模块各自实现「看起来一样」的 key 构造函数（分隔符不同）→ 查找永远 miss。

## 7. 多实体组合

**要问的问题**：

- 单条记录 vs 多条记录行为是否一致？
- 空列表 vs 有数据列表 vs 加载中列表的 UI 状态？
- 分页边界（第一页 / 最后一页 / 超出范围）是否处理？
- 批量操作是否处理部分失败？

**常见陷阱**：

- 空列表未显示 empty state → 用户看到空白。
- 分页 cursor 漏掉最后一条 / 重复某条。
- 批量操作中部分失败时整体回滚 vs 部分成功——需明确定义。

## 8. 跨 Step 接口契约

> 当前 step 产出的字段格式，下游 step 能否直接消费？

**要问的问题**：

- 当前 step 产出的字段格式，下游 step 能否直接消费？
- 当前 step 定义的 key / ID 构造方式，下游 step 是否用相同逻辑？
- 下游 step 是否依赖当前 step 未显式声明的隐式约定？
- 如果当前 step 的产出格式变化，哪些下游 step 会 break？
- 「函数存在 + 有测试」≠「被消费方 import + 运行时可达」——链路是否接通？

**验证方法**：

1. 在 grill 阶段写出当前 step 的**接口契约**（产出字段名 + 格式 + 示例值）。
2. 模拟下游 step 的消费场景：用当前 step 的产出作为输入，下游 step 能否正确匹配 / 解析？
3. 如果下游 step 尚未设计，先检查依赖链，确认下游 step 存在且会消费当前产出。

## 9. CI/CD 交互

**要问的问题**：

- 本地开发环境 vs CI 环境差异是否考虑（node 版本、env 变量、globstar、容器差异）？
- 环境变量存在 vs 缺失时的行为是否定义？
- pre-commit / pre-push hook 的行为是否一致？
- 部署时 migration / build 产物 / 生成文件的执行顺序与目录存在性是否正确？

**常见陷阱**：

- 本地 `.env` 有变量但 CI 没有 → 构建通过但运行时 crash。
- Migration 顺序错误 → 外键约束失败。
- 本地 CI 不跑 Docker build → 本地残留目录掩盖 ENOENT。
- build script `writeFileSync` 的目标目录在 script 和 Dockerfile 两方都不保证存在。

---

## 检查清单速查（Grill 阶段快速过一遍）

```
□ 1. Null / Undefined / Empty 边界
□ 2. 数值精度（整数 vs 浮点 / 单位与 raw-value 语义）
□ 3. 状态转换（实体状态 / 角色 / 数据获取状态）
□ 4. 并发 / 竞态（缓存 / 实时订阅 / 并发编辑）
□ 5. 失败 / 降级（依赖失败 / 认证过期 / 权限拒绝）
□ 6. 跨系统键匹配（ID 格式 / 路由参数 / 外键 / 复合 key）
□ 7. 多实体组合（空列表 / 分页 / 批量操作部分失败）
□ 8. 跨 Step 接口契约（产出格式 → 下游消费可行性 / 链路接通）
□ 9. CI/CD 交互（env / migration / 环境差异）
□ [SLOT: 本 repo 专属专项类目]
```
