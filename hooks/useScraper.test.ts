// src/hooks/useScraper.test.ts
import { act, renderHook } from '@testing-library/react-hooks';
import type { Post } from '../models/Post';
import { useScraper } from './useScraper';

jest.setTimeout(30000); // allow up to 30s for real-world fetch

describe('useScraper integration tests', () => {
  it('extracts post data from a short /s/ URL', async () => {
    const { result } = renderHook(() => useScraper());
    const url = 'https://www.reddit.com/r/selfhosted/s/3aTofqpKYQ';

    let post: Post | undefined;
    await act(async () => {
      post = await result.current.extractPostData(url);
    });

    expect(post).toBeDefined();
    expect(post!.subreddit).toBe('selfhosted');
    expect(typeof post!.redditId).toBe('string');
    expect(post!.redditId.length).toBeGreaterThan(0);
    expect(post!.title).toBeTruthy();
    expect(post!.title).toBe("I'm tired of self-hosting email, even if I do everything right, my provider's IP address range gets blocked");
    expect(typeof post!.bodyText).toBe('string');
  });

  it('extracts post data from a full comments URL with query params', async () => {
    const { result } = renderHook(() => useScraper());
    const url =
      'https://www.reddit.com/r/selfhosted/comments/1luk33a/im_tired_of_selfhosting_email_even_if_i_do/?share_id=317DKoF3mwh2nQAqn6pA8';

    let post: Post | undefined;
    await act(async () => {
      post = await result.current.extractPostData(url);
    });

    expect(post).toBeDefined();
    expect(post!.subreddit).toBe('selfhosted');
    expect(typeof post!.redditId).toBe('string');
    expect(post!.redditId.length).toBeGreaterThan(0);
    expect(post!.title).toBeTruthy();
    expect(post!.title).toBe("I'm tired of self-hosting email, even if I do everything right, my provider's IP address range gets blocked");
    expect(typeof post!.bodyText).toBe('string');
  });
});
