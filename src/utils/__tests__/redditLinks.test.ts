import { parseSubredditFromUrl } from '../redditLinks';

describe('parseSubredditFromUrl', () => {
  it('extracts the subreddit name from a subreddit-root URL', () => {
    expect(parseSubredditFromUrl('https://www.reddit.com/r/memes/')).toBe('memes');
  });

  it('extracts the subreddit name from a bare subreddit URL without trailing slash', () => {
    expect(parseSubredditFromUrl('https://www.reddit.com/r/memes')).toBe('memes');
  });

  it('extracts the subreddit name from a post permalink', () => {
    expect(
      parseSubredditFromUrl('https://www.reddit.com/r/memes/comments/abc123/some_title/'),
    ).toBe('memes');
  });

  it('works without the www subdomain', () => {
    expect(parseSubredditFromUrl('https://reddit.com/r/aww/')).toBe('aww');
  });

  it('is case-insensitive on the hostname', () => {
    expect(parseSubredditFromUrl('https://WWW.REDDIT.com/r/aww/')).toBe('aww');
  });

  it('trims surrounding whitespace before parsing', () => {
    expect(parseSubredditFromUrl('  https://www.reddit.com/r/memes/  ')).toBe('memes');
  });

  it('returns null for a non-reddit.com URL', () => {
    expect(parseSubredditFromUrl('https://example.com/r/memes/')).toBeNull();
  });

  it('returns null when there is no /r/ path segment', () => {
    expect(parseSubredditFromUrl('https://www.reddit.com/user/someone/')).toBeNull();
  });

  it('returns null for an unparseable URL', () => {
    expect(parseSubredditFromUrl('not a url')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(parseSubredditFromUrl('')).toBeNull();
  });
});
