/**
 * Sliding-window rate limiter for outgoing Reddit API requests.
 *
 * Reddit's OAuth rate limit is 60 requests per minute.
 * This limiter tracks request timestamps in a 60-second window and throws
 * a RateLimitError immediately if the limit is exceeded — no queuing.
 *
 * Usage: replace `fetch(url, init)` with `redditFetch(url, init)` for any
 * call that counts against the Reddit API quota. Token endpoint calls should
 * use plain `fetch` and are intentionally excluded.
 */

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 60; // Reddit OAuth limit

export class RateLimitError extends Error {
  readonly retryAfterMs: number;

  constructor(retryAfterMs: number) {
    const seconds = Math.ceil(retryAfterMs / 1000);
    super(
      `Reddit API rate limit exceeded (${MAX_REQUESTS} req/min). ` +
        `Try again in ${seconds}s.`,
    );
    this.name = 'RateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

class RedditRateLimiter {
  /** Timestamps (ms) of requests made inside the current window. */
  private readonly timestamps: number[] = [];

  /**
   * Records a new request slot, or throws RateLimitError if the window is full.
   * Prunes stale timestamps before checking.
   */
  private acquire(): void {
    const now = Date.now();
    const windowStart = now - WINDOW_MS;

    // Drop timestamps that have slid out of the window
    while (this.timestamps.length > 0 && this.timestamps[0] <= windowStart) {
      this.timestamps.shift();
    }

    if (this.timestamps.length >= MAX_REQUESTS) {
      // Oldest timestamp in the window tells us how long to wait
      const retryAfterMs = this.timestamps[0] + WINDOW_MS - now;
      console.debug(
        `[RedditRateLimiter] blocked — ${this.timestamps.length}/${MAX_REQUESTS} in window, retry in ${retryAfterMs}ms`,
      );
      throw new RateLimitError(Math.max(retryAfterMs, 1));
    }

    this.timestamps.push(now);
    console.debug(
      `[RedditRateLimiter] acquired — ${this.timestamps.length}/${MAX_REQUESTS} in window`,
    );
  }

  /** Drop-in replacement for `fetch` that enforces the rate limit. */
  fetch(url: string, init?: RequestInit): Promise<Response> {
    this.acquire(); // throws synchronously if the quota is exhausted
    console.debug(`[RedditRateLimiter] → ${init?.method || 'GET'} ${url}`);
    return fetch(url, init).then(
      (resp) => {
        console.debug(`[RedditRateLimiter] ← ${resp.status} ${url}`);
        return resp;
      },
      (err) => {
        console.debug(`[RedditRateLimiter] ✗ fetch error for ${url}:`, err);
        throw err;
      },
    );
  }

  /** Current number of requests recorded in the active window (for debugging). */
  get requestsInWindow(): number {
    const windowStart = Date.now() - WINDOW_MS;
    return this.timestamps.filter((t) => t > windowStart).length;
  }
}

// Singleton — shared across all hooks so limits are enforced globally.
const rateLimiter = new RedditRateLimiter();

/**
 * Rate-limited fetch for Reddit API endpoints.
 * Throws RateLimitError synchronously (before the network call) when the
 * 60 req/min quota is exhausted.
 */
export function redditFetch(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  return rateLimiter.fetch(url, init);
}
