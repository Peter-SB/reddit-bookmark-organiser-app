import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Post } from '../models/models';

// SecureStore keys for Reddit creds (same as in your SettingsCredentialsManager)
export const STORAGE_KEYS = {
  CLIENT_ID: 'api_client_id',
  CLIENT_SECRET: 'api_client_secret',
  USERNAME: 'api_username',
  PASSWORD: 'api_password',
  USER_AGENT: 'api_user_agent',
};

const TOKEN_URL = 'https://www.reddit.com/api/v1/access_token';
const API_BASE = 'https://oauth.reddit.com';

const POST_URL_RE       = /^\/r\/[^\/]+\/comments\/([a-z0-9]+)(?:\/[^\/]+)?\/?$/i;
const USER_POST_URL_RE  = /^\/user\/[^\/]+\/comments\/([a-z0-9]+)(?:\/[^\/]+)?\/?$/i;
const SHORT_S_RE        = /^\/r\/[^\/]+\/s\/[A-Za-z0-9_-]+\/?$/i;
const SHORT_USER_S_RE   = /^\/u\/[^\/]+\/s\/[A-Za-z0-9_-]+\/?$/i;

type TokenResponse = {
  token_type: string;
  access_token: string;
  expires_in: number;
  scope: string;
};

const TOKEN_KEY  = 'reddit_access_token';
const EXPIRY_KEY = 'reddit_token_expires_at';

interface UseRedditApiResult {
  loading: boolean;
  error: Error | null;
  getPostData: (url: string) => Promise<Post>;
}

export function useRedditApi(): UseRedditApiResult {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<Error | null>(null);

  // in‑memory cache for the OAuth token
  const tokenRef  = useRef<string | null>(null);
  const expiryRef = useRef<number>(0);

  // credentials loaded from SecureStore
  const credsRef = useRef<{
    clientId:     string;
    clientSecret: string;
    username:     string;
    password:     string;
    userAgent:    string;
  } | null>(null);

  // promise that resolves when creds have been loaded
  const credsLoaded = useRef<Promise<void> | null>(null);

  // on mount, load Reddit creds once
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
        clientId:     cid     || '',
        clientSecret: csec    || '',
        username:     user    || '',
        password:     pass    || '',
        userAgent:    ua      || '',
      };
    })();
  }, []);

  // get a valid OAuth token, caching in memory and SecureStore
  async function getToken(): Promise<string> {
    const now = Date.now();

    // in‑memory valid?
    if (tokenRef.current && now < expiryRef.current) {
      return tokenRef.current;
    }

    // secure store valid?
    const [storedToken, storedExpiry] = await Promise.all([
      SecureStore.getItemAsync(TOKEN_KEY),
      SecureStore.getItemAsync(EXPIRY_KEY),
    ]);
    if (storedToken && storedExpiry) {
      const exp = parseInt(storedExpiry, 10);
      if (now < exp) {
        tokenRef.current  = storedToken;
        expiryRef.current = exp;
        return storedToken;
      }
    }

    // ensure creds are loaded
    if (credsLoaded.current) {
      await credsLoaded.current;
    }
    const creds = credsRef.current!;
    if (!creds.clientId || !creds.clientSecret) {
      throw new Error('Reddit client ID/secret not set in SecureStore');
    }

    // fetch new token
    const basic = btoa(`${creds.clientId}:${creds.clientSecret}`);
    const form  = new URLSearchParams({
      grant_type: 'client_credentials',
      username:   '',
      password:   '',
    });

    const resp = await fetch(TOKEN_URL, {
      method:  'POST',
      headers: {
        'Authorization': `Basic ${basic}`,
        'Content-Type':  'application/x-www-form-urlencoded',
        'User-Agent':    creds.userAgent,
      },
      body: form.toString(),
    });

    const data = await resp.json();
    if (!resp.ok) {
      const msg = (data as any).error_description
               || (data as any).error
               || resp.statusText;
      throw new Error(`Failed to get token: ${msg} (HTTP ${resp.status})`);
    }

    const tr       = data as TokenResponse;
    const token    = tr.access_token;
    const expiryMs = now + (tr.expires_in - 60) * 1000;

    // cache
    tokenRef.current  = token;
    expiryRef.current = expiryMs;

    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await SecureStore.setItemAsync(EXPIRY_KEY, expiryMs.toString());

    return token;
  }

  function validateUrl(input: URL) {
    if (POST_URL_RE.test(input.pathname)
     || USER_POST_URL_RE.test(input.pathname)
     || SHORT_S_RE.test(input.pathname)
     || SHORT_USER_S_RE.test(input.pathname)
    ) return;
    throw new Error('Unrecognised Reddit post URL format');
  }

  async function resolveRedirect(input: URL): Promise<URL> {
    const ua = credsRef.current?.userAgent || '';
    if (!SHORT_S_RE.test(input.pathname) && !SHORT_USER_S_RE.test(input.pathname)) {
      return input;
    }
    const resp = await fetch(input.toString(), {
      method:   'HEAD',
      redirect: 'follow',
      headers:  { 'User-Agent': ua  },
    });
    return new URL(resp.url);
  }

  function buildJsonUrl(path: string) {
    const clean = path.replace(/\/+$/, '');
    return `${API_BASE}${clean}.json?raw_json=1`;
  }

  async function fetchJson(oauthUrl: string): Promise<any[]> {
    const token = await getToken();
    const ua = credsRef.current?.userAgent || '';
    const resp  = await fetch(oauthUrl, {
      headers: {
        'User-Agent':    ua ,
        'Accept':        'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    const data = await resp.json();
    if (!resp.ok) {
      const msg = (data as any).message || resp.statusText;
      throw new Error(`Reddit API returned: ${msg} (HTTP ${resp.status})`);
    }
    return data as any[];
  }

  function mapToPost(postData: any): Post {
    const now = Date.now();
    return {
      id:             0,
      redditId:       postData.id,
      url:            postData.url,
      title:          postData.title,
      bodyText:       postData.selftext || '',
      author:         postData.author,
      subreddit:      postData.subreddit,
      redditCreatedAt: new Date((postData.created_utc || postData.created) * 1000),
      addedAt:        new Date(now),
      // updatedAt:      new Date(now),
      customTitle:    undefined,
      customBody:     undefined,
      notes:          undefined,
      rating:         undefined,
      isRead:         false,
      isFavorite:     false,
      folderIds:     [],
      extraFields:    {},
    };
  }

  const getPostData = useCallback(async (inputUrl: string): Promise<Post> => {
    setLoading(true);
    setError(null);
    try {
      const parsed = new URL(inputUrl);
      validateUrl(parsed);
      if (!/^(www\.)?reddit\.com$/.test(parsed.hostname)) {
        throw new Error('URL is not on reddit.com');
      }
      const final   = await resolveRedirect(parsed);
      console.debug(`url to get ${final}`)
      validateUrl(final);
      const jsonUrl = buildJsonUrl(final.pathname);
      const listings = await fetchJson(jsonUrl);
      const raw      = listings[0]?.data?.children?.[0]?.data;
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
  }, []);

  return { loading, error, getPostData };
}
