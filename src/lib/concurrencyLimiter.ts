/**
 * Simple concurrency limiter for HTTP requests.
 * Prevents request storms that trigger 429 rate limits.
 */

type Task<T> = () => Promise<T>;

interface QueueEntry<T> {
  task: Task<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

export class ConcurrencyLimiter {
  private readonly maxConcurrent: number;
  private readonly delayBetweenMs: number;
  private running = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private queue: QueueEntry<any>[] = [];

  constructor(maxConcurrent = 3, delayBetweenMs = 200) {
    this.maxConcurrent = maxConcurrent;
    this.delayBetweenMs = delayBetweenMs;
  }

  run<T>(task: Task<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.flush();
    });
  }

  private flush(): void {
    while (this.running < this.maxConcurrent && this.queue.length > 0) {
      const entry = this.queue.shift()!;
      this.running++;
      entry
        .task()
        .then(entry.resolve)
        .catch(entry.reject)
        .finally(() => {
          this.running--;
          if (this.delayBetweenMs > 0) {
            setTimeout(() => this.flush(), this.delayBetweenMs);
          } else {
            this.flush();
          }
        });
    }
  }
}

/** Shared limiter for CoinGecko API calls: max 2 concurrent, 250ms gap */
export const coingeckoLimiter = new ConcurrencyLimiter(2, 250);
