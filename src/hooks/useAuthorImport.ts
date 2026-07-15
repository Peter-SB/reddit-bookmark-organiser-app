import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useRef, useState } from 'react';
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

export interface RedditPostPreview {
  id: string;
  title: string;
  author: string;
  subreddit: string;
  url: string;
  bodyText: string;
  created: number;
  permalink: string;
  score?: number;
}

interface UseAuthorImportResult {
  posts: RedditPostPreview[];
  loading: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  reset: () => void;
}


export function useAuthorImport(authorName: string): UseAuthorImportResult {
  const [posts, setPosts] = useState<RedditPostPreview[]>([]);
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

  // Reset state when authorName changes
  useEffect(() => {
    setPosts([]);
    setAfter(null);
    setHasMore(true);
    setError(null);
    isLoadingRef.current = false;
  }, [authorName]);

  // Get a valid OAuth token, caching in memory and SecureStore
  async function getToken(): Promise<string> {
    const now = Date.now();

    // In-memory valid?
    if (tokenRef.current && now < expiryRef.current) {
      console.debug('[useAuthorImport] getToken — using in-memory cached token');
      return tokenRef.current;
    }

    // Ensure creds are loaded
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
      `[useAuthorImport] getToken — clientId=${!!creds.clientId} hasUsername=${!!creds.username} hasPassword=${!!creds.password} userAgent="${creds.userAgent}" desiredGrant=${desiredGrant}`,
    );

    // Secure store valid?
    const [storedToken, storedExpiry, storedGrant] = await Promise.all([
      SecureStore.getItemAsync(TOKEN_KEY),
      SecureStore.getItemAsync(EXPIRY_KEY),
      SecureStore.getItemAsync(GRANT_KEY),
    ]);
    if (storedToken && storedExpiry) {
      const exp = parseInt(storedExpiry, 10);
      if (now < exp && storedGrant === desiredGrant) {
        console.debug(
          `[useAuthorImport] getToken — using SecureStore cached token (grant=${storedGrant}, expires in ${Math.round((exp - now) / 1000)}s)`,
        );
        tokenRef.current = storedToken;
        expiryRef.current = exp;
        return storedToken;
      }
      console.debug(
        `[useAuthorImport] getToken — ignoring cached token (storedGrant=${storedGrant}, desiredGrant=${desiredGrant}, expired=${now >= exp})`,
      );
    }

    // Fetch new token
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

    console.debug(`[useAuthorImport] getToken — requesting new token via grant_type=${desiredGrant}`);
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
      console.debug(`[useAuthorImport] getToken — token request failed HTTP ${resp.status}:`, data);
      throw new Error(`Failed to get token: ${msg} (HTTP ${resp.status})`);
    }

    const tr = data as TokenResponse;
    const token = tr.access_token;
    const expiryMs = now + (tr.expires_in - 60) * 1000;
    console.debug(
      `[useAuthorImport] getToken — new token acquired, grant=${desiredGrant} scope="${tr.scope}" expiresIn=${tr.expires_in}s`,
    );

    // Cache
    tokenRef.current = token;
    expiryRef.current = expiryMs;

    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await SecureStore.setItemAsync(EXPIRY_KEY, expiryMs.toString());
    await SecureStore.setItemAsync(GRANT_KEY, desiredGrant);

    return token;
  }

  const loadMore = useCallback(async () => {
    if (isLoadingRef.current || loading || !hasMore || !authorName) return;
    isLoadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      // Ensure creds are loaded
      if (credsLoaded.current) {
        await credsLoaded.current;
      }
      const token = await getToken();
      const ua = credsRef.current?.userAgent || '';
      // Build the URL for fetching user's submitted posts
      let url = `${API_BASE}/user/${authorName}/submitted?limit=25&raw_json=1`;
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
      const newPosts: RedditPostPreview[] = children.map((child: any) => {
        const post = child.data;
        // console.log('Post id=', post.id);
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
        };
      });
      // Deduplicate by id
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
      console.error('Error loading author posts:', err);
      setError(err);
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, [authorName, after, loading, hasMore]);

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
