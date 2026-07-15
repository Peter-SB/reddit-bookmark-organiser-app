describe('redditFetch', () => {
  let nowSpy: jest.SpyInstance<number, []>;
  let currentTime: number;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    jest.resetModules();
    currentTime = 1_000_000;
    nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => currentTime);
    fetchMock = jest.fn().mockResolvedValue({ ok: true } as Response);
    (global as any).fetch = fetchMock;
  });

  afterEach(() => {
    nowSpy.mockRestore();
  });

  function advance(ms: number) {
    currentTime += ms;
  }

  it('passes requests through to fetch while under the limit', async () => {
    const { redditFetch } = require('../RedditRateLimiter');
    await redditFetch('https://oauth.reddit.com/r/memes/hot');
    expect(fetchMock).toHaveBeenCalledWith('https://oauth.reddit.com/r/memes/hot', undefined);
  });

  it('forwards the init argument to fetch', async () => {
    const { redditFetch } = require('../RedditRateLimiter');
    const init = { headers: { Authorization: 'Bearer x' } };
    await redditFetch('https://oauth.reddit.com/r/memes/hot', init);
    expect(fetchMock).toHaveBeenCalledWith('https://oauth.reddit.com/r/memes/hot', init);
  });

  it('allows exactly 60 requests within a 60s window', async () => {
    const { redditFetch } = require('../RedditRateLimiter');
    for (let i = 0; i < 60; i++) {
      await redditFetch('https://oauth.reddit.com/x');
    }
    expect(fetchMock).toHaveBeenCalledTimes(60);
  });

  it('throws RateLimitError on the 61st request within the window', async () => {
    const { redditFetch, RateLimitError } = require('../RedditRateLimiter');
    for (let i = 0; i < 60; i++) {
      await redditFetch('https://oauth.reddit.com/x');
    }
    expect(() => redditFetch('https://oauth.reddit.com/x')).toThrow(RateLimitError);
    expect(fetchMock).toHaveBeenCalledTimes(60);
  });

  it('reports a retryAfterMs consistent with the oldest request in the window', async () => {
    const { redditFetch, RateLimitError } = require('../RedditRateLimiter');
    for (let i = 0; i < 60; i++) {
      await redditFetch('https://oauth.reddit.com/x');
    }
    advance(10_000); // 10s into the window
    try {
      redditFetch('https://oauth.reddit.com/x');
      fail('expected RateLimitError to be thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitError);
      expect((err as InstanceType<typeof RateLimitError>).retryAfterMs).toBe(50_000);
    }
  });

  it('allows a new request once the oldest timestamp slides out of the window', async () => {
    const { redditFetch } = require('../RedditRateLimiter');
    for (let i = 0; i < 60; i++) {
      await redditFetch('https://oauth.reddit.com/x');
    }
    advance(60_001); // slide the whole window past the first request
    await redditFetch('https://oauth.reddit.com/x');
    expect(fetchMock).toHaveBeenCalledTimes(61);
  });

  it('tracks requestsInWindow, pruning stale entries', async () => {
    const rateLimiterModule = require('../RedditRateLimiter');
    const { redditFetch } = rateLimiterModule;
    await redditFetch('https://oauth.reddit.com/x');
    await redditFetch('https://oauth.reddit.com/x');

    // requestsInWindow is exposed only on the internal singleton instance,
    // so exercise it indirectly via the rate-limit boundary instead.
    for (let i = 0; i < 58; i++) {
      await redditFetch('https://oauth.reddit.com/x');
    }
    expect(fetchMock).toHaveBeenCalledTimes(60);

    advance(30_000);
    expect(() => redditFetch('https://oauth.reddit.com/x')).toThrow();

    advance(30_001); // now the first two requests have aged out
    await redditFetch('https://oauth.reddit.com/x');
    await redditFetch('https://oauth.reddit.com/x');
    expect(fetchMock).toHaveBeenCalledTimes(62);
  });
});
