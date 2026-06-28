# Phase 5: Plasma Chain Console 请求错误

> Issue: AAV-802
> 估计: 0.5 session

## 问题

前端 console 持续报 chain 9745 plasma 的请求错误。用户确认 RPC 配置存在，chain list 也有 plasma RPC。

## 调查方向

- 错误具体来源（哪个 fetch / 哪个 library 发的请求）
- 是否 chainDiscovery 相关（参见 Learned Lessons: chainDiscovery 404 根因）
- Plasma chain 的 RPC URL 是否正确
- wagmi/viem 配置中是否缺少 plasma chain

## Grill 要点

- 需要先复现：dev server 打开 console 看具体错误
- 对照 Learned Lessons 中 chainDiscovery 的教训
