// src/hooks/useScraper.ts
import { useCallback, useState } from 'react';
import type { Post } from '../models/Post';

interface UseScraperResult {
  loading: boolean;
  error: Error | null;
  extractPostData: (url: string) => Promise<Post>;
}

const USER_AGENT = 'expo:reddit-bookmark-app:v1.0.0 (by /u/Horror_Function7268)';

// Regexes for recognising valid Reddit post URLs
const POST_URL_RE = /^\/r\/[^\/]+\/comments\/([a-z0-9]+)(?:\/[^\/]+)?\/?$/i;
const SHORT_S_RE   = /^\/r\/[^\/]+\/s\/[A-Za-z0-9_-]+\/?$/i;

export function useScraper(): UseScraperResult {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<Error | null>(null);

  // Validate that this URL is one we can handle
  function validateUrl(input: URL) {
    if (POST_URL_RE.test(input.pathname) || SHORT_S_RE.test(input.pathname)) {
      return;
    }
    throw new Error('Unrecognised Reddit post URL format');
  }

  // For “/s/” short links, follow the redirect to get the real pathname
  async function resolveRedirect(input: URL): Promise<URL> {
    if (!SHORT_S_RE.test(input.pathname)) {
      return input;
    }
    const resp = await fetch(input.toString(), {
      method: 'HEAD',
      redirect: 'follow',
      headers: { 'User-Agent': USER_AGENT },
    });
    // `resp.url` is the final URL after redirects
    return new URL(resp.url);
  }

  // Build the clean JSON endpoint
  function buildJsonUrl(pathname: string): string {
    // ensure no trailing slash, then add .json
    const clean = pathname.replace(/\/+$/, '');
    return `https://www.reddit.com${clean}.json?raw_json=1`;
  }

  // Fetch + parse
  async function fetchJson(jsonUrl: string): Promise<any[]> {
    const resp = await fetch(jsonUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
      },
    });
    if (!resp.ok) {
      throw new Error(`Reddit returned HTTP ${resp.status}`);
    }
    try {
      return (await resp.json()) as any[];
    } catch (e) {
      throw new Error(`Failed to parse JSON from Reddit: ${e}`);
    }
  }

  // Map raw Reddit data to our Post
  function mapToPost(postData: any): Post {
    const now = Date.now();
    return {
      id: 0,
      redditId: postData.id,
      url: postData.url,
      title: postData.title,
      bodyText: postData.selftext ?? '',
      author: postData.author,
      subreddit: postData.subreddit,
      redditCreatedAt: new Date((postData.created_utc ?? postData.created) * 1000),
      addedAt: new Date(now),
      customTitle: undefined,
      customBody: undefined,
      notes: undefined,
      rating: undefined,
      isRead: false,
      isFavorite: false,
      folderId: undefined,
      tagIds: [],
      extraFields: {},
    };
  }

  const extractPostData = useCallback(async (inputUrl: string): Promise<Post> => {
    setLoading(true);
    setError(null);

    try {
      console.log('Extracting post data from URL:', inputUrl);
      const parsedUrl = new URL(inputUrl);
      validateUrl(parsedUrl);

      // Step 1: ensure it’s a reddit.com URL
      if (!/^(www\.)?reddit\.com$/.test(parsedUrl.hostname)) {
        throw new Error('URL is not on reddit.com');
      }

      // Step 2: resolve any /s/ redirect short links
      const finalUrl = await resolveRedirect(parsedUrl);

      // Step 3: validate the cleaned pathname
      validateUrl(finalUrl);

      // Step 4: build JSON endpoint & fetch
      const jsonUrl = buildJsonUrl(finalUrl.pathname);
      const listings = await fetchJson(jsonUrl);

      const raw = listings[0]?.data?.children?.[0]?.data;
      if (!raw) {
        throw new Error('No post data found in Reddit response');
      }

      console.log('Raw post data:', raw);

      // Step 5: map and return
      return mapToPost(raw);
    } catch (err: any) {
      console.error('Error in extractPostData:', err);
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, extractPostData };
}
