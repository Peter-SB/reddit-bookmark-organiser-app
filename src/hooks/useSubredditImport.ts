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
const GRANT_KEY = 'reddit_token_grant_type';

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
 *
 * `wordCount` and `titleKey` are derived from the body/title once, when the
 * listing page is parsed. Both used to be recomputed inside the row renderer,
 * which meant re-splitting every selftext on every re-render of every row.
 */
export interface SubredditPostPreview extends RedditPostPreview {
  commentCount: number;
  /** Words in the post body — 0 for link posts and empty selftexts. */
  wordCount: number;
  /** Trimmed, lowercased title, for matching against already-saved titles. */
  titleKey: string;
}

/** Words in a Reddit selftext; matches the count shown on each row. */
function countWords(bodyText: string): number {
  return bodyText.trim().split(/\s+/).filter(Boolean).length;
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
  const [hasMore, setHasMore] = useState(true);

  // Pagination cursor and "more pages exist" flag are kept in refs as well as
  // state: loadMore reads them at call time, so switching sort/time range can
  // reset them without leaving a stale closure holding the previous listing's
  // cursor (which used to make the first page of the new sort never load).
  const afterRef = useRef<string | null>(null);
  const hasMoreRef = useRef(true);

  // Prevent concurrent loads
  const isLoadingRef = useRef(false);

  // Incremented whenever subreddit/sort/timeRange changes. Responses from a
  // previous set of parameters are discarded instead of being appended.
  const requestIdRef = useRef(0);

  // Reddit only honours the `t` (time range) parameter on `top` listings, so
  // changing the time range under any other sort must not trigger a reload.
  const effectiveTimeRange = sort === 'top' ? timeRange : undefined;

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

  // Get a valid OAuth token, caching in memory and SecureStore
  async function getToken(): Promise<string> {
    const now = Date.now();

    if (tokenRef.current && now < expiryRef.current) {
      console.debug('[useSubredditImport] getToken — using in-memory cached token');
      return tokenRef.current;
    }

    if (credsLoaded.current) {
      await credsLoaded.current;
    }
    const creds = credsRef.current!;
    if (!creds.clientId || !creds.clientSecret) {
      throw new Error('Reddit client ID/secret not set in SecureStore');
    }
    const hasPassword = !!(creds.username && creds.password);
    const desiredGrant = hasPassword ? 'password' : 'client_credentials';
    console.debug(
      `[useSubredditImport] getToken — clientId=${!!creds.clientId} hasUsername=${!!creds.username} hasPassword=${!!creds.password} userAgent="${creds.userAgent}" desiredGrant=${desiredGrant}`,
    );

    const [storedToken, storedExpiry, storedGrant] = await Promise.all([
      SecureStore.getItemAsync(TOKEN_KEY),
      SecureStore.getItemAsync(EXPIRY_KEY),
      SecureStore.getItemAsync(GRANT_KEY),
    ]);
    if (storedToken && storedExpiry) {
      const exp = parseInt(storedExpiry, 10);
      if (now < exp && storedGrant === desiredGrant) {
        console.debug(
          `[useSubredditImport] getToken — using SecureStore cached token (grant=${storedGrant}, expires in ${Math.round((exp - now) / 1000)}s)`,
        );
        tokenRef.current = storedToken;
        expiryRef.current = exp;
        return storedToken;
      }
      console.debug(
        `[useSubredditImport] getToken — ignoring cached token (storedGrant=${storedGrant}, desiredGrant=${desiredGrant}, expired=${now >= exp})`,
      );
    }

    const basic = btoa(`${creds.clientId}:${creds.clientSecret}`);
    // Password grant (using the logged-in user's own account) is required to
    // view NSFW/quarantined subreddits; app-only client_credentials tokens
    // get silently empty listings for that content. Fall back to
    // client_credentials when no password is configured.
    const form = hasPassword
      ? new URLSearchParams({
          grant_type: 'password',
          username: creds.username,
          password: creds.password,
        })
      : new URLSearchParams({
          grant_type: 'client_credentials',
          username: '',
          password: '',
        });

    console.debug(`[useSubredditImport] getToken — requesting new token via grant_type=${desiredGrant}`);
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
      console.debug(`[useSubredditImport] getToken — token request failed HTTP ${resp.status}:`, data);
      throw new Error(`Failed to get token: ${msg} (HTTP ${resp.status})`);
    }

    const tr = data as TokenResponse;
    const token = tr.access_token;
    const expiryMs = now + (tr.expires_in - 60) * 1000;
    console.debug(
      `[useSubredditImport] getToken — new token acquired, grant=${desiredGrant} scope="${tr.scope}" expiresIn=${tr.expires_in}s`,
    );

    tokenRef.current = token;
    expiryRef.current = expiryMs;

    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await SecureStore.setItemAsync(EXPIRY_KEY, expiryMs.toString());
    await SecureStore.setItemAsync(GRANT_KEY, desiredGrant);

    return token;
  }

  const loadMore = useCallback(async () => {
    if (isLoadingRef.current || !hasMoreRef.current || !subredditName) {
      console.debug(
        `[useSubredditImport] loadMore skipped — isLoading=${isLoadingRef.current} hasMore=${hasMoreRef.current} subredditName="${subredditName}"`,
      );
      return;
    }
    const requestId = requestIdRef.current;
    const after = afterRef.current;
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
      if (effectiveTimeRange) {
        url += `&t=${effectiveTimeRange}`;
      }
      if (after) {
        url += `&after=${after}`;
      }
      console.debug(`[useSubredditImport] fetching ${url}`);
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
        console.debug(`[useSubredditImport] non-OK response HTTP ${resp.status}:`, data);
        throw new Error(`Reddit API returned: ${msg} (HTTP ${resp.status})`);
      }
      if (requestId !== requestIdRef.current) {
        console.debug(
          `[useSubredditImport] discarding stale response for "${subredditName}" ${sort}/${effectiveTimeRange ?? '-'}`,
        );
        return;
      }
      const children = data?.data?.children || [];
      console.debug(
        `[useSubredditImport] response OK — ${children.length} children in data.data.children`,
      );
      const newPosts: SubredditPostPreview[] = children.map((child: any) => {
        const post = child.data;
        const bodyText = post.selftext || '';
        const title = post.title || '';
        return {
          id: post.id,
          title,
          author: post.author,
          subreddit: post.subreddit,
          url: post.url,
          bodyText,
          created: post.created_utc || post.created,
          permalink: post.permalink,
          score: typeof post.score === 'number' ? post.score : post.ups,
          commentCount: typeof post.num_comments === 'number' ? post.num_comments : 0,
          wordCount: countWords(bodyText),
          titleKey: title.trim().toLowerCase(),
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
        console.debug(
          `[useSubredditImport] posts: prev=${prev.length} new=${newPosts.length} deduped total=${deduped.length}`,
        );
        return deduped;
      });
      afterRef.current = data?.data?.after || null;
      hasMoreRef.current = !!afterRef.current;
      setHasMore(hasMoreRef.current);
    } catch (err: any) {
      console.error('Error loading subreddit posts:', err);
      if (requestId === requestIdRef.current) {
        setError(err);
      }
    } finally {
      // A stale request must not clear the in-flight flag of the newer one.
      if (requestId === requestIdRef.current) {
        setLoading(false);
        isLoadingRef.current = false;
      }
    }
  }, [subredditName, sort, effectiveTimeRange]);

  const reset = useCallback(() => {
    requestIdRef.current += 1;
    afterRef.current = null;
    hasMoreRef.current = true;
    isLoadingRef.current = false;
    setPosts([]);
    setHasMore(true);
    setError(null);
    setLoading(false);
  }, []);

  // Restart the listing whenever the subreddit, sort, or time range changes.
  // `reset` bumps the request id so any in-flight fetch for the old parameters
  // is dropped, then the first page of the new listing is fetched immediately.
  useEffect(() => {
    reset();
    loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subredditName, sort, effectiveTimeRange]);

  return {
    posts,
    loading,
    error,
    hasMore,
    loadMore,
    reset,
  };
}
