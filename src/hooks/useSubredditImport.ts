import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RedditPostPreview } from './useAuthorImport';
import { redditFetch } from '../services/RedditRateLimiter';

// Keys for Reddit credentials
const STORAGE_KEYS = {
  CLIENT_ID: 'api_client_id',
  CLIENT_SECRET: 'api_client_secret',
  USERNAME: 'api_username',
  PASSWORD: 'api_password',
  USER_AGENT: 'api_user_agent',
};

const TOKEN_URL = 'https://www.reddit.com/api/v1/access_token';
const API_BASE = 'https://oauth.reddit.com';

const TOKEN_KEY = 'reddit_access_token';
const EXPIRY_KEY = 'reddit_token_expires_at';

type TokenResponse = {
  token_type: string;
  access_token: string;
  expires_in: number;
  scope: string;
};

export type SubredditSort = 'hot' | 'new' | 'top' | 'rising';
export type SubredditTimeRange = 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';

/**
 * RedditPostPreview plus the comment count (Reddit API's `num_comments`
 * field, present on every post listing), used to show engagement in the
 * subreddit browse screen.
 */
export interface SubredditPostPreview extends RedditPostPreview {
  commentCount: number;
}

interface UseSubredditImportResult {
  posts: SubredditPostPreview[];
  loading: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  reset: () => void;
}

export function useSubredditImport(
  subredditName: string,
  sort: SubredditSort,
  timeRange?: SubredditTimeRange,
): UseSubredditImportResult {
  const [posts, setPosts] = useState<SubredditPostPreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [after, setAfter] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  // Prevent concurrent loads
  const isLoadingRef = useRef(false);

  // In-memory cache for the OAuth token
  const tokenRef = useRef<string | null>(null);
  const expiryRef = useRef<number>(0);

  // Credentials loaded from SecureStore
  const credsRef = useRef<{
    clientId: string;
    clientSecret: string;
    username: string;
    password: string;
    userAgent: string;
  } | null>(null);

  // Promise that resolves when creds have been loaded
  const credsLoaded = useRef<Promise<void> | null>(null);

  // On mount, load Reddit creds once
  useEffect(() => {
    credsLoaded.current = (async () => {
      const [cid, csec, user, pass, ua] = await Promise.all([
        SecureStore.getItemAsync(STORAGE_KEYS.CLIENT_ID),
        SecureStore.getItemAsync(STORAGE_KEYS.CLIENT_SECRET),
        SecureStore.getItemAsync(STORAGE_KEYS.USERNAME),
        SecureStore.getItemAsync(STORAGE_KEYS.PASSWORD),
        SecureStore.getItemAsync(STORAGE_KEYS.USER_AGENT),
      ]);
      credsRef.current = {
        clientId: cid || '',
        clientSecret: csec || '',
        username: user || '',
        password: pass || '',
        userAgent: ua || '',
      };
    })();
  }, []);

  // Reset state when subredditName, sort, or timeRange changes
  useEffect(() => {
    setPosts([]);
    setAfter(null);
    setHasMore(true);
    setError(null);
    isLoadingRef.current = false;
  }, [subredditName, sort, timeRange]);

  // Get a valid OAuth token, caching in memory and SecureStore
  async function getToken(): Promise<string> {
    const now = Date.now();

    if (tokenRef.current && now < expiryRef.current) {
      return tokenRef.current;
    }

    const [storedToken, storedExpiry] = await Promise.all([
      SecureStore.getItemAsync(TOKEN_KEY),
      SecureStore.getItemAsync(EXPIRY_KEY),
    ]);
    if (storedToken && storedExpiry) {
      const exp = parseInt(storedExpiry, 10);
      if (now < exp) {
        tokenRef.current = storedToken;
        expiryRef.current = exp;
        return storedToken;
      }
    }

    if (credsLoaded.current) {
      await credsLoaded.current;
    }
    const creds = credsRef.current!;
    if (!creds.clientId || !creds.clientSecret) {
      throw new Error('Reddit client ID/secret not set in SecureStore');
    }

    const basic = btoa(`${creds.clientId}:${creds.clientSecret}`);
    const form = new URLSearchParams({
      grant_type: 'client_credentials',
      username: '',
      password: '',
    });

    const resp = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': creds.userAgent,
      },
      body: form.toString(),
    });

    const data = await resp.json();
    if (!resp.ok) {
      const msg =
        (data as any).error_description ||
        (data as any).error ||
        resp.statusText;
      throw new Error(`Failed to get token: ${msg} (HTTP ${resp.status})`);
    }

    const tr = data as TokenResponse;
    const token = tr.access_token;
    const expiryMs = now + (tr.expires_in - 60) * 1000;

    tokenRef.current = token;
    expiryRef.current = expiryMs;

    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await SecureStore.setItemAsync(EXPIRY_KEY, expiryMs.toString());

    return token;
  }

  const loadMore = useCallback(async () => {
    if (isLoadingRef.current || loading || !hasMore || !subredditName) return;
    isLoadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      if (credsLoaded.current) {
        await credsLoaded.current;
      }
      const token = await getToken();
      const ua = credsRef.current?.userAgent || '';
      let url = `${API_BASE}/r/${subredditName}/${sort}?limit=25&raw_json=1`;
      if (sort === 'top' && timeRange) {
        url += `&t=${timeRange}`;
      }
      if (after) {
        url += `&after=${after}`;
      }
      const resp = await redditFetch(url, {
        headers: {
          'User-Agent': ua,
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await resp.json();
      if (!resp.ok) {
        const msg = (data as any).message || resp.statusText;
        throw new Error(`Reddit API returned: ${msg} (HTTP ${resp.status})`);
      }
      const children = data?.data?.children || [];
      const newPosts: SubredditPostPreview[] = children.map((child: any) => {
        const post = child.data;
        return {
          id: post.id,
          title: post.title,
          author: post.author,
          subreddit: post.subreddit,
          url: post.url,
          bodyText: post.selftext || '',
          created: post.created_utc || post.created,
          permalink: post.permalink,
          score: typeof post.score === 'number' ? post.score : post.ups,
          commentCount: typeof post.num_comments === 'number' ? post.num_comments : 0,
        };
      });
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        const deduped = [...prev];
        for (const np of newPosts) {
          if (!seen.has(np.id)) {
            deduped.push(np);
            seen.add(np.id);
          }
        }
        return deduped;
      });
      setAfter(data?.data?.after || null);
      setHasMore(!!data?.data?.after);
    } catch (err: any) {
      console.error('Error loading subreddit posts:', err);
      setError(err);
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, [subredditName, sort, timeRange, after, loading, hasMore]);

  const reset = useCallback(() => {
    setPosts([]);
    setAfter(null);
    setHasMore(true);
    setError(null);
  }, []);

  return {
    posts,
    loading,
    error,
    hasMore,
    loadMore,
    reset,
  };
}
