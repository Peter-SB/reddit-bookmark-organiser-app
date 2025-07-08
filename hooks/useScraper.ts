// src/hooks/useScraper.ts
import { useCallback, useState } from 'react';
import type { Post } from '../models/Post';

interface UseScraperResult {
  loading: boolean;
  error: Error | null;
  extractPostData: (url: string) => Promise<Post>;
}

export function useScraper(): UseScraperResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const extractPostData = useCallback(async (url: string): Promise<Post> => {
    setLoading(true);
    setError(null);

    console.log('Extracting post data from URL:', url);

    try {
      // 1. Parse and clean URL
      const parsed = new URL(url);
      // We only want the pathname: /r/AskReddit/comments/1lq65lr/...
      const cleanPath = parsed.pathname.replace(/\/+$/, '');

      // 2. Construct JSON endpoint
      const jsonUrl = `https://www.reddit.com${cleanPath}.json?raw_json=1`;
        
      const resp = await fetch( jsonUrl, {
        headers: { 'User-Agent': 'expo:reddit-bookmark-app:v1.0.0 (by /u/Horror_Function7268)' },
      });

      if (!resp.ok) {
        throw new Error(`Failed to fetch Reddit post: ${resp.status}`);
      }

      const listings = (await resp.json()) as any[];
      const postData = listings[0]?.data?.children?.[0]?.data;

      if (!postData) {
        throw new Error('No post data found in Reddit response');
      }

      // Map JSON fields to our Post interface
      const now = Date.now();
      const mapped: Post = {
        id: 0,  // to be set by DB on insert
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

      return mapped;
    } catch (err: any) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, extractPostData };
}
