import * as SecureStore from 'expo-secure-store';
import { useCallback, useRef, useState } from 'react';
import type { Post } from '../models/models';
import secretsRaw from '../reddit.secrets.json';

// Patch type for secrets to include all expected fields
const secrets = secretsRaw as {
  USER_AGENT: string;
  REDDIT_CLIENT_ID: string;
  REDDIT_CLIENT_SECRET: string;
  USER_NAME: string;
  PASSWORD: string;
};

interface UseRedditApiResult {
  loading: boolean;
  error: Error | null;
  getPostData: (url: string) => Promise<Post>;
}

const USER_AGENT    = secrets.USER_AGENT || 'expo:post-organiser:v0.0.1 (by /u/username)';
const CLIENT_ID     = secrets.REDDIT_CLIENT_ID;
const CLIENT_SECRET = secrets.REDDIT_CLIENT_SECRET;
const USERNAME      = secrets.USER_NAME || '';
const PASSWORD      = secrets.PASSWORD || '';

const TOKEN_URL         = 'https://www.reddit.com/api/v1/access_token';
const API_BASE          = 'https://oauth.reddit.com';

const POST_URL_RE = /^\/r\/[^\/]+\/comments\/([a-z0-9]+)(?:\/[^\/]+)?\/?$/i;
const SHORT_S_RE = /^\/r\/[^\/]+\/s\/[A-Za-z0-9_-]+\/?$/i;

type TokenResponse = {
  token_type: string;
  access_token: string;
  expires_in: number;
  scope: string;
};

// SecureStore keys
const TOKEN_KEY = 'reddit_access_token';
const EXPIRY_KEY = 'reddit_token_expires_at';

export function useRedditApi(): UseRedditApiResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const tokenRef = useRef<string | null>(null);
  const expiryRef = useRef<number>(0);

  async function getToken(): Promise<string> {
    const now = Date.now();

    // try in-memory cache
    if (tokenRef.current && now < expiryRef.current) {
      return tokenRef.current;
    }

    // try secure store
    const storedToken = await SecureStore.getItemAsync(TOKEN_KEY);
    const storedExpiry = await SecureStore.getItemAsync(EXPIRY_KEY);
    if (storedToken && storedExpiry) {
      const exp = parseInt(storedExpiry, 10);
      if (now < exp) {
        tokenRef.current = storedToken;
        expiryRef.current = exp;
        return storedToken;
      }
    }

    // fetch new token
    const creds = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);
    const form = new URLSearchParams();
    form.append('grant_type', 'client_credentials');
    form.append('username', USERNAME);
    form.append('password', PASSWORD);

    const resp = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${creds}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'User-Agent': USER_AGENT,
      },
      body: form.toString(),
    });

    const data = await resp.json();
    if (!resp.ok) {
      const msg = data.error_description || data.error || resp.statusText;
      throw new Error(`Failed to get token: ${msg} (HTTP ${resp.status})`);
    }

    const token = (data as TokenResponse).access_token;
    const expiresIn = (data as TokenResponse).expires_in;
    const expiry = now + (expiresIn - 60) * 1000;

    tokenRef.current = token;
    expiryRef.current = expiry;

    // persist
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await SecureStore.setItemAsync(EXPIRY_KEY, expiry.toString());

    return token;
  }

  function validateUrl(input: URL) {
    if (POST_URL_RE.test(input.pathname) || SHORT_S_RE.test(input.pathname)) {
      return;
    }
    throw new Error('Unrecognised Reddit post URL format');
  }

  async function resolveRedirect(input: URL): Promise<URL> {
    if (!SHORT_S_RE.test(input.pathname)) {
      return input;
    }
    const resp = await fetch(input.toString(), {
      method: 'HEAD',
      redirect: 'follow',
      headers: { 'User-Agent': USER_AGENT },
    });
    return new URL(resp.url);
  }

  function buildJsonUrl(pathname: string): string {
    const clean = pathname.replace(/\/+$/, '');
    return `${API_BASE}${clean}.json?raw_json=1`;
  }

  async function fetchJson(oauthUrl: string): Promise<any[]> {
    const token = await getToken();
    const resp = await fetch(oauthUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    const data = await resp.json();
    if (!resp.ok) {
      const msg = data.message || resp.statusText;
      throw new Error(`Reddit API returned: ${msg} (HTTP ${resp.status})`);
    }
    return data as any[];
  }

  function mapToPost(postData: any): Post {
    const now = Date.now();
    return {
      id: 0,
      redditId: postData.id,
      url: postData.url,
      title: postData.title,
      bodyText: postData.selftext || '',
      author: postData.author,
      subreddit: postData.subreddit,
      redditCreatedAt: new Date((postData.created_utc || postData.created) * 1000),
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

  const getPostData = useCallback(async (inputUrl: string): Promise<Post> => {
    setLoading(true);
    setError(null);
    try {
      const parsedUrl = new URL(inputUrl);
      validateUrl(parsedUrl);
      if (!/^(www\.)?reddit\.com$/.test(parsedUrl.hostname)) {
        throw new Error('URL is not on reddit.com');
      }
      const finalUrl = await resolveRedirect(parsedUrl);
      validateUrl(finalUrl);
      const jsonUrl = buildJsonUrl(finalUrl.pathname);
      const listings = await fetchJson(jsonUrl);
      const raw = listings[0]?.data?.children?.[0]?.data;
      if (!raw) {
        throw new Error('No post data found in Reddit API response');
      }
      return mapToPost(raw);
    } catch (err: any) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [CLIENT_ID, CLIENT_SECRET]);

  return { loading, error, getPostData };
}