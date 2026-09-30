// Global vitest setup. Loaded by every test (per vite.config.ts → test.setupFiles).
// Side-effect import registers @testing-library/jest-dom matchers (e.g.
// toBeInTheDocument, toHaveTextContent) on vitest's `expect`. The matchers
// only activate when given DOM elements, so this is a no-op for the
// pre-existing node-env renderToString tests.
import '@testing-library/jest-dom/vitest';

// happy-dom >= 20.12 实现了 WAAPI，但它在 Animation 构造函数里就创建 `finished`，cancel() 时
// 用 AbortError reject 它。浏览器是访问时才懒创建，所以只有 happy-dom 会留下无人 catch 的孤儿
// rejection，被 vitest 计入 run error（motion-dom 的 cancel() 只包了同步 throw）。取消前先给
// 当前 `finished` 挂一个空 handler —— play() 会重建这个 promise，所以只能在这里补，不能只在
// element.animate() 返回时补一次。
if (typeof window !== 'undefined' && typeof window.Animation?.prototype.cancel === 'function') {
  const cancel = window.Animation.prototype.cancel;
  window.Animation.prototype.cancel = function cancelWithHandledFinished(this: Animation) {
    this.finished.catch(() => {});
    return cancel.call(this);
  };
}
